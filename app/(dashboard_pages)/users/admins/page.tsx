"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { EyeIcon, PlusIcon, ShieldOffIcon, TrashIcon } from "@/components/dashboard/icons";
import { FormField, Modal, ModalFooterActions, ModalSelect, ModalTextInput } from "@/components/dashboard/modals";
import { Avatar, Button, Checkbox, EmptyScaffold, MetricCardSecondary, Pagination, Panel, PanelHeader, SearchField, SelectField, StatusPill, TableActionsMenu } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { createAdmin, DEFAULT_PAGE_SIZE, deleteAdmin, formatEnumLabel, formatManagedUserStatusLabel, getAdmins, updateAdmin } from "@/lib/admin-api";
import { getAdminRoleAccessSummary, getKnownAdminRoleOptions } from "@/lib/auth/access-control";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { AdminRecord, PaginationMeta } from "@/types/api.types";

const adminFormId = "admin-create-form";

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

const roleOptions = getKnownAdminRoleOptions();

export default function AdminsPage() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [openModal, setOpenModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const canCreateAdmins = can("admins", "create");
  const canUpdateAdmins = can("admins", "update");
  const canDeleteAdmins = can("admins", "delete");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    adminRole: "operations_manager",
  });
  const selectedRoleSummary = useMemo(() => getAdminRoleAccessSummary(form.adminRole), [form.adminRole]);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getAdmins({ page, limit: DEFAULT_PAGE_SIZE })
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

        setError(getErrorMessage(loadError, "Admins could not be loaded."));
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

  const statusOptions = useMemo(() => ["All", ...Array.from(new Set(rows.map((admin) => formatManagedUserStatusLabel(admin.status))))], [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter((admin) => {
        const statusLabel = formatManagedUserStatusLabel(admin.status);
        const haystack = [
          admin.id,
          admin.name,
          admin.fullName,
          admin.email,
          admin.phone ?? "",
          admin.address ?? "",
          admin.adminRole ?? "",
          statusLabel,
        ]
          .join(" ")
          .toLowerCase();

        const matchesQuery = haystack.includes(deferredQuery.toLowerCase());
        const matchesStatus = status === "All" || statusLabel === status;
        return matchesQuery && matchesStatus;
      }),
    [deferredQuery, rows, status],
  );

  const activeAdmins = rows.filter((admin) => admin.status.toLowerCase() === "active").length;
  const superAdmins = rows.filter((admin) => admin.adminRole === "super_admin").length;

  async function handleCreateAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      await createAdmin({
        email: form.email,
        password: form.password,
        name: form.name,
        phone: form.phone,
        address: form.address,
        adminRole: form.adminRole,
      });

      toast({
        title: "Admin created",
        description: `${form.name || form.email} was added successfully.`,
        variant: "success",
      });
      setOpenModal(false);
      setForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        address: "",
        adminRole: "operations_manager",
      });
      setPage(1);
      setRefreshKey((value) => value + 1);
    } catch (createError) {
      if (isDashboardSessionExpiredError(createError)) {
        return;
      }

      toast({
        title: "Create admin failed",
        description: getErrorMessage(createError, "The admin could not be created."),
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleStatus(admin: AdminRecord) {
    const nextStatus = admin.status.toLowerCase() === "active" ? "inactive" : "active";

    try {
      await updateAdmin(admin.id, {
        name: admin.fullName || admin.name,
        phone: admin.phone ?? "",
        address: admin.address ?? "",
        status: nextStatus,
        adminRole: admin.adminRole,
      });
      toast({
        title: "Admin updated",
        description: `${admin.fullName || admin.name} is now ${formatManagedUserStatusLabel(nextStatus).toLowerCase()}.`,
        variant: "success",
      });
      setRefreshKey((value) => value + 1);
    } catch (updateError) {
      if (isDashboardActionCancelledError(updateError) || isDashboardSessionExpiredError(updateError)) {
        return;
      }

      toast({
        title: "Update failed",
        description: getErrorMessage(updateError, "The admin status could not be updated."),
        variant: "error",
      });
    }
  }

  async function handleDeleteAdmin(admin: AdminRecord) {
    try {
      await deleteAdmin(admin.id);
      toast({
        title: "Admin deleted",
        description: `${admin.fullName || admin.name} was removed successfully.`,
        variant: "success",
      });

      if (rows.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((value) => value + 1);
      }
    } catch (deleteError) {
      if (isDashboardActionCancelledError(deleteError) || isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The admin could not be deleted."),
        variant: "error",
      });
    }
  }

  return (
    <>
      <div className="dashboard-stack">
        <section className="stats-grid--three">
          <MetricCardSecondary title="Total Admins" value={pagination.total.toLocaleString()} icon="admins" spark={[12, 18, 22, 28, 36, 42]} />
          <MetricCardSecondary title="Active On This Page" value={activeAdmins.toLocaleString()} icon="verification" spark={[10, 14, 20, 28, 34, 40]} />
          <MetricCardSecondary title="Super Admins" value={superAdmins.toLocaleString()} icon="retention" spark={[40, 32, 24, 26, 18, 12]} />
        </section>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Admin Directory"
            action={
              canCreateAdmins ? (
                <Button variant="primary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={() => setOpenModal(true)}>
                  Add Admin
                </Button>
              ) : undefined
            }
          />
          <div className="dashboard-table-toolbar">
            <SearchField value={query} onChange={setQuery} placeholder="Search admins..." />
            <div className="inline-actions">
              <SelectField value={status} onChange={setStatus} options={statusOptions} />
            </div>
          </div>

          <ErrorMessage title="Admin load failed" message={error} className="mx-6 mt-4" />

          {!isLoading && !rows.length && !error ? (
            <div className="p-6">
              <EmptyScaffold title="No admins found" description="No record found on the database" />
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
                      <th>Admin</th>
                      <th>Role</th>
                      <th>Phone</th>
                      <th>Address</th>
                      <th>Email Verified</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length ? (
                      filteredRows.map((admin) => {
                        const statusLabel = formatManagedUserStatusLabel(admin.status);

                        return (
                          <tr key={admin.id}>
                            <td className="table-checkbox-cell">
                              <Checkbox />
                            </td>
                            <td>
                              <div className="person-cell">
                                <Avatar src={admin.avatar_url ?? undefined} alt={admin.fullName || admin.name} size="sm" />
                                <div className="person-cell__text">
                                  <strong>{admin.fullName || admin.name}</strong>
                                  <span>{admin.email}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <StatusPill label={formatEnumLabel(admin.adminRole)} tone="neutral" solid={false} />
                            </td>
                            <td>{admin.phone || "N/A"}</td>
                            <td>{admin.address || "N/A"}</td>
                            <td>{admin.emailVerified ? "Yes" : "No"}</td>
                            <td>
                              <StatusPill label={statusLabel} tone={toneFromStatus(admin.status)} />
                            </td>
                            <td>
                              <div className="inline-actions justify-end">
                                <Link href={`/users/admins/${admin.id}`} className="inline-flex">
                                  <button type="button" className="icon-button" aria-label={`View ${admin.fullName || admin.name}`}>
                                    <EyeIcon className="menu-icon" />
                                  </button>
                                </Link>
                                <TableActionsMenu
                                  panelClassName="is-admin-menu"
                                  items={[
                                    { label: "View Details", href: `/users/admins/${admin.id}`, icon: <EyeIcon className="menu-icon" /> },
                                    ...(canUpdateAdmins
                                      ? [
                                        {
                                          label: admin.status.toLowerCase() === "active" ? "Deactivate Admin" : "Activate Admin",
                                          icon: <ShieldOffIcon className="menu-icon" />,
                                          onSelect: () => handleToggleStatus(admin),
                                        },
                                      ]
                                      : []),
                                    ...(canDeleteAdmins
                                      ? [
                                        {
                                          label: "Delete Admin",
                                          tone: "danger" as const,
                                          icon: <TrashIcon className="menu-icon" />,
                                          onSelect: () => handleDeleteAdmin(admin),
                                        },
                                      ]
                                      : []),
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="cell-subtle">
                          {isLoading ? "Loading admins..." : "No admins matched the current filters."}
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
        open={openModal}
        onClose={() => !isSaving && setOpenModal(false)}
        title="Add Admin"
        footer={<ModalFooterActions formId={adminFormId} cancelLabel="Cancel" submitLabel={isSaving ? "Adding..." : "Add Admin"} onCancel={() => setOpenModal(false)} disabled={isSaving} />}
      >
        <form id={adminFormId} className="flex flex-col gap-5" onSubmit={handleCreateAdmin}>
          <FormField label="Full Name">
            <ModalTextInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Enter full name" />
          </FormField>
          <FormField label="Email Address">
            <ModalTextInput value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="Enter email address" type="email" />
          </FormField>
          <FormField label="Temporary Password">
            <ModalTextInput value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Enter temporary password" type="password" />
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Phone Number">
              <ModalTextInput value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+2348000000000" />
            </FormField>
            <FormField label="Admin Role">
              <div className="flex flex-col gap-3">
                <ModalSelect value={form.adminRole} onChange={(value) => setForm((current) => ({ ...current, adminRole: value }))} options={roleOptions} />

              </div>
            </FormField>
          </div>
          <div className="rounded-[18px] border border-(--border) bg-(--surface-muted) p-3 mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-(--text-soft)">Role access</p>
            <p className="mt-1 text-[10px] leading-5 text-(--text)">{selectedRoleSummary.description}</p>
            <ul className="mt-2 grid list-disc gap-x-5 gap-y-1 pl-4 text-[10px] leading-5 text-(--text-soft) sm:grid-cols-3">
              {selectedRoleSummary.capabilities.map((capability) => (
                <li key={capability}>{capability}</li>
              ))}
            </ul>
          </div>
          <FormField label="Address">
            <ModalTextInput value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Enter address" />
          </FormField>
        </form>
      </Modal>
    </>
  );
}
