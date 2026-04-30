"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { toneFromStatus, verificationRows } from "@/lib/dashboard-data";
import {
  Avatar,
  Button,
  Checkbox,
  Pagination,
  Panel,
  PanelHeader,
  SearchField,
  SelectField,
  StatusPill,
  TableActionsMenu,
} from "@/components/dashboard/ui";
import { CheckCircleIcon, EyeIcon, XCircleIcon } from "@/components/dashboard/icons";
import {
  ApproveVerificationDialog,
  RejectVerificationDialog,
  VerificationDocumentsDialog,
} from "@/components/dashboard/verification-dialogs";

type ApprovalState = {
  ids: string[];
  submissionId?: string;
  title: string;
  description: string;
};

export default function VerificationQueuePage() {
  const { can } = useAccessControl();
  const [rows, setRows] = useState(verificationRows);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [documentsId, setDocumentsId] = useState<string | null>(null);
  const [approvalState, setApprovalState] = useState<ApprovalState | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const deferredQuery = useDeferredValue(query);
  const canUpdateVerificationQueue = can("verification_queue", "update");

  const filteredRows = useMemo(
    () =>
      rows.filter((item) => {
        const matchesQuery = `${item.name} ${item.email}`.toLowerCase().includes(deferredQuery.toLowerCase());
        const matchesFilter = filter === "All" || item.status === filter;
        return matchesQuery && matchesFilter;
      }),
    [deferredQuery, filter, rows],
  );

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selected.includes(row.id)),
    [filteredRows, selected],
  );

  const selectedCount = selectedRows.length;
  const allSelected = filteredRows.length > 0 && filteredRows.every((row) => selected.includes(row.id));
  const pendingBulkIds = useMemo(() => {
    const scope = selectedCount > 0 ? selectedRows : filteredRows;
    return scope.filter((row) => row.status === "Pending").map((row) => row.id);
  }, [filteredRows, selectedCount, selectedRows]);

  const approveActionLabel =
    allSelected || selectedCount === 0
      ? "Approve All"
      : selectedCount === 1
        ? "Approve"
        : "Approve Selected";

  const activeDocumentsSubmission = rows.find((row) => row.id === documentsId) ?? null;
  const activeApprovalSubmission = approvalState?.submissionId
    ? rows.find((row) => row.id === approvalState.submissionId) ?? null
    : null;
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

        <div className="table-scroll pt-2">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th className="table-checkbox-cell">
                  {canUpdateVerificationQueue ? (
                    <Checkbox
                      checked={allSelected}
                      onChange={(checked) => setSelected(checked ? filteredRows.map((row) => row.id) : [])}
                    />
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
              {filteredRows.map((item) => (
                <tr key={item.id}>
                  <td className="table-checkbox-cell">
                    {canUpdateVerificationQueue ? (
                      <Checkbox
                        checked={selected.includes(item.id)}
                        onChange={(checked) =>
                          setSelected((current) =>
                            checked ? [...current, item.id] : current.filter((entry) => entry !== item.id),
                          )
                        }
                      />
                    ) : null}
                  </td>
                  <td>
                    <div className="person-cell">
                      <Avatar src={item.avatar} alt={item.name} />
                      <div className="person-cell__text">
                        <strong>{item.name}</strong>
                        <span>{item.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-sm font-semibold text-[var(--brand)] underline-offset-4 hover:underline"
                      onClick={() => setDocumentsId(item.id)}
                    >
                      View Documents
                    </button>
                  </td>
                  <td>{item.date}</td>
                  <td>
                    <StatusPill label={item.status} tone={item.tone} />
                  </td>
                  <td>
                    <div className="inline-actions justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        leadingIcon={<EyeIcon className="mini-icon" />}
                        onClick={() => setDocumentsId(item.id)}
                      >
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
                                setRejectNote(item.adminNote ?? "");
                              },
                            },
                          ]}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={24} onChange={setPage} />
      </Panel>

      <VerificationDocumentsDialog
        open={Boolean(activeDocumentsSubmission)}
        submission={activeDocumentsSubmission}
        onClose={() => setDocumentsId(null)}
      />

      <ApproveVerificationDialog
        open={Boolean(approvalState)}
        submission={activeApprovalSubmission}
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
        onConfirm={() => {
          if (!approvalState) {
            return;
          }

          setRows((current) =>
            current.map((row) =>
              approvalState.ids.includes(row.id) && row.status === "Pending"
                ? { ...row, status: "Approved", tone: toneFromStatus("Approved"), adminNote: undefined }
                : row,
            ),
          );
          setSelected((current) => current.filter((id) => !approvalState.ids.includes(id)));
          setApprovalState(null);
        }}
      />

      <RejectVerificationDialog
        open={Boolean(activeRejectSubmission)}
        submission={activeRejectSubmission}
        note={rejectNote}
        onNoteChange={setRejectNote}
        onClose={() => {
          setRejectId(null);
          setRejectNote("");
        }}
        onConfirm={() => {
          if (!activeRejectSubmission) {
            return;
          }

          setRows((current) =>
            current.map((row) =>
              row.id === activeRejectSubmission.id
                ? {
                    ...row,
                    status: "Rejected",
                    tone: toneFromStatus("Rejected"),
                    adminNote: rejectNote.trim(),
                  }
                : row,
            ),
          );
          setRejectId(null);
          setRejectNote("");
        }}
      />
    </>
  );
}
