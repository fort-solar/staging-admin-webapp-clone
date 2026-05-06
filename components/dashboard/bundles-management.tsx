"use client";

import { type FormEvent, useDeferredValue, useEffect, useMemo, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { ActionLink, AttachmentItem, CatalogCard, DetailPanel, DirectoryToolbar, InlineCallout, KeyValueList, ManagementBackLink, MediaShowcase } from "@/components/dashboard/management-primitives";
import { FormField } from "@/components/dashboard/modals";
import { FormSubmitter, getFormSubmitIntent } from "@/components/dashboard/form-submitter";
import { Button, EmptyScaffold, MetricCardSecondary, Pagination, Panel, SelectField, StatusPill, TableActionsMenu, TextAreaField, TextField } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import {
  createPackage,
  DEFAULT_PAGE_SIZE,
  deletePackage,
  formatCurrencyLabel,
  formatDateLabel,
  getPackages,
  getProductCategories,
  updatePackage,
} from "@/lib/admin-api";
import { isDashboardSessionExpiredError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { PackageRecord, PaginationMeta, ProductCategoryApiRecord } from "@/types/api.types";

const packageCreateFormId = "package-create-form";

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

function PackageMetricsStrip({
  total,
  active,
  batteryIncluded,
}: {
  total: number;
  active: number;
  batteryIncluded: number;
}) {
  return (
    <section className="stats-grid--three">
      <MetricCardSecondary title="Total Packages" value={total.toLocaleString()} icon="bundles" spark={[18, 20, 24, 32, 40, 48]} />
      <MetricCardSecondary title="Active On This Page" value={active.toLocaleString()} icon="verification" spark={[28, 24, 21, 18, 16, 14]} />
      <MetricCardSecondary title="Battery Included" value={batteryIncluded.toLocaleString()} icon="sales" spark={[12, 18, 22, 34, 46, 54]} />
    </section>
  );
}

export function BundlesManagementScreen() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<PackageRecord[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const canCreateBundles = can("bundles", "create");
  const canDeleteBundles = can("bundles", "delete");

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getPackages({
      page,
      limit: DEFAULT_PAGE_SIZE,
      search: deferredQuery.trim() || undefined,
      q: deferredQuery.trim() || undefined,
      fields: ["id", "slug", "name", "description", "system_size_kw", "price", "number_of_panels", "battery_included", "warranty_years", "image_url", "is_active"],
    })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setRows(payload.data);
        setPagination(payload.pagination);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(loadError, "Packages could not be loaded."));
        setRows([]);
        setPagination(emptyPagination);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deferredQuery, page, refreshKey]);

  const activePackages = rows.filter((pkg) => pkg.is_active).length;
  const batteryIncluded = rows.filter((pkg) => pkg.battery_included).length;
  const notice = searchParams.get("created") ? "Package saved successfully." : searchParams.get("draft") ? "Package draft saved." : null;

  async function handleDeletePackage(pkg: PackageRecord) {
    try {
      await deletePackage(pkg.id);
      toast({
        title: "Package deleted",
        description: `${pkg.name} was removed successfully.`,
        variant: "success",
      });

      if (rows.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch (deleteError) {
      if (isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The package could not be deleted."),
        variant: "error",
      });
    }
  }

  return (
    <div className="dashboard-stack">
      <PackageMetricsStrip total={pagination.total} active={activePackages} batteryIncluded={batteryIncluded} />
      {notice ? <InlineCallout>{notice}</InlineCallout> : null}
      <Panel className="overflow-hidden">
        <div className="management-surface__body">
          <DirectoryToolbar
            searchValue={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search packages..."
            filters={
              <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                Filter
              </Button>
            }
            action={canCreateBundles ? <ActionLink href="/packages/new" leadingIcon={<PlusIcon className="mini-icon" />}>Add New Package</ActionLink> : undefined}
          />
        </div>
        <ErrorMessage title="Package load failed" message={error} />
        {!isLoading && !rows.length && !error ? (
          <div className="p-6">
            <EmptyScaffold title="No packages found" description="No record found on the database" />
          </div>
        ) : (
          <>
            <div className="catalog-grid-wrap">
              <div className="catalog-grid">
                {rows.length ? (
                  rows.map((pkg) => {
                    const status = pkg.is_active ? "Active" : "Inactive";

                    return (
                      <CatalogCard
                        key={pkg.id}
                        href={`/packages/${pkg.slug}`}
                        image={pkg.image_url || ""}
                        title={pkg.name}
                        eyebrow={`${pkg.system_size_kw}kW package`}
                        price={formatCurrencyLabel(pkg.price)}
                        summary={pkg.description || "No package description available."}
                        status={<StatusPill label={status} tone={toneFromStatus(status)} solid={false} />}
                        stats={[
                          { label: "Panels", value: String(pkg.number_of_panels), progress: Math.min(Math.max(pkg.number_of_panels * 12, 8), 100) },
                          { label: "Warranty", value: `${pkg.warranty_years} years`, progress: Math.min(Math.max(pkg.warranty_years * 10, 8), 100) },
                        ]}
                        actions={
                          <TableActionsMenu
                            items={[
                              { label: "View Package", href: `/packages/${pkg.slug}` },
                              ...(canDeleteBundles
                                ? [
                                    {
                                      label: "Delete Package",
                                      tone: "danger" as const,
                                      icon: <TrashIcon className="menu-icon" />,
                                      onSelect: () => handleDeletePackage(pkg),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        }
                      />
                    );
                  })
                ) : (
                  <div className="p-6">
                    <EmptyScaffold title="No packages matched" description="No record found on the database" />
                  </div>
                )}
              </div>
            </div>
            <Pagination page={page} totalPages={Math.max(pagination.totalPages, 1)} onChange={setPage} />
          </>
        )}
      </Panel>
    </div>
  );
}

export function BundleDetailScreen({ bundle }: { bundle: PackageRecord }) {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const router = useRouter();
  const [isActive, setIsActive] = useState(bundle.is_active);
  const [batteryIncluded, setBatteryIncluded] = useState(bundle.battery_included);
  const canUpdateBundles = can("bundles", "update");
  const canDeleteBundles = can("bundles", "delete");
  const status = isActive ? "Active" : "Inactive";

  async function handleToggleStatus() {
    try {
      await updatePackage(bundle.id, { is_active: !isActive });
      setIsActive((value) => !value);
      toast({
        title: "Package updated",
        description: `${bundle.name} is now ${!isActive ? "active" : "inactive"}.`,
        variant: "success",
      });
    } catch (updateError) {
      if (isDashboardSessionExpiredError(updateError)) {
        return;
      }

      toast({
        title: "Update failed",
        description: getErrorMessage(updateError, "The package status could not be updated."),
        variant: "error",
      });
    }
  }

  async function handleDelete() {
    try {
      await deletePackage(bundle.id);
      toast({
        title: "Package deleted",
        description: `${bundle.name} was removed successfully.`,
        variant: "success",
      });
      router.push("/packages");
    } catch (deleteError) {
      if (isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The package could not be deleted."),
        variant: "error",
      });
    }
  }

  return (
    <div className="dashboard-stack">
      <PackageMetricsStrip total={1} active={isActive ? 1 : 0} batteryIncluded={batteryIncluded ? 1 : 0} />
      <Panel className="product-detail-shell">
        <div className="product-detail-shell__header">
          <ManagementBackLink href="/packages" label={bundle.name} meta={`Updated ${formatDateLabel(bundle.updated_at)}`} />
          <TableActionsMenu
            items={[
              ...(canUpdateBundles ? [{ label: isActive ? "Deactivate Package" : "Activate Package", onSelect: handleToggleStatus }] : []),
              ...(canDeleteBundles ? [{ label: "Delete Package", tone: "danger" as const, icon: <TrashIcon className="menu-icon" />, onSelect: handleDelete }] : []),
            ]}
          />
        </div>

        <div className="bundle-detail-grid">
          <DetailPanel title="Package Information">
            <KeyValueList
              items={[
                { label: "Package Id", value: bundle.id },
                { label: "Slug", value: bundle.slug },
                { label: "Price", value: formatCurrencyLabel(bundle.price) },
                { label: "Status", value: <StatusPill label={status} tone={toneFromStatus(status)} /> },
                { label: "System Size", value: `${bundle.system_size_kw}kW` },
                { label: "Warranty", value: `${bundle.warranty_years} years` },
              ]}
            />
            <div className="detail-panel__stack">
              <div className="toggle-row">
                <div>
                  <strong>Battery Included</strong>
                  <p>{batteryIncluded ? "Included in this package." : "Not included in this package."}</p>
                </div>
                <button type="button" className={`settings-switch ${batteryIncluded ? "is-active" : ""}`} onClick={() => setBatteryIncluded((value) => !value)} disabled>
                  <span className="settings-switch__thumb" />
                </button>
              </div>
              <div>
                <p className="section-description">Configuration</p>
                <KeyValueList
                  items={[
                    { label: "Panel Type", value: bundle.panel_type || "N/A" },
                    { label: "Inverter Type", value: bundle.inverter_type || "N/A" },
                    { label: "Number of Panels", value: String(bundle.number_of_panels) },
                  ]}
                />
              </div>
            </div>
          </DetailPanel>

          <DetailPanel title="Package Overview" description={bundle.description || "No package description available."}>
            <div className="detail-panel__stack">
              <KeyValueList
                items={[
                  { label: "Category Id", value: bundle.category_id || "N/A" },
                  { label: "Estimated Monthly Savings", value: bundle.estimated_savings_monthly ? formatCurrencyLabel(bundle.estimated_savings_monthly) : "N/A" },
                  { label: "Payback Period", value: bundle.payback_period_years ? `${bundle.payback_period_years} years` : "N/A" },
                  { label: "Created", value: formatDateLabel(bundle.created_at) },
                ]}
              />
            </div>
          </DetailPanel>

          <DetailPanel title="Media">
            <div className="detail-panel__stack">
              <MediaShowcase title={bundle.name} image={bundle.image_url || ""} gallery={bundle.image_url ? [bundle.image_url] : []} />
              <AttachmentItem label={bundle.image_url || "No image URL available"} helper="Primary Image" />
            </div>
          </DetailPanel>
        </div>
      </Panel>
    </div>
  );
}

export function BundleFormScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [systemSizeKw, setSystemSizeKw] = useState("");
  const [price, setPrice] = useState("");
  const [numberOfPanels, setNumberOfPanels] = useState("");
  const [panelType, setPanelType] = useState("mono");
  const [inverterType, setInverterType] = useState("hybrid");
  const [batteryIncluded, setBatteryIncluded] = useState(true);
  const [warrantyYears, setWarrantyYears] = useState("");
  const [estimatedSavingsMonthly, setEstimatedSavingsMonthly] = useState("");
  const [paybackPeriodYears, setPaybackPeriodYears] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [categoryOptions, setCategoryOptions] = useState<ProductCategoryApiRecord[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getProductCategories({
      page: 1,
      limit: 100,
      fields: ["id", "name"],
    })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setCategoryOptions(payload.data);
      })
      .catch(() => {
        if (!cancelled) {
          setCategoryOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCategories(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function navigateWith(flag: "draft" | "created") {
    startTransition(() => {
      router.push(`/packages?${flag}=1`);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = getFormSubmitIntent(event, "finish");
    const draft = intent === "draft";
    setIsSubmitting(true);

    try {
      await createPackage({
        slug: slug.trim(),
        name: name.trim(),
        description: description.trim(),
        category_id: categoryId || null,
        system_size_kw: Number(systemSizeKw),
        price: Number(price),
        number_of_panels: Number(numberOfPanels),
        panel_type: panelType.trim(),
        inverter_type: inverterType.trim(),
        battery_included: batteryIncluded,
        warranty_years: Number(warrantyYears),
        estimated_savings_monthly: Number(estimatedSavingsMonthly || 0),
        payback_period_years: Number(paybackPeriodYears || 0),
        image_url: imageUrl.trim(),
        is_active: draft ? false : isActive,
      });

      navigateWith(draft ? "draft" : "created");
    } catch (saveError) {
      if (isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: "Create package failed",
        description: getErrorMessage(saveError, "The package could not be created."),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dashboard-stack">
      <PackageMetricsStrip total={0} active={0} batteryIncluded={batteryIncluded ? 1 : 0} />
      <Panel className="product-form-shell">
        <form id={packageCreateFormId} onSubmit={handleSubmit}>
          <div className="product-form-shell__header">
            <div>
              <h2 className="section-title">Add A New Package</h2>
              <p className="section-description">Create a package with pricing, sizing, category mapping, and availability settings.</p>
            </div>
            <FormSubmitter
              formId={packageCreateFormId}
              cancelLabel="Cancel"
              onCancel={() => router.push("/packages")}
              primaryLabel={isSubmitting ? "Saving..." : "Finish"}
              primaryIntent="finish"
              disabled={isSubmitting}
              secondaryActions={[
                { label: "Save to Draft", intent: "draft", variant: "secondary", disabled: isSubmitting },
                { label: "Finish & Publish", intent: "finish-publish", variant: "primary", disabled: isSubmitting },
              ]}
            />
          </div>

          <div className="product-form-grid">
            <DetailPanel title="Package Information" description="Set the package name, pricing, and availability.">
              <div className="detail-panel__stack">
                <FormField label="Slug">
                  <TextField value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="starter-package" />
                </FormField>
                <FormField label="Package Name">
                  <TextField value={name} onChange={(event) => setName(event.target.value)} placeholder="Starter Package" />
                </FormField>
                <FormField label="Description">
                  <TextAreaField value={description} onChange={setDescription} placeholder="Entry package for small homes" rows={6} />
                </FormField>
                <FormField label="Category">
                  <SelectField
                    value={categoryId}
                    onChange={setCategoryId}
                    options={[
                      { label: isLoadingCategories ? "Loading categories..." : "No category", value: "" },
                      ...categoryOptions.map((category) => ({ label: category.name, value: category.id })),
                    ]}
                  />
                </FormField>
                <div className="product-inline-row is-three">
                  <FormField label="System Size (kW)">
                    <TextField value={systemSizeKw} onChange={(event) => setSystemSizeKw(event.target.value)} placeholder="3.5" />
                  </FormField>
                  <FormField label="Price">
                    <TextField value={price} onChange={(event) => setPrice(event.target.value)} placeholder="250000" />
                  </FormField>
                  <FormField label="Warranty Years">
                    <TextField value={warrantyYears} onChange={(event) => setWarrantyYears(event.target.value)} placeholder="2" />
                  </FormField>
                </div>
                <div className="product-inline-row is-three">
                  <FormField label="Number of Panels">
                    <TextField value={numberOfPanels} onChange={(event) => setNumberOfPanels(event.target.value)} placeholder="4" />
                  </FormField>
                  <FormField label="Panel Type">
                    <TextField value={panelType} onChange={(event) => setPanelType(event.target.value)} placeholder="mono" />
                  </FormField>
                  <FormField label="Inverter Type">
                    <TextField value={inverterType} onChange={(event) => setInverterType(event.target.value)} placeholder="hybrid" />
                  </FormField>
                </div>
              </div>
            </DetailPanel>

            <DetailPanel title="Financial Projections" description="Optional savings and payback fields for the package.">
              <div className="detail-panel__stack">
                <div className="product-inline-row is-two">
                  <FormField label="Estimated Savings Monthly">
                    <TextField value={estimatedSavingsMonthly} onChange={(event) => setEstimatedSavingsMonthly(event.target.value)} placeholder="0" />
                  </FormField>
                  <FormField label="Payback Period Years">
                    <TextField value={paybackPeriodYears} onChange={(event) => setPaybackPeriodYears(event.target.value)} placeholder="0" />
                  </FormField>
                </div>
                <FormField label="Image URL">
                  <TextField value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://example.com/package.png" />
                </FormField>
                <div className="toggle-row">
                  <div>
                    <strong>Battery Included</strong>
                    <p>Toggle whether this package includes battery storage.</p>
                  </div>
                  <button type="button" className={`settings-switch ${batteryIncluded ? "is-active" : ""}`} onClick={() => setBatteryIncluded((value) => !value)}>
                    <span className="settings-switch__thumb" />
                  </button>
                </div>
                <div className="toggle-row">
                  <div>
                    <strong>Package Active</strong>
                    <p>Inactive packages are still created but will not show as active in the list.</p>
                  </div>
                  <button type="button" className={`settings-switch ${isActive ? "is-active" : ""}`} onClick={() => setIsActive((value) => !value)}>
                    <span className="settings-switch__thumb" />
                  </button>
                </div>
              </div>
            </DetailPanel>
          </div>
        </form>
      </Panel>
    </div>
  );
}
