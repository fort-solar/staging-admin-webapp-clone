"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { AttachmentItem, DetailPanel, DirectoryToolbar, KeyValueList, TagList } from "@/components/dashboard/management-primitives";
import { FormField, Modal } from "@/components/dashboard/modals";
import { EyeIcon, FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { Button, EmptyScaffold, Pagination, Panel, SelectField, StatusPill, TableActionsMenu, Tabs, TextAreaField, TextField } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { buildMultipartFormData, createAppliance, DEFAULT_PAGE_SIZE, deleteAppliance, formatCurrencyLabel, formatDateTimeLabel, formatEnumLabel, getAppliances, getQuoteRequest, getQuoteRequests, updateAppliance, updateQuoteRequest } from "@/lib/admin-api";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { ApplianceCatalogRecord, PaginationMeta, QuoteRequestDetailRecord, QuoteRequestRecord } from "@/types/api.types";

const auditTabs = ["Quote Request", "Appliances"] as const;
const quoteStatusDefaults = [
  { label: "New", value: "new" },
  { label: "Quoted", value: "quoted" },
  { label: "Reviewed", value: "reviewed" },
  { label: "Closed", value: "closed" },
] as const;
const booleanOptions = [
  { label: "Yes", value: "true" },
  { label: "No", value: "false" },
] as const;
const activeOptions = [
  { label: "Active", value: "true" },
  { label: "Deactivated", value: "false" },
] as const;

type AuditTab = (typeof auditTabs)[number];

type ApplianceFormState = {
  name: string;
  category: string;
  power_rating_watts: string;
  daily_hours_usage: string;
  description: string;
  icon: string;
  catalog_key: string;
  surge_multiplier: string;
  is_inductive: string;
  search_aliases: string;
  is_active: string;
};

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

const defaultApplianceForm: ApplianceFormState = {
  name: "",
  category: "",
  power_rating_watts: "0",
  daily_hours_usage: "0",
  description: "",
  icon: "",
  catalog_key: "",
  surge_multiplier: "1",
  is_inductive: "false",
  search_aliases: "",
  is_active: "true",
};

function applianceMatchesQuery(record: ApplianceCatalogRecord, query: string) {
  return [
    record.name,
    record.category,
    record.description ?? "",
    record.icon ?? "",
    record.catalog_key ?? "",
    record.search_aliases.join(" "),
  ]
    .join(" ")
    .toLowerCase()
    .includes(query.toLowerCase());
}

function createApplianceForm(record?: ApplianceCatalogRecord | null): ApplianceFormState {
  if (!record) {
    return defaultApplianceForm;
  }

  return {
    name: record.name,
    category: record.category,
    power_rating_watts: String(record.power_rating_watts ?? 0),
    daily_hours_usage: String(record.daily_hours_usage ?? 0),
    description: record.description ?? "",
    icon: record.icon ?? "",
    catalog_key: record.catalog_key ?? "",
    surge_multiplier: String(record.surge_multiplier ?? 1),
    is_inductive: String(Boolean(record.is_inductive)),
    search_aliases: record.search_aliases.join(", "),
    is_active: String(Boolean(record.is_active)),
  };
}

function quoteStatusOptions(current?: string) {
  const normalizedCurrent = current?.trim().toLowerCase();

  if (!normalizedCurrent || quoteStatusDefaults.some((option) => option.value === normalizedCurrent)) {
    return [...quoteStatusDefaults];
  }

  return [{ label: formatEnumLabel(normalizedCurrent), value: normalizedCurrent }, ...quoteStatusDefaults];
}

export function buildQuotePackageRequestPayload(detail: QuoteRequestDetailRecord) {
  return {
    source_quote_id: detail.id,
    customer_name: detail.name,
    customer_email: detail.email,
    customer_phone: detail.phone,
    address: detail.address || detail.location,
    recommended_system_size: detail.recommended_system_size,
    estimated_cost: detail.estimated_cost,
    estimated_savings: detail.estimated_savings,
    payback_period_years: detail.payback_period_years,
    appliances: detail.appliances.map((appliance) => ({
      id: appliance.id,
      name: appliance.name,
      wattage: appliance.wattage,
      quantity: appliance.quantity,
      hoursPerDay: appliance.hoursPerDay,
    })),
    form_extras: detail.form_extras,
  };
}

export function getQuoteUpdateViewState(
  detail: QuoteRequestDetailRecord | null,
  status: string,
) {
  const persistedStatus = detail?.status?.trim().toLowerCase() || "";
  const selectedStatus = status.trim().toLowerCase();
  const isReviewed = persistedStatus === "reviewed";
  const isClosed = Boolean(detail?.is_closed || persistedStatus === "closed");

  return {
    isReadOnly: isReviewed || isClosed,
    showReviewedPayloadPreview: selectedStatus === "reviewed" || isReviewed,
    isClosed,
    isReviewed,
  };
}

export function EnergyAuditManagementScreen() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AuditTab>("Quote Request");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [quotes, setQuotes] = useState<QuoteRequestRecord[]>([]);
  const [quotePagination, setQuotePagination] = useState<PaginationMeta>(emptyPagination);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [appliances, setAppliances] = useState<ApplianceCatalogRecord[]>([]);
  const [selectedApplianceId, setSelectedApplianceId] = useState<string | null>(null);
  const [applianceForm, setApplianceForm] = useState<ApplianceFormState>(defaultApplianceForm);
  const [appliancesLoading, setAppliancesLoading] = useState(true);
  const [applianceError, setApplianceError] = useState<string | null>(null);
  const [applianceRefreshKey, setApplianceRefreshKey] = useState(0);
  const [isApplianceSaving, setIsApplianceSaving] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const selectedAppliance = appliances.find((appliance) => appliance.id === selectedApplianceId) ?? null;
  const canCreateAudits = can("energy_audits", "create");
  const canUpdateAudits = can("energy_audits", "update");
  const canDeleteAudits = can("energy_audits", "delete");

  useEffect(() => {
    if (activeTab !== "Quote Request") {
      return;
    }

    let cancelled = false;

    getQuoteRequests({
      page,
      limit: DEFAULT_PAGE_SIZE,
      search: deferredQuery.trim() || undefined,
      q: deferredQuery.trim() || undefined,
      fields: [
        "id",
        "user_id",
        "name",
        "email",
        "phone",
        "location",
        "address",
        "total_load_kw",
        "total_watt_hours_per_day",
        "monthly_usage_kwh",
        "monthly_bill",
        "daily_usage_kwh",
        "status",
        "admin_notes",
        "created_at",
        "updated_at",
      ],
    })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setQuotes(payload.data);
        setQuotePagination(payload.pagination);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setQuoteError(getErrorMessage(loadError, "Quote requests could not be loaded."));
        setQuotes([]);
        setQuotePagination(emptyPagination);
      })
      .finally(() => {
        if (!cancelled) {
          setQuotesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, deferredQuery, page]);

  useEffect(() => {
    if (activeTab !== "Appliances") {
      return;
    }

    let cancelled = false;

    setAppliancesLoading(true);
    setApplianceError(null);

    getAppliances()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setAppliances(payload.data);
        setSelectedApplianceId((current) => {
          if (current && payload.data.some((item) => item.id === current)) {
            return current;
          }

          return payload.data[0]?.id ?? null;
        });
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setAppliances([]);
        setSelectedApplianceId(null);
        setApplianceForm(defaultApplianceForm);
        setApplianceError(getErrorMessage(loadError, "Appliances could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) {
          setAppliancesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, applianceRefreshKey]);

  useEffect(() => {
    if (selectedAppliance) {
      setApplianceForm(createApplianceForm(selectedAppliance));
      return;
    }

    setApplianceForm(defaultApplianceForm);
  }, [selectedAppliance]);

  const filteredAppliances = useMemo(() => appliances.filter((appliance) => applianceMatchesQuery(appliance, deferredQuery)), [appliances, deferredQuery]);

  function handleTabChange(nextTab: AuditTab) {
    setActiveTab(nextTab);
    setPage(1);

    if (nextTab === "Quote Request") {
      setQuotesLoading(true);
      setQuoteError(null);
      return;
    }

    setAppliancesLoading(true);
    setApplianceError(null);
  }

  function handleSearchChange(value: string) {
    if (activeTab === "Quote Request") {
      setQuotesLoading(true);
      setQuoteError(null);
      setPage(1);
    }

    setQuery(value);
  }

  function handlePageChange(nextPage: number) {
    setQuotesLoading(true);
    setQuoteError(null);
    setPage(nextPage);
  }

  function handleSelectAppliance(appliance: ApplianceCatalogRecord) {
    setSelectedApplianceId(appliance.id);
    setApplianceForm(createApplianceForm(appliance));
  }

  function handleCreateApplianceDraft() {
    setSelectedApplianceId(null);
    setApplianceForm(defaultApplianceForm);
    setApplianceError(null);
  }

  async function handleApplianceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsApplianceSaving(true);

    try {
      const payload = {
        name: applianceForm.name.trim(),
        category: applianceForm.category.trim(),
        power_rating_watts: Number(applianceForm.power_rating_watts) || 0,
        daily_hours_usage: Number(applianceForm.daily_hours_usage) || 0,
        description: applianceForm.description.trim(),
        icon: applianceForm.icon.trim(),
        catalog_key: applianceForm.catalog_key.trim(),
        surge_multiplier: Number(applianceForm.surge_multiplier) || 1,
        is_inductive: applianceForm.is_inductive === "true",
        search_aliases: applianceForm.search_aliases
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        is_active: applianceForm.is_active === "true",
      };

      if (selectedApplianceId) {
        await updateAppliance(selectedApplianceId, payload);
      } else {
        await createAppliance(payload);
      }

      toast({
        title: selectedApplianceId ? "Appliance updated" : "Appliance created",
        description: `${payload.name || "Appliance"} was saved successfully.`,
        variant: "success",
      });
      setApplianceRefreshKey((current) => current + 1);
    } catch (saveError) {
      if (isDashboardActionCancelledError(saveError) || isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: selectedApplianceId ? "Update failed" : "Create failed",
        description: getErrorMessage(saveError, "The appliance could not be saved."),
        variant: "error",
      });
    } finally {
      setIsApplianceSaving(false);
    }
  }

  async function handleDeleteAppliance(appliance: ApplianceCatalogRecord) {
    try {
      await deleteAppliance(appliance.id);
      toast({
        title: "Appliance deleted",
        description: `${appliance.name} was removed successfully.`,
        variant: "success",
      });

      if (selectedApplianceId === appliance.id) {
        setSelectedApplianceId(null);
      }

      setApplianceRefreshKey((current) => current + 1);
    } catch (deleteError) {
      if (isDashboardActionCancelledError(deleteError) || isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The appliance could not be deleted."),
        variant: "error",
      });
    }
  }

  return (
    <div className="dashboard-stack">
      <div className="management-surface__tabs is-outside">
        <Tabs value={activeTab} onChange={handleTabChange} options={auditTabs} />
      </div>
      <Panel className="overflow-hidden">
        <div className="management-surface__body">
          <DirectoryToolbar
            searchValue={query}
            onSearchChange={handleSearchChange}
            searchPlaceholder={activeTab === "Quote Request" ? "Search request..." : "Search appliances..."}
            filters={
              <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                Filter
              </Button>
            }
            action={
              activeTab === "Appliances" && canCreateAudits ? (
                <Button variant="primary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={handleCreateApplianceDraft}>
                  Add Appliance
                </Button>
              ) : null
            }
          />
        </div>

        <ErrorMessage title={activeTab === "Quote Request" ? "Quote request load failed" : "Appliance load failed"} message={activeTab === "Quote Request" ? quoteError : applianceError} />

        {activeTab === "Quote Request" ? (
          quotesLoading && !quotes.length ? (
            <div className="p-6">
              <p className="section-description">Loading quote requests...</p>
            </div>
          ) : !quotesLoading && !quotes.length && !quoteError ? (
            <div className="p-6">
              <EmptyScaffold title="No quote requests found" description="No record found on the database" />
            </div>
          ) : (
            <>
              <div className="table-scroll pt-2">
                <table className="dashboard-table audit-table">
                  <thead>
                    <tr>
                      <th>User Information</th>
                      <th>Load Profile</th>
                      <th>Financial Estimate</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.length ? (
                      quotes.map((quote) => (
                        <tr key={quote.id}>
                          <td>
                            <div className="product-cell__text">
                              <strong>{quote.name}</strong>
                              <span>{quote.phone}</span>
                              <span>{quote.email}</span>
                            </div>
                          </td>
                          <td>
                            <ul className="compact-list">
                              <li>
                                <span>Total Load</span>
                                <strong>{quote.total_load_kw ? `${quote.total_load_kw} kW` : "N/A"}</strong>
                              </li>
                              <li>
                                <span>Daily Usage</span>
                                <strong>{quote.daily_usage_kwh ? `${quote.daily_usage_kwh} kWh` : "N/A"}</strong>
                              </li>
                              <li>
                                <span>Monthly Usage</span>
                                <strong>{quote.monthly_usage_kwh ? `${quote.monthly_usage_kwh} kWh` : "N/A"}</strong>
                              </li>
                            </ul>
                          </td>
                          <td>
                            <ul className="compact-list">
                              <li>
                                <span>Monthly Bill</span>
                                <strong>{quote.monthly_bill ? formatCurrencyLabel(quote.monthly_bill) : "N/A"}</strong>
                              </li>
                              <li>
                                <span>Estimated Cost</span>
                                <strong>{quote.estimated_cost ? formatCurrencyLabel(quote.estimated_cost) : "N/A"}</strong>
                              </li>
                              <li>
                                <span>Estimated Savings</span>
                                <strong>{quote.estimated_savings ? formatCurrencyLabel(quote.estimated_savings) : "N/A"}</strong>
                              </li>
                            </ul>
                          </td>
                          <td>{formatDateTimeLabel(quote.created_at)}</td>
                          <td>
                            <StatusPill label={formatEnumLabel(quote.status)} tone={toneFromStatus(quote.status)} />
                          </td>
                          <td>
                            <div className="inline-actions">
                              <Link href={`/energy-audit/${quote.id}`} className="action-button is-secondary is-sm">
                                <EyeIcon className="mini-icon" />
                                <span>View</span>
                              </Link>
                              {canUpdateAudits ? <TableActionsMenu items={[{ label: "View Request", href: `/energy-audit/${quote.id}` }]} /> : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>
                          <div className="p-6">
                            <EmptyScaffold title="No quote requests matched" description="No record found on the database" />
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={Math.max(quotePagination.totalPages, 1)} onChange={handlePageChange} />
            </>
          )
        ) : (
          <div className="audit-appliance-layout">
            <div className="appliance-list">
              {appliancesLoading && !appliances.length ? (
                <div className="p-4 text-sm text-[var(--text-soft)]">Loading appliances...</div>
              ) : filteredAppliances.length ? (
                filteredAppliances.map((appliance) => (
                  <article key={appliance.id} className="appliance-row">
                    <button type="button" onClick={() => handleSelectAppliance(appliance)}>
                      <strong>{appliance.name}</strong>
                      <span>
                        {appliance.category} • {appliance.power_rating_watts}W • {appliance.daily_hours_usage} hrs/day
                      </span>
                    </button>
                    <div className="inline-actions">
                      {canUpdateAudits ? (
                        <Button variant="secondary" size="sm" onClick={() => handleSelectAppliance(appliance)}>
                          Edit
                        </Button>
                      ) : null}
                      {canDeleteAudits ? (
                        <Button variant="danger" size="sm" leadingIcon={<TrashIcon className="mini-icon" />} onClick={() => void handleDeleteAppliance(appliance)}>
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <div className="p-4">
                  <EmptyScaffold title="No appliances found" description="No appliance catalog item matched the current query." />
                </div>
              )}
            </div>

            <aside className="side-edit-card">
              <h3>{selectedApplianceId ? "Edit Appliance" : "Create Appliance"}</h3>
              <p>
                {selectedAppliance
                  ? `${selectedAppliance.name} • ${selectedAppliance.monthly_kwh} kWh/month`
                  : "Create a new appliance catalog entry for the energy audit calculator."}
              </p>

              <form className="flex flex-col gap-4" onSubmit={handleApplianceSubmit}>
                <FormField label="Name">
                  <TextField value={applianceForm.name} onChange={(event) => setApplianceForm((current) => ({ ...current, name: event.target.value }))} placeholder={'LED TV (42")'} />
                </FormField>

                <FormField label="Category">
                  <TextField value={applianceForm.category} onChange={(event) => setApplianceForm((current) => ({ ...current, category: event.target.value }))} placeholder="Entertainment" />
                </FormField>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Power Rating (Watts)">
                    <TextField value={applianceForm.power_rating_watts} onChange={(event) => setApplianceForm((current) => ({ ...current, power_rating_watts: event.target.value }))} placeholder="120" />
                  </FormField>
                  <FormField label="Daily Hours Usage">
                    <TextField value={applianceForm.daily_hours_usage} onChange={(event) => setApplianceForm((current) => ({ ...current, daily_hours_usage: event.target.value }))} placeholder="5" />
                  </FormField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Icon">
                    <TextField value={applianceForm.icon} onChange={(event) => setApplianceForm((current) => ({ ...current, icon: event.target.value }))} placeholder="tv" />
                  </FormField>
                  <FormField label="Catalog Key">
                    <TextField value={applianceForm.catalog_key} onChange={(event) => setApplianceForm((current) => ({ ...current, catalog_key: event.target.value }))} placeholder="tv-led-43" />
                  </FormField>
                </div>

                <FormField label="Description">
                  <TextAreaField value={applianceForm.description} onChange={(value) => setApplianceForm((current) => ({ ...current, description: value }))} placeholder="Typical living room TV" rows={4} />
                </FormField>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Surge Multiplier">
                    <TextField value={applianceForm.surge_multiplier} onChange={(event) => setApplianceForm((current) => ({ ...current, surge_multiplier: event.target.value }))} placeholder="1" />
                  </FormField>
                  <FormField label="Search Aliases">
                    <TextField value={applianceForm.search_aliases} onChange={(event) => setApplianceForm((current) => ({ ...current, search_aliases: event.target.value }))} placeholder="tv, television, 43 inch" />
                  </FormField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Inductive">
                    <SelectField value={applianceForm.is_inductive} onChange={(value) => setApplianceForm((current) => ({ ...current, is_inductive: value }))} options={booleanOptions.map((option) => ({ ...option }))} />
                  </FormField>
                  <FormField label="Status">
                    <SelectField value={applianceForm.is_active} onChange={(value) => setApplianceForm((current) => ({ ...current, is_active: value }))} options={activeOptions.map((option) => ({ ...option }))} />
                  </FormField>
                </div>

                {selectedAppliance ? (
                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-soft)]">
                    Monthly usage: <strong className="text-[var(--text)]">{selectedAppliance.monthly_kwh} kWh</strong> • Updated {formatDateTimeLabel(selectedAppliance.updated_at)}
                  </div>
                ) : null}

                {selectedApplianceId ? (
                  canUpdateAudits ? (
                    <Button type="submit" variant="primary" disabled={isApplianceSaving}>
                      {isApplianceSaving ? "Saving..." : "Update Appliance"}
                    </Button>
                  ) : null
                ) : canCreateAudits ? (
                  <Button type="submit" variant="primary" disabled={isApplianceSaving}>
                    {isApplianceSaving ? "Saving..." : "Create Appliance"}
                  </Button>
                ) : null}
              </form>
            </aside>
          </div>
        )}
      </Panel>
    </div>
  );
}


export function ReviewedPayloadVisualPreview({ payload }: { payload: any }) {
  if (!payload || typeof payload !== "object") return null;

  return (
    <div className="space-y-4 text-left">
      {/* Customer Info */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <strong className="block text-xs font-semibold text-[var(--text-soft)] uppercase tracking-wider mb-2">Customer Information</strong>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><span className="text-[var(--text-soft)]">Name:</span> <strong className="text-[var(--text)] ml-1">{payload.customer_name || "N/A"}</strong></div>
          <div><span className="text-[var(--text-soft)]">Email:</span> <strong className="text-[var(--text)] ml-1">{payload.customer_email || "N/A"}</strong></div>
          <div><span className="text-[var(--text-soft)]">Phone:</span> <strong className="text-[var(--text)] ml-1">{payload.customer_phone || "N/A"}</strong></div>
          <div><span className="text-[var(--text-soft)]">Address:</span> <strong className="text-[var(--text)] ml-1">{payload.address || "N/A"}</strong></div>
        </div>
      </div>

      {/* Financials & Size */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center shadow-sm">
          <span className="block text-xs font-semibold text-[var(--text-soft)] uppercase tracking-wider">System Size</span>
          <strong className="block mt-1 text-sm text-[var(--brand)]">{payload.recommended_system_size ? `${payload.recommended_system_size} kW` : "N/A"}</strong>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center shadow-sm">
          <span className="block text-xs font-semibold text-[var(--text-soft)] uppercase tracking-wider">Est. Cost</span>
          <strong className="block mt-1 text-sm text-[var(--brand)]">{payload.estimated_cost ? formatCurrencyLabel(payload.estimated_cost) : "N/A"}</strong>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center shadow-sm">
          <span className="block text-xs font-semibold text-[var(--text-soft)] uppercase tracking-wider">Est. Savings</span>
          <strong className="block mt-1 text-sm text-[var(--brand)]">{payload.estimated_savings ? formatCurrencyLabel(payload.estimated_savings) : "N/A"}</strong>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center shadow-sm">
          <span className="block text-xs font-semibold text-[var(--text-soft)] uppercase tracking-wider">Payback Period</span>
          <strong className="block mt-1 text-sm text-[var(--brand)]">{payload.payback_period_years ? `${payload.payback_period_years} years` : "N/A"}</strong>
        </div>
      </div>

      {/* Appliances */}
      {payload.appliances && Array.isArray(payload.appliances) && payload.appliances.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <strong className="block text-xs font-semibold text-[var(--text-soft)] uppercase tracking-wider mb-2">Appliances ({payload.appliances.length})</strong>
          <div className="divide-y divide-[var(--border)]">
            {payload.appliances.map((app: any, idx: number) => (
              <div key={idx} className="flex justify-between py-2 text-sm first:pt-0 last:pb-0">
                <span className="text-[var(--text)] font-medium">{app.name} <span className="text-[var(--text-soft)] ml-1 font-normal">x{app.quantity}</span></span>
                <span className="text-[var(--text-soft)]">{app.wattage}W • {app.hoursPerDay}h/day</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function EnergyAuditDetailScreen({ id }: { id: string }) {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const [detail, setDetail] = useState<QuoteRequestDetailRecord | null>(null);
  const [status, setStatus] = useState("new");
  const [adminNotes, setAdminNotes] = useState("");
  const [quoteAssetFile, setQuoteAssetFile] = useState<File | null>(null);
  const [recommendedSystemSize, setRecommendedSystemSize] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [estimatedSavings, setEstimatedSavings] = useState("");
  const [paybackPeriodYears, setPaybackPeriodYears] = useState("");
  const [validityDays, setValidityDays] = useState("7");
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isReviewedPayloadOpen, setIsReviewedPayloadOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canUpdateAudits = can("energy_audits", "update");

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getQuoteRequest(id)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setDetail(payload.data);
        setStatus(payload.data.status?.trim().toLowerCase() || "new");
        setAdminNotes(payload.data.admin_notes ?? "");
        setQuoteAssetFile(null);
        setRecommendedSystemSize(payload.data.recommended_system_size?.toString() ?? "");
        setEstimatedCost(payload.data.estimated_cost?.toString() ?? "");
        setEstimatedSavings(payload.data.estimated_savings?.toString() ?? "");
        setPaybackPeriodYears(payload.data.payback_period_years?.toString() ?? "");
        setValidityDays((payload.data.form_extras?.validity_days ?? "7").toString());
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(loadError, "Quote request could not be loaded."));
        setDetail(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!detail) {
      return;
    }

    if (detail.is_closed || detail.status?.trim().toLowerCase() === "closed") {
      return;
    }

    if (status === "quoted" && !quoteAssetFile && !detail.quote_asset_url) {
      toast({
        title: "Quote asset required",
        description: "Upload an image or PDF before moving this request to quoted.",
        variant: "error",
      });
      return;
    }

    if (status === "quoted" && !adminNotes.trim()) {
      toast({
        title: "Admin note required",
        description: "Add an admin note before moving this request to quoted.",
        variant: "error",
      });
      return;
    }

    if (status === "closed") {
      setIsCloseConfirmOpen(true);
      return;
    }

    await persistQuoteUpdate(false);
  }

  async function persistQuoteUpdate(closeConfirmed: boolean) {
    if (!detail) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        status,
        adminNotes: adminNotes.trim(),
        recommendedSystemSize: recommendedSystemSize ? parseFloat(recommendedSystemSize) : undefined,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
        estimatedSavings: estimatedSavings ? parseFloat(estimatedSavings) : undefined,
        paybackPeriodYears: paybackPeriodYears ? parseFloat(paybackPeriodYears) : undefined,
        validityDays: validityDays ? parseInt(validityDays) : undefined,
        ...(status === "reviewed" ? { package_request_payload: buildQuotePackageRequestPayload(detail) } : {}),
        ...(status === "closed" ? { close_confirmed: closeConfirmed } : {}),
      };
      const formData = buildMultipartFormData(payload);

      if (quoteAssetFile) {
        formData.append("quote_asset", quoteAssetFile);
        formData.append(
          "quote_asset_kind",
          quoteAssetFile.type.includes("pdf") ? "pdf" : quoteAssetFile.type.startsWith("image/") ? "image" : "file",
        );
      }

      await updateQuoteRequest(detail.id, formData);

      const refreshed = await getQuoteRequest(detail.id);
      setDetail(refreshed.data);
      setStatus(refreshed.data.status?.trim().toLowerCase() || "new");
      setAdminNotes(refreshed.data.admin_notes ?? "");
      setQuoteAssetFile(null);
      setRecommendedSystemSize(refreshed.data.recommended_system_size?.toString() ?? "");
      setEstimatedCost(refreshed.data.estimated_cost?.toString() ?? "");
      setEstimatedSavings(refreshed.data.estimated_savings?.toString() ?? "");
      setPaybackPeriodYears(refreshed.data.payback_period_years?.toString() ?? "");
      setValidityDays((refreshed.data.form_extras?.validity_days ?? "7").toString());
      setIsCloseConfirmOpen(false);

      toast({
        title: "Quote request updated",
        description: `${refreshed.data.name}'s request was updated successfully.`,
        variant: "success",
      });
    } catch (saveError) {
      if (isDashboardActionCancelledError(saveError) || isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: "Update failed",
        description: getErrorMessage(saveError, "The quote request could not be updated."),
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (!detail && !isLoading) {
    return (
      <Panel className="p-6">
        <ErrorMessage title="Quote request load failed" message={error} />
        <EmptyScaffold title="No quote request found" description="No record found on the database" />
      </Panel>
    );
  }

  const applianceTags = detail?.appliances.map((appliance) => `${appliance.name} x${appliance.quantity}`) ?? [];
  const formExtras = detail?.form_extras ? JSON.stringify(detail.form_extras, null, 2) : "{}";
  const reviewedPayload = detail ? JSON.stringify(buildQuotePackageRequestPayload(detail), null, 2) : "{}";
  const quoteUpdateView = getQuoteUpdateViewState(detail, status);

  return (
    <div className="dashboard-stack">
      <Panel className="quote-detail-shell">
        <div className="product-detail-shell__header">
          <div>
            <h2 className="section-title">Single Quote Request</h2>
            <p className="section-description">Review customer quote details and update the request status from the admin API.</p>
          </div>
          {detail ? <StatusPill label={formatEnumLabel(detail.status)} tone={toneFromStatus(detail.status)} /> : null}
        </div>

        <ErrorMessage title="Quote request load failed" message={error} />

        <div className="quote-detail-grid">
          <DetailPanel title="User Information" description="Customer details submitted from the public energy calculator.">
            <KeyValueList
              items={[
                { label: "Name", value: detail?.name || "N/A" },
                { label: "Phone Number", value: detail?.phone || "N/A" },
                { label: "Email", value: detail?.email || "N/A" },
                { label: "Location", value: detail?.location || "N/A" },
                { label: "Address", value: detail?.address || "N/A" },
                { label: "Created", value: formatDateTimeLabel(detail?.created_at) },
                { label: "Responded", value: formatDateTimeLabel(detail?.responded_at) },
              ]}
            />
            <div className="detail-panel__stack">
              <div>
                <p className="section-description">Added Appliances</p>
                {applianceTags.length ? <TagList items={applianceTags} /> : <p className="section-description">No appliances were returned for this quote request.</p>}
              </div>
            </div>
          </DetailPanel>

          <DetailPanel title="Estimated Calculations" description="System estimate generated by the public calculator.">
            <KeyValueList
              items={[
                { label: "Total Load", value: detail?.total_load_kw ? `${detail.total_load_kw} kW` : "N/A" },
                { label: "Total Watt Hours / Day", value: detail?.total_watt_hours_per_day ? `${detail.total_watt_hours_per_day} Wh` : "N/A" },
                { label: "Daily Usage", value: detail?.daily_usage_kwh ? `${detail.daily_usage_kwh} kWh` : "N/A" },
                { label: "Monthly Usage", value: detail?.monthly_usage_kwh ? `${detail.monthly_usage_kwh} kWh` : "N/A" },
                { label: "Monthly Bill", value: detail?.monthly_bill ? formatCurrencyLabel(detail.monthly_bill) : "N/A" },
                { label: "Recommended System Size", value: detail?.recommended_system_size ? `${detail.recommended_system_size} kW` : "N/A" },
                { label: "Estimated Cost", value: detail?.estimated_cost ? formatCurrencyLabel(detail.estimated_cost) : "N/A" },
                { label: "Estimated Savings", value: detail?.estimated_savings ? formatCurrencyLabel(detail.estimated_savings) : "N/A" },
                { label: "Payback Period", value: detail?.payback_period_years ? `${detail.payback_period_years} years` : "N/A" },
              ]}
            />
          </DetailPanel>

          <DetailPanel title="Additional Metadata" description="Roof details and any raw form extras returned by the API.">
            <KeyValueList
              items={[
                { label: "Roof Size", value: detail?.roof_size || "N/A" },
                { label: "Roof Orientation", value: detail?.roof_orientation || "N/A" },
                { label: "Shading", value: detail?.shading || "N/A" },
                { label: "User ID", value: detail?.user_id || "Guest" },
              ]}
            />
            <div className="detail-panel__stack">
              <AttachmentItem label={detail?.admin_notes || "No admin notes yet"} helper="Current Admin Notes" actionLabel="Inspect" />
              {(() => {
                if (!detail?.form_extras || typeof detail.form_extras !== "object") {
                  return <pre className="overflow-x-auto rounded-[16px] border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-xs leading-6 text-[var(--text-soft)]">{"{}"}</pre>;
                }
                const entries = Object.entries(detail.form_extras).filter(([k]) => !["roof_size", "roof_orientation", "shading"].includes(k));
                if (entries.length === 0) {
                  return <pre className="overflow-x-auto rounded-[16px] border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-xs leading-6 text-[var(--text-soft)]">{"{}"}</pre>;
                }
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                    {entries.map(([key, val]) => {
                      const displayVal = typeof val === "object" && val !== null ? JSON.stringify(val) : String(val);
                      return (
                        <div key={key} className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 shadow-sm">
                          <span className="block text-xs font-semibold text-[var(--text-soft)] uppercase tracking-wider">{key.replace(/_/g, " ")}</span>
                          <strong className="block mt-1 text-sm font-medium text-[var(--text)]">{displayVal}</strong>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </DetailPanel>

          <aside className="side-edit-card is-action-card">
            <h3>Update Request</h3>
            <p>Patch the quote request status and internal notes.</p>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <FormField label="Status">
                <SelectField
                  value={status}
                  onChange={(nextStatus) => {
                    setStatus(nextStatus);

                    if (nextStatus.trim().toLowerCase() === "reviewed") {
                      setIsReviewedPayloadOpen(true);
                    }
                  }}
                  options={quoteStatusOptions(status)}
                  disabled={quoteUpdateView.isReadOnly}
                />
              </FormField>
              {status === "quoted" ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <FormField label="Recommended System Size (kW)">
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 5.5"
                        value={recommendedSystemSize}
                        onChange={(e) => setRecommendedSystemSize(e.target.value)}
                        disabled={quoteUpdateView.isReadOnly}
                        className="dashboard-input"
                      />
                    </FormField>
                    <FormField label="Estimated Cost (NGN)">
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 5000000"
                        value={estimatedCost}
                        onChange={(e) => setEstimatedCost(e.target.value)}
                        disabled={quoteUpdateView.isReadOnly}
                        className="dashboard-input"
                      />
                    </FormField>
                    <FormField label="Estimated Savings (NGN/yr)">
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 1200000"
                        value={estimatedSavings}
                        onChange={(e) => setEstimatedSavings(e.target.value)}
                        disabled={quoteUpdateView.isReadOnly}
                        className="dashboard-input"
                      />
                    </FormField>
                    <FormField label="Payback Period (Years)">
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 4.5"
                        value={paybackPeriodYears}
                        onChange={(e) => setPaybackPeriodYears(e.target.value)}
                        disabled={quoteUpdateView.isReadOnly}
                        className="dashboard-input"
                      />
                    </FormField>
                    <FormField label="Quote Validity (Days)">
                      <input
                        type="number"
                        placeholder="e.g. 7"
                        value={validityDays}
                        onChange={(e) => setValidityDays(e.target.value)}
                        disabled={quoteUpdateView.isReadOnly}
                        className="dashboard-input"
                      />
                    </FormField>
                  </div>

                  <FormField label="Quote File" hint={detail?.quote_asset_url ? "A quote file already exists. Uploading a new file will replace it." : "Upload either an image or a PDF of the quote."}>
                    <label className="upload-field">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        disabled={quoteUpdateView.isReadOnly}
                        onChange={(event) => setQuoteAssetFile(event.target.files?.[0] ?? null)}
                      />
                      <span className="upload-field__button">
                        <span>{quoteAssetFile || detail?.quote_asset_url ? "Replace file" : "Choose file"}</span>
                      </span>
                      <span className="upload-field__value">{quoteAssetFile?.name || detail?.quote_asset_url?.split("/").pop() || "Upload quote image or PDF"}</span>
                    </label>
                  </FormField>
                </>
              ) : null}
              {quoteUpdateView.showReviewedPayloadPreview ? (
                <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-left">
                  <strong className="block text-sm">Package Request Payload Preview</strong>
                  <p className="mt-2 text-sm text-[var(--text-soft)] mb-3">
                    Updating with reviewed will create a package request from this quote.
                  </p>
                  <ReviewedPayloadVisualPreview payload={detail ? buildQuotePackageRequestPayload(detail) : null} />
                </div>
              ) : null}
              <FormField label="Admin Notes">
                <TextAreaField
                  value={adminNotes}
                  onChange={setAdminNotes}
                  placeholder="Internal quote response notes"
                  rows={6}
                  invalid={status === "quoted" && !adminNotes.trim()}
                  disabled={quoteUpdateView.isReadOnly}
                />
              </FormField>
              {quoteUpdateView.isReviewed ? (
                <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-soft)]">
                  This quote has been reviewed and is now read-only.
                </div>
              ) : null}
              {quoteUpdateView.isClosed ? (
                <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-soft)]">
                  This quote has been closed and can no longer be edited.
                </div>
              ) : null}
              {canUpdateAudits ? (
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isLoading || isSaving || !detail || quoteUpdateView.isReadOnly}
                >
                  {isSaving ? "Saving..." : "Update"}
                </Button>
              ) : null}
            </form>
          </aside>
        </div>
      </Panel>

      <Modal
        open={isCloseConfirmOpen}
        onClose={() => !isSaving && setIsCloseConfirmOpen(false)}
        title="Close Quote Request"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCloseConfirmOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void persistQuoteUpdate(true)} disabled={isSaving}>
              {isSaving ? "Closing..." : "Close Quote"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-soft)]">
          Are you sure you want to close this quote request? Closed quotes can no longer be edited.
        </p>
      </Modal>

      <Modal
        open={isReviewedPayloadOpen}
        onClose={() => setIsReviewedPayloadOpen(false)}
        title="Package Request Payload"
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setIsReviewedPayloadOpen(false)}>
            Close
          </Button>
        }
      >
        <p className="text-sm text-[var(--text-soft)] mb-4">
          Reviewing this quote will generate the following package request payload.
        </p>
        <ReviewedPayloadVisualPreview payload={detail ? buildQuotePackageRequestPayload(detail) : null} />
      </Modal>
    </div>
  );
}
