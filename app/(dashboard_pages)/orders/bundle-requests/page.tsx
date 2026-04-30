"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { bundleRequestRows, toneFromStatus } from "@/lib/dashboard-data";
import {
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
import {
  ChipPicker,
  FormField,
  Modal,
  ModalFooterActions,
  ModalSelect,
  ModalTextInput,
} from "@/components/dashboard/modals";
import { EyeIcon, FilterIcon, PlusIcon } from "@/components/dashboard/icons";

const customBundleRequestFormId = "custom-bundle-request-form";

export default function BundleRequestPage() {
  const { can } = useAccessControl();
  const [rows, setRows] = useState(bundleRequestRows);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const canCreateOrders = can("orders", "create");
  const canUpdateOrders = can("orders", "update");

  const [form, setForm] = useState({
    name: "",
    bundle: "Campus Bundle",
    email: "",
    phone: "",
    location: "",
    financing: "Yes",
  });

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchesQuery = `${row.customer} ${row.bundle} ${row.email} ${row.phone} ${row.location}`
          .toLowerCase()
          .includes(deferredQuery.toLowerCase());
        const matchesStatus = status === "All" || row.status === status;
        return matchesQuery && matchesStatus;
      }),
    [deferredQuery, rows, status],
  );

  const activeRequest = rows.find((row) => row.id === detailId) ?? null;

  return (
    <>
      <div className="dashboard-stack">
        <section className="stats-grid--four">
          <MetricCardSecondary title="Total Requests" value="100,000" delta="+10.4%" deltaTone="success" subtitle="from last month" icon="bundles" spark={[18, 24, 32, 44, 52, 60]} />
          <MetricCardSecondary title="Pending Requests" value="100" subtitle="Requests awaiting approvals" icon="orders" spark={[30, 26, 22, 18, 16, 14]} />
          <MetricCardSecondary title="Approved Requests" value="245" delta="+10.4%" deltaTone="success" subtitle="from last month" icon="verification" spark={[12, 18, 24, 34, 44, 54]} />
          <MetricCardSecondary title="Delivered Requests" value="80,000" subtitle="Requests Completed" icon="installers" spark={[24, 26, 32, 40, 48, 54]} />
        </section>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Request List"
            action={
              canCreateOrders ? (
                <Button variant="primary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={() => setModalOpen(true)}>
                  Custom Request
                </Button>
              ) : undefined
            }
          />
          <div className="dashboard-table-toolbar">
            <SearchField value={query} onChange={setQuery} placeholder="Search order report..." />
            <div className="inline-actions">
              <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                Filter
              </Button>
              <SelectField value={status} onChange={setStatus} options={["All", ...Array.from(new Set(rows.map((row) => row.status)))]} />
            </div>
          </div>
          <div className="table-scroll pt-2">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th className="table-checkbox-cell">
                    <Checkbox />
                  </th>
                  <th>Name</th>
                  <th>Bundle</th>
                  <th>Contact Info</th>
                  <th>Location</th>
                  <th>Financing</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td className="table-checkbox-cell">
                      <Checkbox />
                    </td>
                    <td>{row.customer}</td>
                    <td>{row.bundle}</td>
                    <td>
                      <div className="product-cell__text">
                        <strong>{row.email}</strong>
                        <span>{row.phone}</span>
                      </div>
                    </td>
                    <td>{row.location}</td>
                    <td>{row.financing}</td>
                    <td>{row.date}</td>
                    <td>
                      <StatusPill label={row.status} tone={row.statusTone} />
                    </td>
                    <td>
                      <div className="inline-actions justify-end">
                        <Button variant="secondary" size="sm" leadingIcon={<EyeIcon className="mini-icon" />} onClick={() => setDetailId(row.id)}>
                          View
                        </Button>
                        <TableActionsMenu
                          items={[
                            ...(canUpdateOrders
                              ? [
                                  {
                                    label: "Mark as Processing",
                                    onSelect: () =>
                                      setRows((current) =>
                                        current.map((item) =>
                                          item.id === row.id
                                            ? {
                                                ...item,
                                                status: "Processing",
                                                statusTone: toneFromStatus("Processing"),
                                              }
                                            : item,
                                        ),
                                      ),
                                  },
                                  {
                                    label: "Mark as Installed",
                                    onSelect: () =>
                                      setRows((current) =>
                                        current.map((item) =>
                                          item.id === row.id
                                            ? {
                                                ...item,
                                                status: "System Installed",
                                                statusTone: toneFromStatus("Approved"),
                                              }
                                            : item,
                                        ),
                                      ),
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
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Custom Bundle Request"
        footer={<ModalFooterActions formId={customBundleRequestFormId} cancelLabel="Cancel" submitLabel="Add Request" onCancel={() => setModalOpen(false)} />}
      >
        <form
          id={customBundleRequestFormId}
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setRows((current) => [
              {
                id: `BR${Date.now()}`,
                customer: form.name || "New Request",
                bundle: form.bundle,
                email: form.email || "newrequest@example.com",
                phone: form.phone || "+234 000 000 0000",
                location: form.location || "Lagos",
                financing: form.financing as "Yes" | "No",
                date: "20 Apr, 2026",
                status: "Pending",
                statusTone: toneFromStatus("Pending"),
              },
              ...current,
            ]);
            setModalOpen(false);
            setForm({ name: "", bundle: "Campus Bundle", email: "", phone: "", location: "", financing: "Yes" });
          }}
        >
          <FormField label="Customer Name">
            <ModalTextInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Enter customer name" />
          </FormField>
          <FormField label="Bundle">
            <ModalSelect value={form.bundle} onChange={(value) => setForm((current) => ({ ...current, bundle: value }))} options={["Campus Bundle", "Campus Lite", "Home Bundle"]} />
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Email Address">
              <ModalTextInput value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="Enter email address" type="email" />
            </FormField>
            <FormField label="Phone Number">
              <ModalTextInput value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+234 809 062 0576" />
            </FormField>
          </div>
          <FormField label="Location">
            <ModalTextInput value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Lagos" />
          </FormField>
          <FormField label="Financing">
            <ChipPicker
              active={[form.financing]}
              options={["Yes", "No"]}
              onToggle={(value) => setForm((current) => ({ ...current, financing: value }))}
            />
          </FormField>
        </form>
      </Modal>

      <Modal
        open={Boolean(activeRequest)}
        onClose={() => setDetailId(null)}
        title={activeRequest?.customer ?? "Bundle Request"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetailId(null)}>
              Cancel
            </Button>
            {canUpdateOrders ? (
              <Button variant="primary" onClick={() => setDetailId(null)}>
                Update
              </Button>
            ) : null}
          </>
        }
      >

        {activeRequest ? (
          <div className="flex flex-col gap-6">
            <div className="rounded-[20px] bg-(--surface-soft) p-5">
              <p className="m-0 text-sm font-semibold text-(--brand)">Bundle Request</p>
              <h3 className="m-0 pt-2 text-2xl font-extrabold sm:text-[28px]">{activeRequest.bundle}</h3>
              <p className="m-0 pt-2 text-sm text-(--text-soft)">Affordable and efficient solutions tailored to the customer’s needs.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="cell-subtle">Solar Financing</p>
                <strong>{activeRequest.financing}</strong>
              </div>
              <div>
                <p className="cell-subtle">Date Initiated</p>
                <strong>{activeRequest.date}</strong>
              </div>
              <div>
                <p className="cell-subtle">Location</p>
                <strong>{activeRequest.location}</strong>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="cell-subtle">Phone</p>
                <strong>{activeRequest.phone}</strong>
              </div>
              <div>
                <p className="cell-subtle">Email</p>
                <strong>{activeRequest.email}</strong>
              </div>
            </div>
            {canUpdateOrders ? (
              <FormField label="Status">
                <SelectField
                  value={activeRequest.status}
                  onChange={(value) =>
                    setRows((current) =>
                      current.map((row) =>
                        row.id === activeRequest.id ? { ...row, status: value, statusTone: toneFromStatus(value) } : row,
                      ),
                    )
                  }
                  options={["Processing", "System Installed", "Installer in-transit", "Closed", "Packed"]}
                />
              </FormField>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
