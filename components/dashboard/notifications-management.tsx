"use client";

import { type FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { useNotifications } from "@/components/dashboard/notifications-provider";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormSubmitter, getFormSubmitIntent } from "@/components/dashboard/form-submitter";
import { DirectoryToolbar, InlineCallout, WizardProgress } from "@/components/dashboard/management-primitives";
import { FormField, Modal, ModalSelect, ModalTextArea, ModalTextInput } from "@/components/dashboard/modals";
import {
  Button,
  Checkbox,
  MetricCardSecondary,
  Pagination,
  Panel,
  PanelHeader,
  StatusPill,
  TableActionsMenu,
  Tabs,
} from "@/components/dashboard/ui";
import { BellIcon, CalendarIcon, EyeIcon, FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { useToast } from "@/components/ui/toast";
import {
  createNotification,
  DEFAULT_PAGE_SIZE,
  deleteNotification,
  formatDateTimeLabel,
  getNotifications,
  updateNotification,
} from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import { notificationRecipients, notificationTriggerEvents } from "@/lib/management-data";
import type { NotificationRecord, PaginationMeta } from "@/types/api.types";

const notificationTabs = ["Scheduled", "Triggered", "Draft"] as const;
const notificationComposerFormId = "notification-composer-form";
const notificationTypeOptions = ["Scheduled", "Triggered"] as const;
const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

type NotificationManagementTab = (typeof notificationTabs)[number];
type NotificationKind = (typeof notificationTypeOptions)[number];

type ComposerFormState = {
  kind: NotificationKind;
  title: string;
  content: string;
  link: string;
  recipients: string;
  triggerEvent: string;
  scheduledDate: string;
  scheduledTime: string;
  frequency: string;
};

const defaultComposerState: ComposerFormState = {
  kind: "Scheduled",
  title: "",
  content: "",
  link: "",
  recipients: "All Users",
  triggerEvent: "New User",
  scheduledDate: "",
  scheduledTime: "",
  frequency: "No Repeat",
};

function metadataValue(record: NotificationRecord, key: string) {
  const candidate = record.metadata?.[key];
  return typeof candidate === "string" ? candidate : null;
}

function notificationKind(record: NotificationRecord): NotificationKind {
  const workflowKind = metadataValue(record, "kind")?.toLowerCase();

  if (workflowKind === "triggered" || record.type.toLowerCase().includes("trigger")) {
    return "Triggered";
  }

  return "Scheduled";
}

function notificationTab(record: NotificationRecord): NotificationManagementTab {
  const workflowStatus = metadataValue(record, "workflowStatus")?.toLowerCase();

  if (workflowStatus === "draft") {
    return "Draft";
  }

  return notificationKind(record);
}

function notificationStatus(record: NotificationRecord) {
  const workflowStatus = metadataValue(record, "workflowStatus");

  if (workflowStatus?.toLowerCase() === "draft") {
    return "Draft";
  }

  const deliveryStatus = metadataValue(record, "deliveryStatus");

  if (deliveryStatus) {
    return deliveryStatus;
  }

  return record.is_read ? "Read" : "Unread";
}

function notificationTone(record: NotificationRecord) {
  const status = notificationStatus(record).toLowerCase();

  if (status === "read") {
    return "neutral" as const;
  }

  if (status === "unread") {
    return "warning" as const;
  }

  return toneFromStatus(notificationStatus(record));
}

function formatNotificationSchedule(record: NotificationRecord) {
  const scheduledDateTime = metadataValue(record, "scheduledDateTime");
  const date = metadataValue(record, "scheduledDate");
  const time = metadataValue(record, "scheduledTime");

  if (scheduledDateTime) {
    return formatDateTimeLabel(scheduledDateTime);
  }

  if (date && time) {
    return `${date} at ${time}`;
  }

  return date ?? time ?? "N/A";
}

function splitScheduledDateTime(value: string | null | undefined) {
  if (!value) {
    return { scheduledDate: "", scheduledTime: "" };
  }

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    const pad = (part: number) => String(part).padStart(2, "0");

    return {
      scheduledDate: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
      scheduledTime: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
    };
  }

  const [scheduledDate = "", rawTime = ""] = value.split("T");
  return {
    scheduledDate,
    scheduledTime: rawTime.slice(0, 5),
  };
}

