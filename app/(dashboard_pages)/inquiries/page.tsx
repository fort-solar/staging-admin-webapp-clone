"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormField, Modal } from "@/components/dashboard/modals";
import { EyeIcon } from "@/components/dashboard/icons";
import {
  EmptyScaffold,
  MetricCardSecondary,
  Pagination,
  Panel,
  PanelHeader,
  SearchField,
  SelectField,
  StatusPill,
  TextAreaField,
} from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import {
  DEFAULT_PAGE_SIZE,
  formatDateTimeLabel,
  getContactInquiries,
  updateContactInquiryStatus,
} from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import type { ContactInquiryRecord, PaginationMeta } from "@/types/api.types";

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

const statusFilterOptions = ["All", "new", "read", "replied", "resolved"];
const statusUpdateOptions = ["new", "read", "replied", "resolved"];

function toneFromInquiryStatus(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status.toLowerCase()) {
    case "new":
      return "warning";
    case "read":
      return "info";
    case "replied":
      return "success";
    case "resolved":
      return "neutral";
    default:
      return "neutral";
  }
}

export default function InquiriesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ContactInquiryRecord[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<ContactInquiryRecord | null>(null);
  const [modalStatus, setModalStatus] = useState("new");
  const [modalNotes, setModalNotes] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    const status = statusFilter === "All" ? undefined : statusFilter;

    getContactInquiries({
      page,
      limit,
      search: deferredQuery.trim() || undefined,
      status,
    })
      .then((payload) => {
        if (cancelled) return;

        const list = Array.isArray(payload.data) ? payload.data : [];
        setRows(list);
        setPagination(payload.pagination ?? emptyPagination);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, limit, statusFilter, deferredQuery, refreshKey]);

  function handleOpenModal(inquiry: ContactInquiryRecord) {
    setSelectedInquiry(inquiry);
    setModalStatus(inquiry.status || "new");
    setModalNotes(inquiry.notes || "");
  }

  function handleCloseModal() {
    setSelectedInquiry(null);
  }

  async function handleSaveStatus() {
    if (!selectedInquiry) return;

    try {
      setIsUpdatingStatus(true);
      await updateContactInquiryStatus(selectedInquiry.id, {
        status: modalStatus,
        adminNotes: modalNotes.trim() || undefined,
      });

      toast({
        title: "Status updated",
        description: `Inquiry status changed to ${modalStatus}.`,
        variant: "success",
      });

      handleCloseModal();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast({
        title: "Update failed",
        description: getErrorMessage(err),
        variant: "error",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  const newCount = rows.filter((r) => r.status.toLowerCase() === "new").length;
  const resolvedCount = rows.filter(
    (r) => r.status.toLowerCase() === "replied" || r.status.toLowerCase() === "resolved"
  ).length;

  return (
    <div className="dashboard-stack">
      <section className="stats-grid--three">
        <MetricCardSecondary
          title="Total Inquiries"
          value={pagination.total.toLocaleString()}
          icon="customers"
          spark={[14, 22, 28, 36, 48, 60]}
        />
        <MetricCardSecondary
          title="New / Unaddressed"
          value={newCount.toLocaleString()}
          icon="notifications"
          spark={[5, 8, 12, 10, 14, 18]}
        />
        <MetricCardSecondary
          title="Replied / Resolved"
          value={resolvedCount.toLocaleString()}
          icon="verification"
          spark={[9, 14, 16, 26, 34, 42]}
        />
      </section>

      <Panel className="overflow-hidden">
        <PanelHeader title="Customer Inquiries (Contact Us Messages)" />

        <div className="dashboard-table-toolbar">
          <SearchField
            value={query}
            onChange={(val) => {
              setQuery(val);
              setPage(1);
            }}
            placeholder="Search by name, email, subject, or message..."
          />
          <div className="inline-actions">
            <SelectField
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
              options={statusFilterOptions}
            />
          </div>
        </div>

        <ErrorMessage title="Inquiries load failed" message={error} className="mx-6 mt-4" />

        {!isLoading && !rows.length && !error ? (
          <div className="p-6">
            <EmptyScaffold
              title="No inquiries found"
              description="Customer contact form submissions from fortsolar.ng will appear here."
            />
          </div>
        ) : (
          <>
            <div className="table-scroll pt-2">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Subject</th>
                    <th>Received Date</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? (
                    rows.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="flex flex-col">
                            <strong className="text-neutral-900">{item.name}</strong>
                            <span className="text-xs text-neutral-500">{item.email}</span>
                          </div>
                        </td>
                        <td>{item.phone || "—"}</td>
                        <td>
                          <span className="max-w-xs truncate font-medium text-neutral-800">
                            {item.subject || "No Subject"}
                          </span>
                        </td>
                        <td>{formatDateTimeLabel(item.created_at)}</td>
                        <td>
                          <StatusPill
                            label={item.status.toUpperCase()}
                            tone={toneFromInquiryStatus(item.status)}
                          />
                        </td>
                        <td>
                          <div className="inline-actions justify-end">
                            <button
                              type="button"
                              className="action-button is-secondary is-sm flex items-center gap-1.5"
                              onClick={() => handleOpenModal(item)}
                            >
                              <EyeIcon className="h-3.5 w-3.5" />
                              <span>View Message</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="cell-subtle">
                        <div className="flex flex-col items-center gap-3 py-6 text-center">
                          <span>{isLoading ? "Loading inquiries..." : "No messages matched the current filter."}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={pagination.page}
              totalPages={Math.max(1, pagination.totalPages)}
              onChange={setPage}
              limit={limit}
              onLimitChange={setLimit}
            />
          </>
        )}
      </Panel>

      {/* Inquiry Detail Modal */}
      {selectedInquiry ? (
        <Modal
          open={Boolean(selectedInquiry)}
          onClose={handleCloseModal}
          title={`Inquiry from ${selectedInquiry.name}`}
          size="lg"
          footer={
            <div className="flex w-full items-center justify-between">
              <button
                type="button"
                className="action-button is-secondary"
                onClick={handleCloseModal}
              >
                Close
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                className="action-button is-primary"
                onClick={handleSaveStatus}
              >
                {isUpdatingStatus ? "Saving..." : "Update Status"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500">Sender</p>
                <p className="font-medium text-neutral-900">{selectedInquiry.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500">Email</p>
                <a
                  href={`mailto:${selectedInquiry.email}`}
                  className="font-medium text-green-700 hover:underline"
                >
                  {selectedInquiry.email}
                </a>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500">Phone</p>
                <p className="font-medium text-neutral-900">{selectedInquiry.phone || "—"}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500">Subject</p>
              <p className="font-semibold text-neutral-900 text-base">{selectedInquiry.subject || "No Subject"}</p>
              <p className="text-xs text-neutral-400 mt-0.5">Received: {formatDateTimeLabel(selectedInquiry.created_at)}</p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase text-neutral-500 mb-2">Message Content</p>
              <p className="text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed">
                {selectedInquiry.message}
              </p>
            </div>

            <div className="border-t border-neutral-200 pt-4 space-y-3">
              <FormField label="Update Status">
                <SelectField
                  value={modalStatus}
                  onChange={setModalStatus}
                  options={statusUpdateOptions}
                />
              </FormField>

              <FormField label="Internal Admin Notes" hint="Optional notes for your team">
                <TextAreaField
                  value={modalNotes}
                  onChange={setModalNotes}
                  placeholder="Record follow-up notes, phone call outcome, or quote details..."
                  rows={3}
                />
              </FormField>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
