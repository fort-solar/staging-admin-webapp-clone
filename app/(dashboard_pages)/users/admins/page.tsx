"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { adminDirectory, adminPermissionOptions, avatarAssets, toneFromStatus } from "@/lib/dashboard-data";
import {
  Avatar,
  Button,
  Checkbox,
  MetricCardSecondary,
  Pagination,
  Panel,
  PanelHeader,
  SearchField,
  SelectField,
  StatusPill,
  TableActionsMenu,
} from "@/components/dashboard/ui";
import { ChipPicker, FormField, Modal, ModalFooterActions, ModalSelect, ModalTextInput } from "@/components/dashboard/modals";
import { EyeIcon, PlusIcon, ShieldOffIcon, TrashIcon } from "@/components/dashboard/icons";

const adminFormId = "admin-create-form";

export default function AdminsPage() {
  const { can } = useAccessControl();
  const [rows, setRows] = useState(adminDirectory);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [openModal, setOpenModal] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const canCreateAdmins = can("admins", "create");
  const canUpdateAdmins = can("admins", "update");
  const canDeleteAdmins = can("admins", "delete");

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "Admin",
    permissions: [adminPermissionOptions[0], adminPermissionOptions[1]],
  });

  const filteredRows = useMemo(
    () =>
      rows.filter((admin) => {
        const matchesQuery = `${admin.id} ${admin.name} ${admin.email}`.toLowerCase().includes(deferredQuery.toLowerCase());
        const matchesStatus = status === "All" || admin.status === status;
        return matchesQuery && matchesStatus;
      }),
    [deferredQuery, rows, status],
  );

  return (
    <>
      <div className="dashboard-stack">
        <section className="stats-grid--three">
          <MetricCardSecondary title="Total Admins" value="6" delta="+2" deltaTone="success" subtitle="from last month" icon="admins" spark={[12, 18, 22, 28, 36, 42]} />
          <MetricCardSecondary title="Active Admins" value="4" delta="+1" deltaTone="success" subtitle="from last month" icon="verification" spark={[10, 14, 20, 28, 34, 40]} />
          <MetricCardSecondary title="Admin Activity" value="5" subtitle="actions in the last 24 hours" icon="retention" spark={[40, 32, 24, 26, 18, 12]} />
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
              <SelectField value={status} onChange={setStatus} options={["All", "Active", "Inactive", "Suspended"]} />
            </div>
          </div>
          <div className="table-scroll pt-2">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th className="table-checkbox-cell">
                    <Checkbox />
                  </th>
                  <th>Admin</th>
                  <th>Role</th>
                  <th>Last Active</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((admin) => (
                  <tr key={admin.id}>
                    <td className="table-checkbox-cell">
                      <Checkbox />
                    </td>
                    <td>
                      <div className="person-cell">
                        <Avatar src={admin.avatar} alt={admin.name} size="sm"/>
                        <div className="person-cell__text">
                          <strong>{admin.name}</strong>
                          <span>{admin.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusPill label={admin.role} tone="neutral" solid={false} />
                    </td>
                    <td>{admin.lastActive}</td>
                    <td>{admin.joined}</td>
                    <td>
                      <StatusPill label={admin.status} tone={admin.statusTone} />
                    </td>
                    <td>
                      <div className="inline-actions justify-end">
                        <Link href={`/users/admins/${admin.id}`} className="inline-flex">
                          <button type="button" className="icon-button" aria-label={`View ${admin.name}`}>
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
                                    label: "Suspend Admin",
                                    icon: <ShieldOffIcon className="menu-icon" />,
                                    onSelect: () =>
                                      setRows((current) =>
                                        current.map((row) =>
                                          row.id === admin.id
                                            ? { ...row, status: "Suspended", statusTone: toneFromStatus("Suspended") }
                                            : row,
                                        ),
                                      ),
                                  },
                                ]
                              : []),
                            ...(canDeleteAdmins
                              ? [
                                  {
                                    label: "Delete Admin",
                                    tone: "danger" as const,
                                    icon: <TrashIcon className="menu-icon" />,
                                    onSelect: () => setRows((current) => current.filter((row) => row.id !== admin.id)),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={24} onChange={setPage} />
        </Panel>
      </div>

      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Admin Details"
        footer={<ModalFooterActions formId={adminFormId} cancelLabel="Cancel" submitLabel="Add Admin" onCancel={() => setOpenModal(false)} />}
      >
        <form
          id={adminFormId}
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            setRows((current) => [
              {
                id: `ADM${Date.now()}`,
                name: form.name || "New Admin",
                email: form.email || "new.admin@example.com",
                avatar: avatarAssets.sarah,
                role: form.role,
                lastActive: "20 Apr 2026 | 09:00 am",
                joined: "Apr 20, 2026",
                status: "Active",
                statusTone: toneFromStatus("Active"),
                phone: "+1 000 000 0000",
                location: "Lagos",
              },
              ...current,
            ]);
            setOpenModal(false);
          }}
        >
          <div className="h-1 w-1/2 rounded-full bg-[var(--brand)]" />
          <FormField label="Full Name">
            <ModalTextInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Enter full name" />
          </FormField>
          <FormField label="Email Address">
            <ModalTextInput value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="Enter email address" type="email" />
          </FormField>
          <FormField label="Role">
            <ModalSelect value={form.role} onChange={(value) => setForm((current) => ({ ...current, role: value }))} options={["Admin", "Super Admin", "BDM"]} />
          </FormField>
          <FormField label="Permissions" hint="These are the responsibilities that can be carried out by this user role">
            <ChipPicker
              active={form.permissions}
              options={adminPermissionOptions}
              onToggle={(value) =>
                setForm((current) => ({
                  ...current,
                  permissions: current.permissions.includes(value)
                    ? current.permissions.filter((item) => item !== value)
                    : [...current.permissions, value],
                }))
              }
            />
          </FormField>
        </form>
      </Modal>
    </>
  );
}
