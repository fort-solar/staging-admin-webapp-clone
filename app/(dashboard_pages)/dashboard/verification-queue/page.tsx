"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { CheckCircleIcon, EyeIcon, XCircleIcon } from "@/components/dashboard/icons";
import { ApproveVerificationDialog, RejectVerificationDialog, VerificationDocumentsDialog } from "@/components/dashboard/verification-dialogs";
import { Avatar, Button, Checkbox, EmptyScaffold, Pagination, Panel, PanelHeader, SearchField, SelectField, StatusPill, TableActionsMenu } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { isDashboardSessionExpiredError } from "@/lib/api/client";
import { approveVerification, DEFAULT_PAGE_SIZE, formatDateTimeLabel, formatEnumLabel, getVerificationSubmission, getVerificationSubmissions, rejectVerification } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { PaginationMeta, VerificationSubmissionDetail, VerificationSubmissionRecord } from "@/types/api.types";

type ApprovalState = {
  ids: string[];
  submissionId?: string;
  title: string;
  description: string;
};

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

export default function VerificationQueuePage() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const [rows, setRows] = useState<VerificationSubmissionRecord[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [selected, setSelected] = useState<string[]>([]);
  const [documentsId, setDocumentsId] = useState<string | null>(null);
  const [documentDetail, setDocumentDetail] = useState<VerificationSubmissionDetail | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [approvalState, setApprovalState] = useState<ApprovalState | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const canUpdateVerificationQueue = can("verification_queue", "update");

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getVerificationSubmissions({ page, limit: DEFAULT_PAGE_SIZE })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setRows(payload.data);
        setPagination(payload.pagination);
        setSelected([]);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(loadError, "Verification submissions could not be loaded."));
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

  useEffect(() => {
    if (!documentsId) {
      setDocumentDetail(null);
      setDocumentsError(null);
      return;
    }

    let cancelled = false;

    setDocumentsLoading(true);
    setDocumentsError(null);

    getVerificationSubmission(documentsId)
      .then((payload) => {
        if (!cancelled) {
          setDocumentDetail(payload.data);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setDocumentsError(getErrorMessage(loadError, "Verification documents could not be loaded."));
          setDocumentDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDocumentsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [documentsId]);

  const filteredRows = useMemo(
    () =>
      rows.filter((item) => {
        const statusLabel = formatEnumLabel(item.status);
        const haystack = `${item.user_name} ${item.user_email} ${statusLabel}`.toLowerCase();
        const matchesQuery = haystack.includes(deferredQuery.toLowerCase());
        const matchesFilter = filter === "All" || statusLabel === filter;
        return matchesQuery && matchesFilter;
      }),
    [deferredQuery, filter, rows],
  );

  const selectedRows = useMemo(() => filteredRows.filter((row) => selected.includes(row.id)), [filteredRows, selected]);
  const selectedCount = selectedRows.length;
  const allSelected = filteredRows.length > 0 && filteredRows.every((row) => selected.includes(row.id));
  const pendingBulkIds = useMemo(() => {
    const scope = selectedCount > 0 ? selectedRows : filteredRows;
    return scope.filter((row) => row.status.toLowerCase() === "pending").map((row) => row.id);
  }, [filteredRows, selectedCount, selectedRows]);

  const approveActionLabel =
    allSelected || selectedCount === 0 ? "Approve All" : selectedCount === 1 ? "Approve" : "Approve Selected";

  const activeDocumentsSubmission = rows.find((row) => row.id === documentsId) ?? null;
  const activeApprovalSubmission = approvalState?.submissionId ? rows.find((row) => row.id === approvalState.submissionId) ?? null : null;
  const activeRejectSubmission = rows.find((row) => row.id === rejectId) ?? null;

  function openApproveDialog(ids: string[], submissionId?: string) {
    if (!ids.length) {
      return;
    }

    setApprovalState({
      ids,
      submissionId,
      title: ids.length > 1 ? `Approve ${ids.length} verifications?` : "Approve Verification?",
      description:
        ids.length > 1
          ? "This will approve every pending installer in the current selection."
          : "It is recommended to view the documents before approving any verification.",
    });
  }

  async function handleApprove() {
    if (!approvalState) {
      return;
    }

    try {
      await Promise.all(approvalState.ids.map((submissionId) => approveVerification(submissionId, { admin_note: "" })));
      toast({
        title: "Verification updated",
        description: approvalState.ids.length > 1 ? `${approvalState.ids.length} submissions were approved.` : "The verification submission was approved.",
        variant: "success",
      });
      setApprovalState(null);
      setSelected((current) => current.filter((entry) => !approvalState.ids.includes(entry)));
      setRefreshKey((value) => value + 1);
    } catch (approveError) {
      if (isDashboardSessionExpiredError(approveError)) {
        return;
      }

      toast({
        title: "Approval failed",
        description: getErrorMessage(approveError, "The verification submission could not be approved."),
        variant: "error",
      });
    }
  }

  async function handleReject() {
    if (!activeRejectSubmission) {
      return;
    }

    try {
      await rejectVerification(activeRejectSubmission.id, { admin_note: rejectNote.trim() });
      toast({
        title: "Verification rejected",
        description: `${activeRejectSubmission.user_name} was rejected successfully.`,
        variant: "success",
      });
      setRejectId(null);
      setRejectNote("");
      setRefreshKey((value) => value + 1);
    } catch (rejectError) {
      if (isDashboardSessionExpiredError(rejectError)) {
        return;
      }

      toast({
        title: "Rejection failed",
        description: getErrorMessage(rejectError, "The verification submission could not be rejected."),
        variant: "error",
      });
    }
  }

  return (
    <>
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Installer Verification Queue"
          action={
            canUpdateVerificationQueue ? (
              <Button
                variant="primary"
                onClick={() => openApproveDialog(pendingBulkIds, pendingBulkIds.length === 1 ? pendingBulkIds[0] : undefined)}
                disabled={pendingBulkIds.length === 0}
              >
                {approveActionLabel}
              </Button>
            ) : undefined
          }
        />

        <div className="dashboard-table-toolbar">
          <SearchField value={query} onChange={setQuery} placeholder="Search vendors..." />
          <div className="inline-actions">
            <SelectField value={filter} onChange={setFilter} options={["All", "Pending", "Approved", "Rejected"]} />
          </div>
        </div>

        <ErrorMessage title="Verification load failed" message={error} className="mx-6 mt-4" />

        {!isLoading && !rows.length && !error ? (
          <div className="p-6">
            <EmptyScaffold title="No submissions found" description="No record found on the database" />
          </div>
        ) : (
          <>
            <div className="table-scroll pt-2">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th className="table-checkbox-cell">
                      {canUpdateVerificationQueue ? (
                        <Checkbox checked={allSelected} onChange={(checked) => setSelected(checked ? filteredRows.map((row) => row.id) : [])} />
                      ) : null}
                    </th>
                    <th>Installer</th>
                    <th>Documents</th>
                    <th>Date Submitted</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length ? (
                    filteredRows.map((item) => (
                      <tr key={item.id}>
                        <td className="table-checkbox-cell">
                          {canUpdateVerificationQueue ? (
                            <Checkbox
                              checked={selected.includes(item.id)}
                              onChange={(checked) =>
                                setSelected((current) => (checked ? [...current, item.id] : current.filter((entry) => entry !== item.id)))
                              }
                            />
                          ) : null}
                        </td>
                        <td>
                          <div className="person-cell">
                            <Avatar alt={item.user_name} />
                            <div className="person-cell__text">
                              <strong>{item.user_name}</strong>
                              <span>{item.user_email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <button type="button" className="text-sm font-semibold text-[var(--brand)] underline-offset-4 hover:underline" onClick={() => setDocumentsId(item.id)}>
                            {item.documents_count} document{item.documents_count === 1 ? "" : "s"}
                          </button>
                        </td>
                        <td>{formatDateTimeLabel(item.submitted_at)}</td>
                        <td>
                          <StatusPill label={formatEnumLabel(item.status)} tone={toneFromStatus(item.status)} />
                        </td>
                        <td>
                          <div className="inline-actions justify-end">
                            <Button variant="secondary" size="sm" leadingIcon={<EyeIcon className="mini-icon" />} onClick={() => setDocumentsId(item.id)}>
                              View
                            </Button>
                            {canUpdateVerificationQueue ? (
                              <TableActionsMenu
                                items={[
                                  {
                                    label: "Approve",
                                    icon: <CheckCircleIcon className="menu-icon" />,
                                    onSelect: () => openApproveDialog([item.id], item.id),
                                  },
                                  {
                                    label: "Reject",
                                    tone: "danger",
                                    icon: <XCircleIcon className="menu-icon" />,
                                    onSelect: () => {
                                      setRejectId(item.id);
                                      setRejectNote(item.admin_note ?? "");
                                    },
                                  },
                                ]}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="cell-subtle">
                        {isLoading ? "Loading verification submissions..." : "No verification submissions matched the current filters."}
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

      <VerificationDocumentsDialog
        open={Boolean(documentsId)}
        submissionName={activeDocumentsSubmission?.user_name}
        documents={documentDetail?.documents ?? []}
        isLoading={documentsLoading}
        error={documentsError}
        onClose={() => setDocumentsId(null)}
      />

      <ApproveVerificationDialog
        open={Boolean(approvalState)}
        canViewDocuments={Boolean(activeApprovalSubmission)}
        title={approvalState?.title ?? "Approve Verification?"}
        description={approvalState?.description ?? "It is recommended to view the documents before approving any verification."}
        onClose={() => setApprovalState(null)}
        onViewDocuments={
          activeApprovalSubmission
            ? () => {
                setApprovalState(null);
                setDocumentsId(activeApprovalSubmission.id);
              }
            : undefined
        }
        onConfirm={handleApprove}
      />

      <RejectVerificationDialog
        open={Boolean(activeRejectSubmission)}
        submissionName={activeRejectSubmission?.user_name}
        submissionEmail={activeRejectSubmission?.user_email}
        note={rejectNote}
        onNoteChange={setRejectNote}
        onClose={() => {
          setRejectId(null);
          setRejectNote("");
        }}
        onConfirm={handleReject}
      />
    </>
  );
}
