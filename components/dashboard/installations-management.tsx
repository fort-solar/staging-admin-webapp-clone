"use client";

import { type FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { ActionLink, DetailPanel, DirectoryToolbar, InlineCallout } from "@/components/dashboard/management-primitives";
import { FormField, Modal, ModalFooterActions, ModalSelect, ModalTextArea, ModalTextInput } from "@/components/dashboard/modals";
import { FormSubmitter } from "@/components/dashboard/form-submitter";
import { Button, EmptyScaffold, MetricCardSecondary, Pagination, Panel, SelectField, StatusPill, TableActionsMenu, Tabs, TextAreaField, TextField } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { createInstallation, DEFAULT_PAGE_SIZE, deleteInstallation, formatDateTimeLabel, formatEnumLabel, getInstallation, getInstallations, updateInstallation } from "@/lib/admin-api";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { InstallationRecord, PaginationMeta } from "@/types/api.types";

const installationStatusTabs = ["All", "Scheduled", "In Progress", "Completed", "Cancelled"] as const;
const installationStatusOptions = [
  { label: "Scheduled", value: "scheduled" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
] as const;
const installationFormId = "installation-form";
const installationEditFormId = "installation-edit-form";

type InstallationStatusFilter = (typeof installationStatusTabs)[number];

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

function matchesInstallationStatus(status: string, filter: InstallationStatusFilter) {
  if (filter === "All") {
    return true;
  }

  const normalized = status.trim().toLowerCase();

  switch (filter) {
    case "Scheduled":
      return normalized === "scheduled";
    case "In Progress":
      return normalized === "in_progress" || normalized === "in progress";
    case "Completed":
      return normalized === "completed";
    case "Cancelled":
      return normalized === "cancelled" || normalized === "canceled";
    default:
      return true;
  }
}

function buildStatusOptions(current?: string) {
  const normalizedCurrent = current?.trim().toLowerCase();

  if (!normalizedCurrent || installationStatusOptions.some((option) => option.value === normalizedCurrent)) {
    return [...installationStatusOptions];
  }

  return [
    { label: formatEnumLabel(normalizedCurrent), value: normalizedCurrent },
    ...installationStatusOptions,
  ];
}

function formatLocation(record: InstallationRecord) {
  return [record.address, record.city, record.state, record.country].filter(Boolean).join(", ");
}

export function InstallationsManagementScreen() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<InstallationRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InstallationStatusFilter>("All");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingInstallation, setEditingInstallation] = useState<InstallationRecord | null>(null);
  const [editStatus, setEditStatus] = useState("scheduled");
  const [editInstallerId, setEditInstallerId] = useState("");
  const [editScheduledDate, setEditScheduledDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const canCreateInstallations = can("installations", "create");
  const canUpdateInstallations = can("installations", "update");
  const canDeleteInstallations = can("installations", "delete");

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getInstallations({
      page,
      limit: DEFAULT_PAGE_SIZE,
      search: deferredQuery.trim() || undefined,
      q: deferredQuery.trim() || undefined,
      fields: [
        "id",
        "user_id",
        "customer_email",
        "customer_name",
        "installer_id",
        "status",
        "address",
        "city",
        "state",
        "country",
        "system_size_kw",
        "scheduled_date",
        "completed_date",
        "created_at",
      ],
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

        setError(getErrorMessage(loadError, "Installations could not be loaded."));
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

  const filteredRows = useMemo(
    () => rows.filter((record) => matchesInstallationStatus(record.status, status)),
    [rows, status],
  );

  const scheduledCount = rows.filter((record) => matchesInstallationStatus(record.status, "Scheduled")).length;
  const inProgressCount = rows.filter((record) => matchesInstallationStatus(record.status, "In Progress")).length;
  const completedCount = rows.filter((record) => matchesInstallationStatus(record.status, "Completed")).length;
  const notice = searchParams.get("created") ? "Installation created successfully." : null;

  async function openEditModal(record: InstallationRecord) {
    setIsEditOpen(true);
    setIsLoadingEdit(true);
    setEditingInstallation(record);
    setEditStatus(record.status?.trim().toLowerCase() || "scheduled");
    setEditInstallerId(record.installer_id ?? "");
    setEditScheduledDate(record.scheduled_date ?? "");
    setEditNotes(record.notes ?? "");

    try {
      const payload = await getInstallation(record.id);
      const detail = payload.data;
      setEditingInstallation(detail);
      setEditStatus(detail.status?.trim().toLowerCase() || "scheduled");
      setEditInstallerId(detail.installer_id ?? "");
      setEditScheduledDate(detail.scheduled_date ?? "");
      setEditNotes(detail.notes ?? "");
    } catch (loadError) {
      if (isDashboardSessionExpiredError(loadError)) {
        return;
      }

      toast({
        title: "Installation load failed",
        description: getErrorMessage(loadError, "The installation details could not be loaded."),
        variant: "error",
      });
    } finally {
      setIsLoadingEdit(false);
    }
  }

  function closeEditModal() {
    if (isSavingEdit) {
      return;
    }

    setIsEditOpen(false);
    setEditingInstallation(null);
    setEditStatus("scheduled");
    setEditInstallerId("");
    setEditScheduledDate("");
    setEditNotes("");
  }

  async function handleDelete(record: InstallationRecord) {
    try {
      await deleteInstallation(record.id);
      toast({
        title: "Installation deleted",
        description: `${record.customer_name || record.id} was removed successfully.`,
        variant: "success",
      });

      if (rows.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch (deleteError) {
      if (isDashboardActionCancelledError(deleteError) || isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The installation could not be deleted."),
        variant: "error",
      });
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingInstallation) {
      return;
    }

    setIsSavingEdit(true);

    try {
      await updateInstallation(editingInstallation.id, {
        status: editStatus,
        installer_id: editInstallerId.trim() || undefined,
        scheduled_date: editScheduledDate.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });

      toast({
        title: "Installation updated",
        description: `${editingInstallation.customer_name || editingInstallation.id} was updated successfully.`,
        variant: "success",
      });
      closeEditModal();
      setRefreshKey((current) => current + 1);
    } catch (saveError) {
      if (isDashboardActionCancelledError(saveError) || isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: "Update failed",
        description: getErrorMessage(saveError, "The installation could not be updated."),
        variant: "error",
      });
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <>
      <div className="dashboard-stack">
        <section className="stats-grid--four">
          <MetricCardSecondary title="Total Installations" value={pagination.total.toLocaleString()} icon="products" spark={[12, 18, 24, 30, 36, 42]} />
          <MetricCardSecondary title="Scheduled On This Page" value={scheduledCount.toLocaleString()} icon="calendar" spark={[10, 14, 18, 24, 30, 36]} />
          <MetricCardSecondary title="In Progress On This Page" value={inProgressCount.toLocaleString()} icon="sales" spark={[8, 14, 20, 26, 32, 38]} />
          <MetricCardSecondary title="Completed On This Page" value={completedCount.toLocaleString()} icon="verification" spark={[8, 12, 20, 28, 34, 40]} />
        </section>

        {notice ? <InlineCallout>{notice}</InlineCallout> : null}

        <Panel className="overflow-hidden">
          <div className="management-surface__body">
            <div className="section-header content-section-header">
              <div>
                <h2 className="section-title">Installations</h2>
                <p className="section-description">Manage installation records returned by the admin installation endpoints.</p>
              </div>
              {canCreateInstallations ? (
                <ActionLink href="/installations/new" leadingIcon={<PlusIcon className="mini-icon" />}>
                  Add New Installation
                </ActionLink>
              ) : null}
            </div>
            <DirectoryToolbar
              searchValue={query}
              onSearchChange={setQuery}
              searchPlaceholder="Search installations..."
              filters={
                <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                  Filter
                </Button>
              }
            />
            <div className="management-surface__filters is-inline">
              <Tabs value={status} onChange={setStatus} options={installationStatusTabs} compact />
            </div>
          </div>

          <ErrorMessage title="Installation load failed" message={error} />

          {isLoading && !rows.length ? (
            <div className="p-6">
              <p className="section-description">Loading installations...</p>
            </div>
          ) : !isLoading && !rows.length && !error ? (
            <div className="p-6">
              <EmptyScaffold title="No installations found" description="No record found on the database" />
            </div>
          ) : (
            <>
              <div className="table-scroll pt-2">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Installer</th>
                      <th>Location</th>
                      <th>System Size</th>
                      <th>Schedule</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length ? (
                      filteredRows.map((record) => (
                        <tr key={record.id}>
                          <td>
                            <div className="product-cell__text">
                              <strong>{record.customer_name || "Unknown customer"}</strong>
                              <span>{record.customer_email || "No email"}</span>
                              <span>{record.user_id}</span>
                            </div>
                          </td>
                          <td>{record.installer_id || "Unassigned"}</td>
                          <td>{formatLocation(record) || "N/A"}</td>
                          <td>{record.system_size_kw ? `${record.system_size_kw} kW` : "N/A"}</td>
                          <td>
                            <div className="product-cell__text">
                              <strong>{formatDateTimeLabel(record.scheduled_date)}</strong>
                              <span>Created {formatDateTimeLabel(record.created_at)}</span>
                              <span>{record.completed_date ? `Completed ${formatDateTimeLabel(record.completed_date)}` : "Not completed"}</span>
                            </div>
                          </td>
                          <td>
                            <StatusPill label={formatEnumLabel(record.status)} tone={toneFromStatus(record.status)} solid={false} />
                          </td>
                          <td>
                            <TableActionsMenu
                              items={[
                                ...(canUpdateInstallations
                                  ? [
                                      {
                                        label: "Edit Installation",
                                        onSelect: () => void openEditModal(record),
                                      },
                                    ]
                                  : []),
                                ...(canDeleteInstallations
                                  ? [
                                      {
                                        label: "Delete Installation",
                                        tone: "danger" as const,
                                        icon: <TrashIcon className="menu-icon" />,
                                        onSelect: () => void handleDelete(record),
                                      },
                                    ]
                                  : []),
                              ]}
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7}>
                          <div className="p-6">
                            <EmptyScaffold title="No installations matched" description="No record found on the database" />
                          </div>
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
        open={isEditOpen}
        onClose={closeEditModal}
        title={editingInstallation ? `Update ${editingInstallation.customer_name || editingInstallation.id}` : "Update Installation"}
        footer={
          <ModalFooterActions
            formId={installationEditFormId}
            cancelLabel="Cancel"
            submitLabel={isSavingEdit ? "Saving..." : "Save Changes"}
            onCancel={closeEditModal}
            disabled={isSavingEdit || isLoadingEdit}
          />
        }
      >
        <form id={installationEditFormId} className="notification-wizard" onSubmit={handleEditSubmit}>
          <div className="notification-wizard__heading">
            <span>Update the installer assignment, schedule, and internal notes for this installation.</span>
          </div>
          <FormField label="Status">
            <ModalSelect value={editStatus} onChange={setEditStatus} options={buildStatusOptions(editStatus)} disabled={isLoadingEdit} />
          </FormField>
          <FormField label="Installer ID">
            <ModalTextInput value={editInstallerId} onChange={(event) => setEditInstallerId(event.target.value)} placeholder="Installer UUID" />
          </FormField>
          <FormField label="Scheduled Date">
            <ModalTextInput value={editScheduledDate} onChange={(event) => setEditScheduledDate(event.target.value)} placeholder="2026-05-05T18:59:40.002Z" />
          </FormField>
          <FormField label="Notes">
            <ModalTextArea value={editNotes} onChange={setEditNotes} placeholder="Internal notes for the installation" />
          </FormField>
        </form>
      </Modal>
    </>
  );
}

export function InstallationFormScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const [userId, setUserId] = useState("");
  const [installerId, setInstallerId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [systemSizeKw, setSystemSizeKw] = useState("");
  const [numberOfPanels, setNumberOfPanels] = useState("");
  const [panelType, setPanelType] = useState("");
  const [inverterType, setInverterType] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await createInstallation({
        user_id: userId.trim(),
        installer_id: installerId.trim(),
        order_id: orderId.trim(),
        status,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        country: country.trim(),
        system_size_kw: Number(systemSizeKw) || 0,
        number_of_panels: Number(numberOfPanels) || 0,
        panel_type: panelType.trim(),
        inverter_type: inverterType.trim(),
        scheduled_date: scheduledDate.trim(),
        notes: notes.trim(),
      });

      router.push("/installations?created=1");
    } catch (saveError) {
      if (isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: "Create installation failed",
        description: getErrorMessage(saveError, "The installation could not be created."),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dashboard-stack">
      <Panel className="product-form-shell">
        <form id={installationFormId} onSubmit={handleSubmit}>
          <div className="product-form-shell__header">
            <div>
              <h2 className="section-title">Add A New Installation</h2>
              <p className="section-description">Create a new installation record using the admin installation endpoints.</p>
            </div>
            <FormSubmitter
              formId={installationFormId}
              cancelLabel="Cancel"
              onCancel={() => router.push("/installations")}
              primaryLabel={isSubmitting ? "Saving..." : "Finish"}
              disabled={isSubmitting}
            />
          </div>

          <div className="product-form-grid">
            <DetailPanel title="Basic Information" description="Reference the customer, installer, order, and initial status.">
              <div className="detail-panel__stack">
                <FormField label="User ID">
                  <TextField value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="Customer UUID" />
                </FormField>
                <div className="product-inline-row is-two">
                  <FormField label="Installer ID">
                    <TextField value={installerId} onChange={(event) => setInstallerId(event.target.value)} placeholder="Installer UUID" />
                  </FormField>
                  <FormField label="Order ID">
                    <TextField value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="Order UUID" />
                  </FormField>
                </div>
                <div className="product-inline-row is-two">
                  <FormField label="Status">
                    <SelectField value={status} onChange={setStatus} options={installationStatusOptions.map((option) => ({ label: option.label, value: option.value }))} />
                  </FormField>
                  <FormField label="Scheduled Date">
                    <TextField value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} placeholder="2026-05-05T18:59:40.002Z" />
                  </FormField>
                </div>
              </div>
            </DetailPanel>

            <DetailPanel title="Location" description="Capture the service address returned by the installation API.">
              <div className="detail-panel__stack">
                <FormField label="Address">
                  <TextAreaField value={address} onChange={setAddress} placeholder="Installation address" rows={5} />
                </FormField>
                <div className="product-inline-row is-three">
                  <FormField label="City">
                    <TextField value={city} onChange={(event) => setCity(event.target.value)} placeholder="Lagos" />
                  </FormField>
                  <FormField label="State">
                    <TextField value={state} onChange={(event) => setState(event.target.value)} placeholder="Lagos" />
                  </FormField>
                  <FormField label="Country">
                    <TextField value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Nigeria" />
                  </FormField>
                </div>
              </div>
            </DetailPanel>

            <DetailPanel title="System Details" description="Provide the installation sizing and equipment details required by the backend.">
              <div className="detail-panel__stack">
                <div className="product-inline-row is-two">
                  <FormField label="System Size (kW)">
                    <TextField value={systemSizeKw} onChange={(event) => setSystemSizeKw(event.target.value)} placeholder="5" />
                  </FormField>
                  <FormField label="Number of Panels">
                    <TextField value={numberOfPanels} onChange={(event) => setNumberOfPanels(event.target.value)} placeholder="12" />
                  </FormField>
                </div>
                <div className="product-inline-row is-two">
                  <FormField label="Panel Type">
                    <TextField value={panelType} onChange={(event) => setPanelType(event.target.value)} placeholder="Jinko 550W" />
                  </FormField>
                  <FormField label="Inverter Type">
                    <TextField value={inverterType} onChange={(event) => setInverterType(event.target.value)} placeholder="5kVA Hybrid" />
                  </FormField>
                </div>
                <FormField label="Notes">
                  <TextAreaField value={notes} onChange={setNotes} placeholder="Internal installation notes" rows={5} />
                </FormField>
              </div>
            </DetailPanel>
          </div>
        </form>
      </Panel>
    </div>
  );
}
