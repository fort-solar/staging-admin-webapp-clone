"use client";

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { EyeIcon } from "@/components/dashboard/icons";
import { FormField, Modal } from "@/components/dashboard/modals";
import { Button, Checkbox, EmptyScaffold, MetricCardSecondary, Pagination, Panel, PanelHeader, SearchField, SelectField, StatusPill, TableActionsMenu, TextAreaField } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { DEFAULT_PAGE_SIZE, formatDateTimeLabel, formatEnumLabel, getBundleRequests, updateBundleRequest } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { BundleRequestRecord, PaginationMeta } from "@/types/api.types";

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

export default function BundleRequestPage() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const [rows, setRows] = useState<BundleRequestRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailStatus, setDetailStatus] = useState("");
  const [detailAdminNote, setDetailAdminNote] = useState("");
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

    getBundleRequests({ page, limit: DEFAULT_PAGE_SIZE })
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

        setError(getErrorMessage(loadError, "Package requests could not be loaded."));
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
  }, [page, refreshKey]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const statusLabel = formatEnumLabel(row.status);
        const orderStatusLabel = formatEnumLabel(row.order_status);
        const haystack = [row.id, row.order_id, row.bundle_id, row.bundle_name, row.admin_note ?? "", statusLabel, orderStatusLabel]
          .join(" ")
          .toLowerCase();
        const matchesQuery = haystack.includes(deferredQuery.toLowerCase());
        const matchesStatus = status === "All" || statusLabel === status;
        return matchesQuery && matchesStatus;
      }),
    [deferredQuery, rows, status],
  );

  const activeRequest = rows.find((row) => row.id === detailId) ?? null;
  const statusOptions = useMemo(() => ["All", ...Array.from(new Set(rows.map((row) => formatEnumLabel(row.status))))], [rows]);
  const detailStatusOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.status).concat(["pending", "approved", "rejected"]))),
    [rows],
  );

  useEffect(() => {
    if (!activeRequest) {
      setDetailStatus("");
      setDetailAdminNote("");
      return;
    }

    setDetailStatus(activeRequest.status);
    setDetailAdminNote(activeRequest.admin_note ?? "");
  }, [activeRequest]);

  const pendingCount = rows.filter((row) => row.status.toLowerCase() === "pending").length;
  const approvedCount = rows.filter((row) => row.status.toLowerCase() === "approved").length;
  const completedOrdersCount = rows.filter((row) => row.order_status.toLowerCase() === "completed").length;

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
      });

      toast({
        title: "Package request updated",
        description: `${activeRequest.bundle_name} was updated successfully.`,
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
        description: getErrorMessage(saveError, "The package request could not be updated."),
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="dashboard-stack">
        <section className="stats-grid--four">
          <MetricCardSecondary title="Total Requests" value={pagination.total.toLocaleString()} icon="bundles" spark={[18, 24, 32, 44, 52, 60]} />
          <MetricCardSecondary title="Pending On This Page" value={pendingCount.toLocaleString()} icon="orders" spark={[30, 26, 22, 18, 16, 14]} />
          <MetricCardSecondary title="Approved On This Page" value={approvedCount.toLocaleString()} icon="verification" spark={[12, 18, 24, 34, 44, 54]} />
          <MetricCardSecondary title="Completed Parent Orders" value={completedOrdersCount.toLocaleString()} icon="installers" spark={[24, 26, 32, 40, 48, 54]} />
        </section>

        <Panel className="overflow-hidden">
          <PanelHeader title="Request List" />
          <div className="dashboard-table-toolbar">
            <SearchField value={query} onChange={setQuery} placeholder="Search package requests..." />
            <div className="inline-actions">
              <SelectField value={status} onChange={setStatus} options={statusOptions} />
            </div>
          </div>

          <ErrorMessage title="Package request load failed" message={error} className="mx-6 mt-4" />

          {!isLoading && !rows.length && !error ? (
            <div className="p-6">
              <EmptyScaffold title="No package requests found" description="No record found on the database" />
            </div>
          ) : (
            <>
              <div className="table-scroll pt-2">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th className="table-checkbox-cell">
                        <Checkbox />
                      </th>
                      <th>Package</th>
                      <th>Request ID</th>
                      <th>Order ID</th>
                      <th>Order Status</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Admin Note</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length ? (
                      filteredRows.map((row) => (
                        <tr key={row.id}>
                          <td className="table-checkbox-cell">
                            <Checkbox />
                          </td>
                          <td>{row.bundle_name}</td>
                          <td>{row.id}</td>
                          <td>{row.order_id}</td>
                          <td>
                            <StatusPill label={formatEnumLabel(row.order_status)} tone={toneFromStatus(row.order_status)} solid={false} />
                          </td>
                          <td>{formatDateTimeLabel(row.created_at)}</td>
                          <td>
                            <StatusPill label={formatEnumLabel(row.status)} tone={toneFromStatus(row.status)} />
                          </td>
                          <td>{row.admin_note || "N/A"}</td>
                          <td>
                            <div className="inline-actions justify-end">
                              <Button variant="secondary" size="sm" leadingIcon={<EyeIcon className="mini-icon" />} onClick={() => setDetailId(row.id)}>
                                View
                              </Button>
                              <TableActionsMenu
                                items={[
                                  { label: canUpdateOrders ? "View / Edit Request" : "View Request", icon: <EyeIcon className="menu-icon" />, onSelect: () => setDetailId(row.id) },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="cell-subtle">
                          {isLoading ? "Loading package requests..." : "No package requests matched the current filters."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={Math.max(pagination.totalPages, 1)} onChange={setPage} />
            </>
          )}
        </Panel>
      </div>

      <Modal
        open={Boolean(activeRequest)}
        onClose={() => !isSaving && setDetailId(null)}
        title={activeRequest?.bundle_name ?? "Package Request"}
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
              <p className="m-0 text-sm font-semibold text-(--brand)">Package Request</p>
              <h3 className="m-0 pt-2 text-2xl font-extrabold sm:text-[28px]">{activeRequest.bundle_name}</h3>
              <p className="m-0 pt-2 text-sm text-(--text-soft)">Review the linked order state and update the package request status or admin note.</p>
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
                  <strong>{formatEnumLabel(activeRequest.status)}</strong>
                </div>
                <div>
                  <p className="cell-subtle">Admin Note</p>
                  <strong>{activeRequest.admin_note || "N/A"}</strong>
                </div>
              </div>
            )}
          </form>
        ) : null}
      </Modal>
    </>
  );
}
