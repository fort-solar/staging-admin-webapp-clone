"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { avatarAssets, installerDirectory, installerSkills, toneFromStatus } from "@/lib/dashboard-data";
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
import { ChipPicker, FormField, Modal, ModalFooterActions, ModalTextArea, ModalTextInput, UploadField } from "@/components/dashboard/modals";
import { BanIcon, EyeIcon, PlusIcon, ShieldOffIcon, TrashIcon } from "@/components/dashboard/icons";

const installerFormId = "installer-create-form";

export default function InstallersPage() {
  const [rows, setRows] = useState(installerDirectory);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [openModal, setOpenModal] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const [form, setForm] = useState({
    name: "Wade Warren",
    email: "fashion@example.com",
    phone: "+234 809 062 0576",
    address: "",
    expertise: [installerSkills[0]],
    certificationDocument: "",
    ninDocument: "",
  });

  const filteredRows = useMemo(
    () =>
      rows.filter((installer) => {
        const matchesQuery = `${installer.name} ${installer.email} ${installer.id}`.toLowerCase().includes(deferredQuery.toLowerCase());
        const matchesStatus = status === "All" || installer.status === status;
        return matchesQuery && matchesStatus;
      }),
    [deferredQuery, rows, status],
  );

  return (
    <>
      <div className="dashboard-stack">
        <section className="stats-grid--four">
          <MetricCardSecondary title="Total Installers" value="1,862" delta="+10.4%" deltaTone="success" subtitle="from last month" icon="installers" spark={[18, 24, 36, 48, 56, 60]} />
          <MetricCardSecondary title="Active Installers" value="100" delta="+10.4%" deltaTone="success" subtitle="from last month" icon="verification" spark={[12, 18, 26, 34, 46, 54]} />
          <MetricCardSecondary title="Installer of the month" value="James Ukpong" subtitle="25 Completed Installations • ⭐ 4.9" icon="admins" spark={[18, 22, 26, 30, 34, 40]} />
          <MetricCardSecondary title="Flagged Installers" value="17" delta="-0.4%" deltaTone="danger" subtitle="from last month" icon="flag" spark={[44, 42, 36, 28, 22, 18]} />
        </section>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Installer Directory"
            action={
              <Button variant="primary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={() => setOpenModal(true)}>
                Add Installer
              </Button>
            }
          />
          <div className="dashboard-table-toolbar">
            <SearchField value={query} onChange={setQuery} placeholder="Search installer..." />
            <div className="inline-actions">
              <SelectField value={status} onChange={setStatus} options={["All", "Active", "Flagged"]} />
            </div>
          </div>
          <div className="table-scroll pt-2">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th className="table-checkbox-cell">
                    <Checkbox />
                  </th>
                  <th>Installer Id</th>
                  <th>Installer</th>
                  <th>Installations</th>
                  <th>Performance</th>
                  <th>Verification</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((installer) => (
                  <tr key={installer.id}>
                    <td className="table-checkbox-cell">
                      <Checkbox />
                    </td>
                    <td>{installer.id}</td>
                    <td>
                      <div className="person-cell">
                        <Avatar src={installer.avatar} alt={installer.name} size="sm"/>
                        <div className="person-cell__text">
                          <strong>{installer.name}</strong>
                          <span>{installer.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{installer.installations}</td>
                    <td>⭐ {installer.performance.toFixed(1)}</td>
                    <td>
                      <StatusPill label={installer.verification} tone={installer.verificationTone} />
                    </td>
                    <td>
                      <StatusPill label={installer.status} tone={installer.statusTone} />
                    </td>
                    <td>
                      <div className="inline-actions justify-end">
                        <Link href={`/users/installers/${installer.id}`} className="inline-flex">
                          <button type="button" className="icon-button" aria-label={`View ${installer.name}`}>
                            <EyeIcon className="menu-icon" />
                          </button>
                        </Link>
                        <TableActionsMenu
                          panelClassName="is-installer-menu"
                          items={[
                            { label: "View Profile", href: `/users/installers/${installer.id}`, icon: <EyeIcon className="menu-icon" /> },
                            {
                              label: "Revoke Verification",
                              icon: <ShieldOffIcon className="menu-icon" />,
                              onSelect: () =>
                                setRows((current) =>
                                  current.map((row) =>
                                    row.id === installer.id
                                      ? {
                                          ...row,
                                          verification: "Revoked",
                                          verificationTone: "neutral",
                                        }
                                      : row,
                                  ),
                                ),
                            },
                            {
                              label: "Blacklist Installer",
                              icon: <BanIcon className="menu-icon" />,
                              onSelect: () =>
                                setRows((current) =>
                                  current.map((row) =>
                                    row.id === installer.id
                                      ? {
                                          ...row,
                                          status: "Flagged",
                                          statusTone: toneFromStatus("Flagged"),
                                        }
                                      : row,
                                  ),
                                ),
                            },
                            {
                              label: "Delete Installer",
                              tone: "danger",
                              icon: <TrashIcon className="menu-icon" />,
                              onSelect: () => setRows((current) => current.filter((row) => row.id !== installer.id)),
                            },
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
        title="Add New Installer"
        size="lg"
        footer={<ModalFooterActions formId={installerFormId} cancelLabel="Cancel" submitLabel="Add Installer" onCancel={() => setOpenModal(false)} />}
      >
        <form
          id={installerFormId}
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            setRows((current) => [
              {
                id: `VEN${Date.now()}`,
                name: form.name,
                email: form.email,
                avatar: avatarAssets.wade,
                installations: 0,
                performance: 0,
                verification: "Verified",
                verificationTone: toneFromStatus("Verified"),
                status: "Active",
                statusTone: toneFromStatus("Active"),
                phone: form.phone,
                address: form.address || "Address not provided",
              },
              ...current,
            ]);
            setOpenModal(false);
            setForm({
              name: "Wade Warren",
              email: "fashion@example.com",
              phone: "+234 809 062 0576",
              address: "",
              expertise: [installerSkills[0]],
              certificationDocument: "",
              ninDocument: "",
            });
          }}
        >
          <FormField label="Full Name">
            <ModalTextInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Enter full name" />
          </FormField>

          <FormField label="Expertise">
            <ChipPicker
              active={form.expertise}
              options={installerSkills}
              searchable=""
              onToggle={(value) =>
                setForm((current) => ({
                  ...current,
                  expertise: current.expertise.includes(value)
                    ? current.expertise.filter((item) => item !== value)
                    : [...current.expertise, value],
                }))
              }
            />
          </FormField>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Phone Number">
              <ModalTextInput value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+234 809 062 0576" />
            </FormField>
            <FormField label="Email Address">
              <ModalTextInput value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="fashion@example.com" type="email" />
            </FormField>
          </div>

          <FormField label="Address">
            <ModalTextArea value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} placeholder="Address" />
          </FormField>

          <div className="form-divider">
            <span>Documents to Upload</span>
          </div>

          <FormField label="Certification">
            <UploadField
              value={form.certificationDocument}
              onChange={(value) => setForm((current) => ({ ...current, certificationDocument: value }))}
              showIcon={false}
            />
          </FormField>

          <FormField label="Installer NIN">
            <UploadField
              value={form.ninDocument}
              onChange={(value) => setForm((current) => ({ ...current, ninDocument: value }))}
              showIcon={false}
            />
          </FormField>
        </form>
      </Modal>
    </>
  );
}