function buildScheduledDateTime(date: string, time: string) {
  if (!date || !time) {
    return null;
  }

  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function createComposerState(record?: NotificationRecord | null): ComposerFormState {
  if (!record) {
    return defaultComposerState;
  }

  const schedule =
    metadataValue(record, "scheduledDateTime")
      ? splitScheduledDateTime(metadataValue(record, "scheduledDateTime"))
      : {
          scheduledDate: metadataValue(record, "scheduledDate") ?? "",
          scheduledTime: metadataValue(record, "scheduledTime") ?? "",
        };

  return {
    kind: notificationKind(record),
    title: record.title,
    content: record.message,
    link: record.link ?? "",
    recipients: metadataValue(record, "recipients") ?? "All Users",
    triggerEvent: metadataValue(record, "triggerEvent") ?? "New User",
    scheduledDate: schedule.scheduledDate,
    scheduledTime: schedule.scheduledTime,
    frequency: metadataValue(record, "frequency") ?? "No Repeat",
  };
}

export function NotificationsManagementScreen() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const { feedVersion, refresh: refreshHeader } = useNotifications();
  const [rows, setRows] = useState<NotificationRecord[]>([]);
  const [activeTab, setActiveTab] = useState<NotificationManagementTab>("Scheduled");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerStep, setComposerStep] = useState(1);
  const [editingRecord, setEditingRecord] = useState<NotificationRecord | null>(null);
  const [form, setForm] = useState<ComposerFormState>(defaultComposerState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const canCreateNotifications = can("notifications", "create");
  const canUpdateNotifications = can("notifications", "update");
  const canDeleteNotifications = can("notifications", "delete");

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getNotifications({ page, limit: DEFAULT_PAGE_SIZE })
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

        setError(getErrorMessage(loadError, "Notifications could not be loaded."));
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
  }, [feedVersion, page, refreshKey]);

  const filteredRows = useMemo(
    () =>
      rows.filter((record) => {
        const tab = notificationTab(record);
        const haystack = [
          record.title,
          record.message,
          metadataValue(record, "recipients") ?? "",
          metadataValue(record, "triggerEvent") ?? "",
          record.type,
        ]
          .join(" ")
          .toLowerCase();

        return tab === activeTab && haystack.includes(deferredQuery.toLowerCase());
      }),
    [activeTab, deferredQuery, rows],
  );

  const activeRecord = rows.find((record) => record.id === detailId) ?? null;

  const metrics = useMemo(
    () => [
      {
        title: "Total Notifications",
        value: pagination.total.toLocaleString(),
        subtitle: "records in the system",
        icon: "notifications" as const,
        spark: [12, 18, 22, 30, 34, 40],
      },
      {
        title: "Unread",
        value: rows.filter((record) => !record.is_read).length.toLocaleString(),
        subtitle: "needs attention",
        icon: "retention" as const,
        spark: [18, 16, 20, 24, 30, 36],
      },
      {
        title: "Drafts",
        value: rows.filter((record) => notificationTab(record) === "Draft").length.toLocaleString(),
        subtitle: "saved from the stepper",
        icon: "calendar" as const,
        spark: [10, 12, 18, 22, 20, 18],
      },
    ],
    [pagination.total, rows],
  );

  function openCreate() {
    setEditingRecord(null);
    setForm(defaultComposerState);
    setComposerStep(1);
    setComposerOpen(true);
  }

  function openEdit(record: NotificationRecord) {
    setEditingRecord(record);
    setForm(createComposerState(record));
    setComposerStep(2);
    setComposerOpen(true);
  }

  function closeComposer() {
    setComposerOpen(false);
    setComposerStep(1);
    setEditingRecord(null);
    setForm(defaultComposerState);
  }

  async function handleMarkRead(record: NotificationRecord, isRead: boolean) {
    try {
      await updateNotification(record.id, { is_read: isRead });
      setRows((current) => current.map((item) => (item.id === record.id ? { ...item, is_read: isRead } : item)));
      await refreshHeader();
      setRefreshKey((current) => current + 1);
    } catch (updateError) {
      toast({
        title: "Notification update failed",
        description: getErrorMessage(updateError, "The notification could not be updated."),
        variant: "error",
      });
    }
  }

  async function handleDelete(record: NotificationRecord) {
    try {
      await deleteNotification(record.id);
      toast({
        title: "Notification deleted",
        description: "The notification was removed successfully.",
        variant: "success",
      });
      await refreshHeader();
      setRefreshKey((current) => current + 1);
    } catch (deleteError) {
      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The notification could not be deleted."),
        variant: "error",
      });
    }
  }

  function openDetail(record: NotificationRecord) {
    setDetailId(record.id);

    if (!record.is_read && canUpdateNotifications) {
      void handleMarkRead(record, true);
    }
  }

  async function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);

      const intent = getFormSubmitIntent(event, "publish");
      const workflowStatus = intent === "draft" ? "draft" : "published";
      const scheduledDateTime = form.kind === "Scheduled" ? buildScheduledDateTime(form.scheduledDate, form.scheduledTime) : null;
      const metadataKeysToReset = new Set([
        "kind",
        "recipients",
        "triggerEvent",
        "scheduledDate",
        "scheduledTime",
        "scheduledDateTime",
        "frequency",
        "workflowStatus",
        "deliveryStatus",
        "totalClicks",
      ]);

      if (form.kind === "Scheduled" && !scheduledDateTime) {
        throw new Error("Select a valid notification date and time.");
      }

      const restMetadata = Object.fromEntries(
        Object.entries(editingRecord?.metadata ?? {}).filter(([key]) => !metadataKeysToReset.has(key)),
      );

      const payload = {
        type: "system",
        title: form.title || `${form.kind} Notification`,
        message: form.content || "Notification content preview.",
        link: form.link || undefined,
        metadata: {
          ...restMetadata,
          kind: form.kind.toLowerCase(),
          workflowStatus,
          recipients: form.recipients,
          ...(form.kind === "Triggered"
            ? {
                triggerEvent: form.triggerEvent,
              }
            : {
                scheduledDateTime,
                frequency: form.frequency,
              }),
        },
      };

      if (editingRecord) {
        await updateNotification(editingRecord.id, payload);
      } else {
        await createNotification(payload);
      }

      toast({
        title: editingRecord ? "Notification updated" : "Notification created",
        description: editingRecord ? "The notification changes were saved." : "The notification was created successfully.",
        variant: "success",
      });
      closeComposer();
      await refreshHeader();
      setActiveTab(intent === "draft" ? "Draft" : form.kind);
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      toast({
        title: editingRecord ? "Update failed" : "Create failed",
        description: getErrorMessage(submitError, "The notification could not be saved."),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="dashboard-stack">
        <ErrorMessage title="Notifications load failed" message={error} />

        <InlineCallout>
          New admin posts are saved through the shared notifications endpoint as `system` notifications, with scheduling and routing stored in metadata.
        </InlineCallout>

        <section className="stats-grid--three">
          {metrics.map((metric) => (
            <MetricCardSecondary key={metric.title} {...metric} />
          ))}
        </section>

        <Panel className="overflow-hidden">
          <PanelHeader title={`${activeTab} Notifications`} />
          <div className="notification-page__tabs">
            <Tabs value={activeTab} onChange={setActiveTab} options={notificationTabs} />
          </div>
          <div className="notification-page__toolbar">
            <DirectoryToolbar
              searchValue={query}
              onSearchChange={setQuery}
              searchPlaceholder="Search notifications..."
              filters={
                <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                  Filter
                </Button>
              }
              action={
                canCreateNotifications ? (
                  <Button variant="primary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={openCreate}>
                    Create Notification
                  </Button>
                ) : undefined
              }
            />
          </div>

          <div className="table-scroll pt-2">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th className="table-checkbox-cell">
                    <Checkbox />
                  </th>
                  <th>Title</th>
                  {activeTab === "Scheduled" ? <th>Scheduled Time</th> : null}
                  {activeTab === "Triggered" ? <th>Trigger Event</th> : null}
                  {activeTab === "Draft" ? <th>Type</th> : null}
                  <th>Recipients</th>
                  <th>{activeTab === "Draft" ? "Updated" : "Created"}</th>
                  <th>{activeTab === "Draft" ? "Status" : "Read State"}</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length ? (
                  filteredRows.map((record) => (
                    <tr key={record.id}>
                      <td className="table-checkbox-cell">
                        <Checkbox />
                      </td>
                      <td>{record.title}</td>
                      {activeTab === "Scheduled" ? <td>{formatNotificationSchedule(record)}</td> : null}
                      {activeTab === "Triggered" ? <td>{metadataValue(record, "triggerEvent") ?? "N/A"}</td> : null}
                      {activeTab === "Draft" ? (
                        <td>
                          <StatusPill label={notificationKind(record)} tone={notificationKind(record) === "Scheduled" ? "neutral" : "info"} solid={false} />
                        </td>
                      ) : null}
                      <td>{metadataValue(record, "recipients") ?? "All Users"}</td>
                      <td>{activeTab === "Draft" ? formatDateTimeLabel(record.updated_at) : formatDateTimeLabel(record.created_at)}</td>
                      <td>
                        <StatusPill label={notificationStatus(record)} tone={notificationTone(record)} />
                      </td>
                      <td className="text-right">
                        <TableActionsMenu
                          items={[
                            {
                              label: "View Notification",
                              icon: <EyeIcon className="menu-icon" />,
                              onSelect: () => openDetail(record),
                            },
                            ...(canUpdateNotifications
                              ? [
                                  {
                                    label: "Edit Notification",
                                    icon: <BellIcon className="menu-icon" />,
                                    onSelect: () => openEdit(record),
                                  },
                                  {
                                    label: record.is_read ? "Mark as Unread" : "Mark as Read",
                                    onSelect: () => void handleMarkRead(record, !record.is_read),
                                  },
                                ]
                              : []),
                            ...(canDeleteNotifications
                              ? [
                                  {
                                    label: "Delete Notification",
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
                    <td colSpan={8} className="cell-subtle">
                      {isLoading ? "Loading notifications..." : "No notifications match the current filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={Math.max(1, pagination.totalPages)} onChange={setPage} />
        </Panel>
      </div>

      <Modal
        open={composerOpen}
        onClose={closeComposer}
        title={editingRecord ? `Edit ${form.kind} Notification` : "Create New Notification"}
        size="lg"
        footer={
          composerStep === 1 ? (
            <>
              <Button variant="secondary" onClick={closeComposer}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setComposerStep(2)}>
                Continue
              </Button>
            </>
          ) : composerStep === 2 ? (
            <>
              <Button variant="secondary" onClick={() => setComposerStep(1)}>
                Back
              </Button>
              <Button variant="primary" onClick={() => setComposerStep(3)}>
                Continue
              </Button>
            </>
          ) : (
            <FormSubmitter
              formId={notificationComposerFormId}
              cancelLabel="Back"
              onCancel={() => setComposerStep(2)}
              primaryLabel="Publish"
              primaryIntent="publish"
              secondaryActions={[{ label: "Save as Draft", intent: "draft", variant: "secondary" }]}
              disabled={isSubmitting}
            />
          )
        }
      >
        <form id={notificationComposerFormId} onSubmit={handleComposerSubmit}>
          <WizardProgress step={composerStep} />
          {composerStep === 1 ? (
            <div className="notification-wizard">
              <div className="notification-wizard__heading">
                <span>Select Notification Type</span>
              </div>
              <div className="selection-card-grid">
                {notificationTypeOptions.map((option) => {
                  const active = form.kind === option;
                  return (
                    <button key={option} type="button" className={`selection-card ${active ? "is-active" : ""}`} onClick={() => setForm((current) => ({ ...current, kind: option }))}>
                      <span className="selection-card__icon">{option === "Scheduled" ? <CalendarIcon className="mini-icon" /> : <BellIcon className="mini-icon" />}</span>
                      <div>
                        <strong>{option} Notifications</strong>
                        <p>{option === "Scheduled" ? "Send messages at specific dates and times" : "Send notifications automatically based on specific events"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {composerStep === 2 ? (
            <div className="notification-wizard">
              <div className="notification-wizard__heading">
                <span>{form.kind === "Scheduled" ? "Create Scheduled Notification" : "Create Triggered Notification"}</span>
              </div>
              <div className="notification-form-grid">
                <FormField label="Title">
                  <ModalTextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Notification title" />
                </FormField>
                <FormField label="Content">
                  <ModalTextArea value={form.content} onChange={(value) => setForm((current) => ({ ...current, content: value }))} placeholder="Write out the message" />
                </FormField>
                <FormField label="Link">
                  <ModalTextInput value={form.link} onChange={(event) => setForm((current) => ({ ...current, link: event.target.value }))} placeholder="/admin/quote-requests" />
                </FormField>
                <FormField label="Recipients">
                  <ModalSelect value={form.recipients} onChange={(value) => setForm((current) => ({ ...current, recipients: value }))} options={[...notificationRecipients]} />
                </FormField>
                {form.kind === "Triggered" ? (
                  <FormField label="Trigger Event">
                    <ModalSelect value={form.triggerEvent} onChange={(value) => setForm((current) => ({ ...current, triggerEvent: value }))} options={[...notificationTriggerEvents]} />
                  </FormField>
                ) : (
                  <>
                    <div className="notification-form-grid__split">
                      <FormField label="Date">
                        <ModalTextInput type="date" value={form.scheduledDate} onChange={(event) => setForm((current) => ({ ...current, scheduledDate: event.target.value }))} />
                      </FormField>
                      <FormField label="Time">
                        <ModalTextInput type="time" value={form.scheduledTime} onChange={(event) => setForm((current) => ({ ...current, scheduledTime: event.target.value }))} />
                      </FormField>
                    </div>
                    <FormField label="Frequency">
                      <ModalSelect value={form.frequency} onChange={(value) => setForm((current) => ({ ...current, frequency: value }))} options={["No Repeat", "Daily", "Weekly", "Monthly"]} />
                    </FormField>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {composerStep === 3 ? (
            <div className="notification-wizard">
              <div className="notification-wizard__heading">
                <span>Preview & Publish</span>
              </div>
              <div className="wizard-preview-card">
                <div className="wizard-preview-card__title-row">
                  <span className="wizard-preview-card__badge">
                    {form.kind === "Scheduled" ? <CalendarIcon className="mini-icon" /> : <BellIcon className="mini-icon" />}
                    {form.kind} Notifications
                  </span>
                </div>
                <div className="wizard-preview-card__copy">
                  <strong>{form.title || `${form.kind} Notification`}</strong>
                  <p>{form.content || "Notification content preview."}</p>
                </div>
                <div className="wizard-preview-card__meta">
                  <span>Recipients: {form.recipients}</span>
                  <span>{form.kind === "Scheduled" ? `Date: ${form.scheduledDate || "Not set"}` : `Trigger: ${form.triggerEvent}`}</span>
                  {form.kind === "Scheduled" ? <span>Time: {form.scheduledTime || "Not set"}</span> : null}
                  {form.link ? <span>Link: {form.link}</span> : null}
                </div>
              </div>
              <InlineCallout tone="warning">
                {form.kind === "Scheduled"
                  ? "This notification will be saved with its schedule details inside metadata and can be patched later."
                  : "This notification will be saved with its trigger configuration inside metadata for downstream automation."}
              </InlineCallout>
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(activeRecord)}
        onClose={() => setDetailId(null)}
        title="Notification Details"
        footer={
          <Button variant="secondary" onClick={() => setDetailId(null)}>
            Close
          </Button>
        }
        size="lg"
      >
        {activeRecord ? (
          <div className="detail-key-list detail-key-list--notification">
            <div className="detail-key-list__row">
              <span>Title</span>
              <strong>{activeRecord.title}</strong>
            </div>
            <div className="detail-key-list__row">
              <span>Type</span>
              <strong>{notificationKind(activeRecord)}</strong>
            </div>
            <div className="detail-key-list__row">
              <span>{notificationKind(activeRecord) === "Scheduled" ? "Scheduled Time" : "Trigger Event"}</span>
              <strong>{notificationKind(activeRecord) === "Scheduled" ? formatNotificationSchedule(activeRecord) : metadataValue(activeRecord, "triggerEvent") ?? "N/A"}</strong>
            </div>
            <div className="detail-key-list__row is-block">
              <span>Content</span>
              <strong className="detail-key-list__content">{activeRecord.message}</strong>
            </div>
            <div className="detail-key-list__row">
              <span>Recipients</span>
              <strong>{metadataValue(activeRecord, "recipients") ?? "All Users"}</strong>
            </div>
            <div className="detail-key-list__row">
              <span>Link</span>
              <strong>{activeRecord.link ?? "N/A"}</strong>
            </div>
            <div className="detail-key-list__row">
              <span>Status</span>
              <StatusPill label={notificationStatus(activeRecord)} tone={notificationTone(activeRecord)} />
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
