"use client";

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { EyeIcon } from "@/components/dashboard/icons";
import { FormField, Modal } from "@/components/dashboard/modals";
import { Button, Checkbox, EmptyScaffold, MetricCardSecondary, Pagination, Panel, PanelHeader, SearchField, SelectField, StatusPill, TableActionsMenu, TextAreaField, TextField } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { DEFAULT_PAGE_SIZE, formatDateTimeLabel, formatEnumLabel, getBundleRequests, updateBundleRequest, updateJob } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { BundleRequestRecord, PaginationMeta } from "@/types/api.types";

const packageLifecycleStatuses = [
  "processing",
  "packed",
  "installer_assigned",
  "installer_in_transit",
  "system_installed",
  "installation_verified",
  "closed",
  "cancelled",
] as const;

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

function mapPackageStatusToJobStatus(status: string) {
  const normalized = status.trim().toLowerCase();

  switch (normalized) {
    case "processing":
    case "packed":
      return "open";
    case "installer_assigned":
      return "assigned";
    case "installer_in_transit":
      return "in_progress";
    case "system_installed":
      return "completed";
    case "installation_verified":
      return "verified";
    case "closed":
      return "closed";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

export default function FinanceRequestPage() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const [rows, setRows] = useState<BundleRequestRecord[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailStatus, setDetailStatus] = useState("");
  const [detailAdminNote, setDetailAdminNote] = useState("");
  const [financingStatus, setFinancingStatus] = useState("");
  const [downpaymentAmount, setDownpaymentAmount] = useState<number | "">("");
  const [installment, setInstallment] = useState<number | "">("");
  const [tenure, setTenure] = useState<number | "">("");
  const [loanAmount, setLoanAmount] = useState<number | "">("");
  const [interestType, setInterestType] = useState<"fixed" | "reducing">("fixed");
  const [interestRate, setInterestRate] = useState<number | "">("");
  const [expectedPaymentDay, setExpectedPaymentDay] = useState<number | "">("");
  const [financeCompanyName, setFinanceCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const canUpdateOrders = can("orders", "update");

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getBundleRequests({
      page,
      limit,
      search: deferredQuery.trim() || undefined,
      q: deferredQuery.trim() || undefined,
      financing_requested: true,
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

        setError(getErrorMessage(loadError, "Finance requests could not be loaded."));
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
  }, [deferredQuery, page, limit, refreshKey]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const financingStatusVal = row.financing_status || "pending_review";
        const matchesStatus = statusFilter === "All" || financingStatusVal === statusFilter;
        return matchesStatus;
      }),
    [rows, statusFilter],
  );

  const activeRequest = rows.find((row) => row.id === detailId) ?? null;
  const detailStatusOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.status).concat([...packageLifecycleStatuses]))),
    [rows],
  );

  const statusFilterOptions = [
    { label: "All Statuses", value: "All" },
    { label: "Pending Review", value: "pending_review" },
    { label: "Partner Submitted", value: "partner_submitted" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
    { label: "Approved & Processed", value: "processed" },
  ];

  useEffect(() => {
    if (!activeRequest) {
      setDetailStatus("");
      setDetailAdminNote("");
      setFinancingStatus("");
      setDownpaymentAmount("");
      setInstallment("");
      setTenure("");
      setLoanAmount("");
      setInterestType("fixed");
      setInterestRate("");
      setExpectedPaymentDay("");
      setFinanceCompanyName("");
      return;
    }

    setDetailStatus(activeRequest.status);
    setDetailAdminNote(activeRequest.admin_note ?? "");
    setFinancingStatus(activeRequest.financing_status ?? "pending_review");
    setDownpaymentAmount(activeRequest.financing_terms?.downpayment_amount ?? "");
    setInstallment(activeRequest.financing_terms?.installment ?? "");
    setTenure(activeRequest.financing_terms?.tenure ?? "");
    setLoanAmount(activeRequest.financing_terms?.loan_amount ?? "");
    setInterestType((activeRequest.financing_terms?.interest_type as any) ?? "fixed");
    setInterestRate(activeRequest.financing_terms?.interest_rate ?? "");
    setExpectedPaymentDay(activeRequest.financing_terms?.expected_payment_day ?? "");
    setFinanceCompanyName(activeRequest.financing_terms?.finance_company_name ?? "");
  }, [activeRequest]);

  const pendingAssessmentCount = rows.filter((row) => !row.financing_status || row.financing_status === "pending_review").length;
  const partnerSubmittedCount = rows.filter((row) => row.financing_status === "partner_submitted").length;
  const approvedCount = rows.filter((row) => row.financing_status === "approved" || row.financing_status === "processed").length;

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeRequest) {
      return;
    }

    setIsSaving(true);

    try {
      await updateBundleRequest(activeRequest.id, {
        status: detailStatus,
        admin_note: detailAdminNote,
        financing_status: financingStatus,
        financing_terms: {
          downpayment_amount: downpaymentAmount !== "" ? Number(downpaymentAmount) : undefined,
          installment: installment !== "" ? Number(installment) : undefined,
          tenure: tenure !== "" ? Number(tenure) : undefined,
          loan_amount: loanAmount !== "" ? Number(loanAmount) : undefined,
          interest_type: interestType,
          interest_rate: interestRate !== "" ? Number(interestRate) : undefined,
          expected_payment_day: expectedPaymentDay !== "" ? Number(expectedPaymentDay) : undefined,
          finance_company_name: financeCompanyName || undefined,
        },
      });

      const nextJobStatus = mapPackageStatusToJobStatus(detailStatus);
      if (activeRequest.job_id && nextJobStatus && nextJobStatus !== activeRequest.job_status) {
        await updateJob(activeRequest.job_id, {
          status: nextJobStatus,
          package_request_id: activeRequest.id,
        });
      }

      toast({
        title: "Finance request updated",
        description: `${activeRequest.bundle_name} financing details updated successfully.`,
        variant: "success",
      });
      setDetailId(null);
      setRefreshKey((value) => value + 1);
    } catch (saveError) {
      if (isDashboardActionCancelledError(saveError) || isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: "Update failed",
        description: getErrorMessage(saveError, "The finance request could not be updated."),
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="dashboard-stack">
        <section className="stats-grid--three">
          <MetricCardSecondary title="Total Finance Requests" value={pagination.total.toLocaleString()} icon="bundles" spark={[18, 24, 32, 44, 52, 60]} />
          <MetricCardSecondary title="Pending Assessment" value={pendingAssessmentCount.toLocaleString()} icon="orders" spark={[30, 26, 22, 18, 16, 14]} />
          <MetricCardSecondary title="Approved Loans" value={approvedCount.toLocaleString()} icon="verification" spark={[12, 18, 24, 34, 44, 54]} />
        </section>

        <Panel className="overflow-hidden">
          <PanelHeader title="Finance Requests List" />
          <div className="dashboard-table-toolbar">
            <SearchField
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="Search finance requests..."
            />
            <div className="inline-actions">
              <SelectField value={statusFilter} onChange={setStatusFilter} options={statusFilterOptions} />
            </div>
          </div>

          <ErrorMessage title="Finance request load failed" message={error} className="mx-6 mt-4" />

          {!isLoading && !rows.length && !error ? (
            <div className="p-6">
              <EmptyScaffold title="No finance requests found" description="No financing request record found on the database" />
            </div>
          ) : (
            <>
              <div className="table-scroll pt-2">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th className="table-checkbox-cell">
                        <Checkbox
                          checked={filteredRows.length > 0 && selectedIds.length === filteredRows.length}
                          onChange={(checked) => setSelectedIds(checked ? filteredRows.map(r => r.id) : [])}
                        />
                      </th>
                      <th>Package</th>
                      <th>Request ID</th>
                      <th>Buyer</th>
                      <th>Profile Type</th>
                      <th>Created</th>
                      <th>Financing Status</th>
                      <th>Admin Note</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length ? (
                      filteredRows.map((row) => (
                        <tr key={row.id}>
                          <td className="table-checkbox-cell">
                            <Checkbox
                              checked={selectedIds.includes(row.id)}
                              onChange={(checked) => setSelectedIds(checked ? [...selectedIds, row.id] : selectedIds.filter(id => id !== row.id))}
                            />
                          </td>
                          <td>{row.bundle_name}</td>
                          <td>{row.id}</td>
                          <td>
                            <div className="flex flex-col">
                              <span className="font-semibold">{row.customer_name || "N/A"}</span>
                              <span className="text-xs text-neutral-500">{row.customer_email || "N/A"}</span>
                            </div>
                          </td>
                          <td className="capitalize">
                            {row.financing_profile_type
                              ? row.financing_profile_type.replace("_", " ")
                              : "Not specified"}
                          </td>
                          <td>{formatDateTimeLabel(row.created_at)}</td>
                          <td>
                            <StatusPill
                              label={formatEnumLabel(row.financing_status || "pending_review")}
                              tone={toneFromStatus(row.financing_status || "pending_review")}
                            />
                          </td>
                          <td>{row.admin_note || "N/A"}</td>
                          <td>
                            <div className="inline-actions justify-end">
                              <Button variant="secondary" size="sm" leadingIcon={<EyeIcon className="mini-icon" />} onClick={() => setDetailId(row.id)}>
                                View
                              </Button>
                              <TableActionsMenu
                                items={[
                                  { label: canUpdateOrders ? "View / Edit Application" : "View Application", icon: <EyeIcon className="menu-icon" />, onSelect: () => setDetailId(row.id) },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="cell-subtle">
                          {isLoading ? "Loading finance requests..." : "No finance requests matched the current filters."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                totalPages={Math.max(pagination.totalPages, 1)}
                onChange={setPage}
                limit={limit}
                onLimitChange={(n) => {
                  setLimit(n);
                  setPage(1);
                }}
              />
            </>
          )}
        </Panel>
      </div>

      <Modal
        open={Boolean(activeRequest)}
        onClose={() => !isSaving && setDetailId(null)}
        title={activeRequest?.bundle_name ?? "Finance Application"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetailId(null)} disabled={isSaving}>
              Cancel
            </Button>
            {canUpdateOrders ? (
              <Button type="submit" form="bundle-request-update-form" variant="primary" disabled={isSaving || !activeRequest}>
                {isSaving ? "Saving..." : "Update"}
              </Button>
            ) : null}
          </>
        }
      >
        {activeRequest ? (
          <form id="bundle-request-update-form" className="flex flex-col gap-6" onSubmit={handleSave}>
            <div className="rounded-[20px] bg-(--surface-soft) p-5">
              <p className="m-0 text-sm font-semibold text-(--brand)">Financing Request & Application</p>
              <h3 className="m-0 pt-2 text-2xl font-extrabold sm:text-[28px]">{activeRequest.bundle_name}</h3>
              <p className="m-0 pt-2 text-sm text-(--text-soft)">Assess applicant documents and update loan conditions.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="cell-subtle">Request ID</p>
                <strong>{activeRequest.id}</strong>
              </div>
              <div>
                <p className="cell-subtle">Order ID</p>
                <strong>{activeRequest.order_id}</strong>
              </div>
              <div>
                <p className="cell-subtle">Package ID</p>
                <strong>{activeRequest.bundle_id}</strong>
              </div>
              <div>
                <p className="cell-subtle">Order Status</p>
                <strong>{formatEnumLabel(activeRequest.order_status)}</strong>
              </div>
              <div>
                <p className="cell-subtle">Created</p>
                <strong>{formatDateTimeLabel(activeRequest.created_at)}</strong>
              </div>
              <div>
                <p className="cell-subtle">Updated</p>
                <strong>{formatDateTimeLabel(activeRequest.updated_at)}</strong>
              </div>
              <div>
                <p className="cell-subtle">Customer</p>
                <strong>{activeRequest.customer_name || activeRequest.customer_email || "N/A"}</strong>
              </div>
              <div>
                <p className="cell-subtle">Location</p>
                <strong>{[activeRequest.city, activeRequest.state, activeRequest.country].filter(Boolean).join(", ") || "N/A"}</strong>
              </div>
              <div>
                <p className="cell-subtle">System Size</p>
                <strong>{activeRequest.system_size_kw ? `${activeRequest.system_size_kw} kW` : "N/A"}</strong>
              </div>
              <div>
                <p className="cell-subtle">Linked Job</p>
                <strong>{activeRequest.job_slug || activeRequest.job_id || "No job linked"}</strong>
              </div>
              <div>
                <p className="cell-subtle">Job Status</p>
                <strong>{activeRequest.job_status ? formatEnumLabel(activeRequest.job_status) : "N/A"}</strong>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="text-lg font-bold text-(--brand) mb-4">Financing Application Details</h4>
              <div className="grid gap-4 md:grid-cols-2 mb-6">
                <div>
                  <p className="cell-subtle">Verification Profile</p>
                  <strong className="capitalize">
                    {activeRequest.financing_profile_type
                      ? (activeRequest.financing_profile_type === "individual"
                        ? "Individual Applicant"
                        : activeRequest.financing_profile_type === "salary_earner"
                          ? "Salary Earner"
                          : "Registered Business / Corporate")
                      : activeRequest.financing_id_upload_id
                        ? (activeRequest.financing_cac_upload_id ? "Registered Business / Corporate" : "Individual")
                        : "Not specified"}
                  </strong>
                </div>
                <div>
                  <p className="cell-subtle">BVN (Bank Verification Number)</p>
                  <strong>{activeRequest.financing_bvn || "N/A"}</strong>
                </div>
                <div>
                  <p className="cell-subtle">NIN (National Identification Number)</p>
                  <strong>{activeRequest.financing_nin || "N/A"}</strong>
                </div>
                <div className="md:col-span-2">
                  <p className="cell-subtle">BVN Consent Status</p>
                  <strong>
                    {activeRequest.financing_bvn_consent ? (
                      <span className="text-green-600 font-semibold">✓ Authorized & Consented</span>
                    ) : (
                      <span className="text-red-500 font-semibold">✗ No Consent Provided</span>
                    )}
                  </strong>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 mb-6">
                {activeRequest.financing_id_upload_id && (
                  <a
                    href={`/api/proxy/api/v1/uploads/${activeRequest.financing_id_upload_id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg border bg-(--surface-soft) hover:bg-neutral-100 transition-colors text-sm"
                  >
                    <span className="font-semibold text-(--brand)">⬇ Download Gov ID</span>
                  </a>
                )}
                {activeRequest.financing_utility_bill_upload_id && (
                  <a
                    href={`/api/proxy/api/v1/uploads/${activeRequest.financing_utility_bill_upload_id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg border bg-(--surface-soft) hover:bg-neutral-100 transition-colors text-sm"
                  >
                    <span className="font-semibold text-(--brand)">⬇ Download Utility Bill</span>
                  </a>
                )}
                {activeRequest.financing_statement_upload_id && (
                  <a
                    href={`/api/proxy/api/v1/uploads/${activeRequest.financing_statement_upload_id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg border bg-(--surface-soft) hover:bg-neutral-100 transition-colors text-sm"
                  >
                    <span className="font-semibold text-(--brand)">⬇ Download 6-Month Bank Statement</span>
                  </a>
                )}
                {activeRequest.financing_cac_upload_id && (
                  <a
                    href={`/api/proxy/api/v1/uploads/${activeRequest.financing_cac_upload_id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg border bg-(--surface-soft) hover:bg-neutral-100 transition-colors text-sm"
                  >
                    <span className="font-semibold text-(--brand)">⬇ Download CAC Document</span>
                  </a>
                )}
              </div>

              {canUpdateOrders && (
                <div className="border-t pt-6 mb-6">
                  <h4 className="text-lg font-bold text-(--brand) mb-4">Financing Assessment Form</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Financing Status">
                      <SelectField
                        value={financingStatus}
                        onChange={setFinancingStatus}
                        options={[
                          { label: "Pending Review", value: "pending_review" },
                          { label: "Partner Submitted", value: "partner_submitted" },
                          { label: "Approved", value: "approved" },
                          { label: "Rejected", value: "rejected" },
                          { label: "Approved & Processed", value: "processed" },
                        ]}
                      />
                    </FormField>
                  </div>

                  {(financingStatus === "approved" || financingStatus === "processed") && (
                    <div className="grid gap-4 md:grid-cols-2 mt-4 border-t pt-4">
                      <FormField label="Loan Amount (₦)">
                        <TextField
                          value={String(loanAmount)}
                          onChange={(e) => setLoanAmount(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 1600000"
                          type="text"
                        />
                      </FormField>

                      <FormField label="Downpayment Amount (₦)">
                        <TextField
                          value={String(downpaymentAmount)}
                          onChange={(e) => setDownpaymentAmount(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 1000000"
                          type="text"
                        />
                      </FormField>

                      <FormField label="Tenure (Months)">
                        <TextField
                          value={String(tenure)}
                          onChange={(e) => setTenure(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 12"
                          type="text"
                        />
                      </FormField>

                      <FormField label="Interest Type">
                        <SelectField
                          value={interestType}
                          onChange={(val) => setInterestType(val as any)}
                          options={[
                            { label: "Flat Rate", value: "fixed" },
                            { label: "Reducing Balance", value: "reducing" },
                          ]}
                        />
                      </FormField>

                      <FormField label="Interest Rate (APR %)">
                        <TextField
                          value={String(interestRate)}
                          onChange={(e) => setInterestRate(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 20.0"
                          type="text"
                        />
                      </FormField>

                      <FormField label="Monthly Installment (₦)">
                        <TextField
                          value={String(installment)}
                          onChange={(e) => setInstallment(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 74000"
                          type="text"
                        />
                      </FormField>

                      <FormField label="Expected Payment Day of Month">
                        <TextField
                          value={String(expectedPaymentDay)}
                          onChange={(e) => setExpectedPaymentDay(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 25"
                          type="text"
                        />
                      </FormField>

                      <FormField label="Financing Company Name">
                        <TextField
                          value={financeCompanyName}
                          onChange={(e) => setFinanceCompanyName(e.target.value)}
                          placeholder="e.g. Altpower / Sterling Bank"
                          type="text"
                        />
                      </FormField>
                    </div>
                  )}
                </div>
              )}
            </div>

            {canUpdateOrders ? (
              <>
                <FormField label="Status">
                  <SelectField value={detailStatus} onChange={setDetailStatus} options={detailStatusOptions} />
                </FormField>

                <FormField label="Admin Note">
                  <TextAreaField value={detailAdminNote} onChange={setDetailAdminNote} placeholder="Enter an internal note for this request." rows={5} />
                </FormField>
              </>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="cell-subtle">Status</p>
                  <strong>{formatEnumLabel(detailStatus)}</strong>
                </div>
                <div>
                  <p className="cell-subtle">Admin Note</p>
                  <strong>{detailAdminNote || "N/A"}</strong>
                </div>
              </div>
            )}
          </form>
        ) : null}
      </Modal>
    </>
  );
}
