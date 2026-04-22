"use client";

import { type FormEvent, useDeferredValue, useMemo, useState } from "react";
import {
  formatNotificationSchedule,
  notificationDrafts,
  notificationMetrics,
  notificationRecipients,
  notificationRecords,
  notificationTriggerEvents,
  notificationTypeOptions,
  type NotificationManagementRecord,
  type NotificationManagementTab,
} from "@/lib/management-data";
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
import { FormField, Modal, ModalSelect, ModalTextArea, ModalTextInput } from "@/components/dashboard/modals";
import { FormSubmitter, getFormSubmitIntent } from "@/components/dashboard/form-submitter";
import { DirectoryToolbar, InlineCallout, WizardProgress } from "@/components/dashboard/management-primitives";
import { BellIcon, CalendarIcon, CheckCircleIcon, EyeIcon, FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { toneFromStatus } from "@/lib/dashboard-data";

const notificationTabs = ["Scheduled", "Triggered", "Draft"] as const;
const notificationComposerFormId = "notification-composer-form";

type NotificationKind = (typeof notificationTypeOptions)[number];

type ComposerFormState = {
  kind: NotificationKind;
  title: string;
  content: string;
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
  recipients: "All Users",
  triggerEvent: "New User",
  scheduledDate: "May 10, 2025",
  scheduledTime: "9:00 AM",
  frequency: "No Repeat",
};

function dateLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

function rowById(records: NotificationManagementRecord[], id: string | null) {
  return records.find((record) => record.id === id) ?? null;
}

function notificationToneForStatus(status: string) {
  if (status === "Paused") {
    return "info" as const;
  }

  return toneFromStatus(status);
}

export function NotificationsManagementScreen() {
  const [rows, setRows] = useState<NotificationManagementRecord[]>([...notificationRecords, ...notificationDrafts]);
  const [activeTab, setActiveTab] = useState<NotificationManagementTab>("Scheduled");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerStep, setComposerStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ComposerFormState>(defaultComposerState);
  const deferredQuery = useDeferredValue(query);

  const filteredRows = useMemo(
    () =>
      rows.filter((record) => {
        const matchesTab = record.tab === activeTab;
        const haystack = `${record.title} ${record.recipients} ${record.content} ${record.triggerEvent ?? ""}`.toLowerCase();
        return matchesTab && haystack.includes(deferredQuery.toLowerCase());
      }),
    [activeTab, deferredQuery, rows],
  );

  const activeRecord = rowById(rows, detailId);
  const editingRecord = rowById(rows, editingId);

  function openCreate() {
    setEditingId(null);
    setForm(defaultComposerState);
    setComposerStep(1);
    setComposerOpen(true);
  }

  function openEdit(record: NotificationManagementRecord) {
    setEditingId(record.id);
    setForm({
      kind: record.kind,
      title: record.title,
      content: record.content,
      recipients: record.recipients,
      triggerEvent: record.triggerEvent ?? "New User",
      scheduledDate: record.scheduledDate ?? "May 10, 2025",
      scheduledTime: record.scheduledTime ?? "9:00 AM",
      frequency: record.frequency ?? "No Repeat",
    });
    setComposerStep(2);
    setComposerOpen(true);
  }

  function closeComposer() {
    setComposerOpen(false);
    setComposerStep(1);
    setEditingId(null);
    setForm(defaultComposerState);
  }

  function upsertNotification(nextTab: NotificationManagementTab, status: string) {
    const timestamp = dateLabel();
    const nextRecord: NotificationManagementRecord = {
      id: editingRecord?.id ?? `${form.kind === "Scheduled" ? "NSC" : "NTR"}-${Date.now()}`,
      kind: form.kind,
      tab: nextTab,
      title: form.title || `${form.kind} Notification`,
      content: form.content || "Notification content preview.",
      recipients: form.recipients,
      triggerEvent: form.kind === "Triggered" ? form.triggerEvent : undefined,
      scheduledDate: form.kind === "Scheduled" ? form.scheduledDate : undefined,
      scheduledTime: form.kind === "Scheduled" ? form.scheduledTime : undefined,
      frequency: form.kind === "Scheduled" ? form.frequency : undefined,
      createdAt: editingRecord?.createdAt ?? timestamp,
      updatedAt: timestamp,
      totalClicks: editingRecord?.totalClicks ?? 0,
      status,
      statusTone: notificationToneForStatus(status),
    };

    setRows((current) => {
      if (editingRecord) {
        return current.map((record) => (record.id === editingRecord.id ? nextRecord : record));
      }

      return [nextRecord, ...current];
    });
    closeComposer();
    setActiveTab(nextTab);
  }

  function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = getFormSubmitIntent(event, "publish");
    upsertNotification(intent === "draft" ? "Draft" : form.kind, intent === "draft" ? "Draft" : "Pending");
  }

  return (
    <>
      <div className="dashboard-stack">
        <section className="stats-grid--three">
          {notificationMetrics.map((metric) => (
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
              searchPlaceholder="Search Notifications..."
              filters={
                <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                  Filter
                </Button>
              }
              action={
                <Button variant="primary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={openCreate}>
                  Create Notification
                </Button>
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
                  {activeTab === "Draft" ? <th>Created</th> : <th>Total Clicks</th>}
                  {activeTab === "Draft" ? <th>Last Modified</th> : <th>Status</th>}
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
                      {activeTab === "Triggered" ? <td>{record.triggerEvent}</td> : null}
                      {activeTab === "Draft" ? (
                        <td>
                          <StatusPill label={record.kind} tone={record.kind === "Scheduled" ? "neutral" : "info"} solid={false} />
                        </td>
                      ) : null}
                      <td>{record.recipients}</td>
                      {activeTab === "Draft" ? <td>{record.createdAt}</td> : <td>{record.totalClicks}</td>}
                      {activeTab === "Draft" ? (
                        <td>{record.updatedAt}</td>
                      ) : (
                        <td>
                          <StatusPill label={record.status} tone={record.statusTone} />
                        </td>
                      )}
                      <td className="text-right">
                        <TableActionsMenu
                          items={[
                            {
                              label: activeTab === "Draft" ? "View Draft" : "View Notification",
                              icon: <EyeIcon className="menu-icon" />,
                              onSelect: () => setDetailId(record.id),
                            },
                            {
                              label: activeTab === "Draft" ? "Edit Draft" : "Edit Notification",
                              icon: <BellIcon className="menu-icon" />,
                              onSelect: () => openEdit(record),
                            },
                            ...(activeTab !== "Draft"
                              ? [
                                  {
                                    label: record.status === "Paused" ? "Resume Notification" : "Pause Notification",
                                    icon: <CheckCircleIcon className="menu-icon" />,
                                    onSelect: () =>
                                      setRows((current) =>
                                        current.map((item) =>
                                          item.id === record.id
                                            ? {
                                                ...item,
                                                status: item.status === "Paused" ? "Pending" : "Paused",
                                                statusTone: notificationToneForStatus(item.status === "Paused" ? "Pending" : "Paused"),
                                                updatedAt: dateLabel(),
                                              }
                                            : item,
                                        ),
                                      ),
                                  },
                                ]
                              : []),
                            {
                              label: activeTab === "Draft" ? "Delete Draft" : "Delete Notification",
                              tone: "danger",
                              icon: <TrashIcon className="menu-icon" />,
                              onSelect: () => setRows((current) => current.filter((item) => item.id !== record.id)),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={activeTab === "Draft" ? 7 : 7} className="cell-subtle">
                      No notifications match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={24} onChange={setPage} />
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
                  <button
                    key={option}
                    type="button"
                    className={`selection-card ${active ? "is-active" : ""}`}
                    onClick={() => setForm((current) => ({ ...current, kind: option }))}
                  >
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
                <ModalTextInput
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Notification Title"
                />
              </FormField>
              <FormField label="Content">
                <ModalTextArea
                  value={form.content}
                  onChange={(value) => setForm((current) => ({ ...current, content: value }))}
                  placeholder="Write out the message"
                />
              </FormField>
              <FormField label="Recipients">
                <ModalSelect
                  value={form.recipients}
                  onChange={(value) => setForm((current) => ({ ...current, recipients: value }))}
                  options={[...notificationRecipients]}
                />
              </FormField>
              {form.kind === "Triggered" ? (
                <FormField label="Trigger Event">
                  <ModalSelect
                    value={form.triggerEvent}
                    onChange={(value) => setForm((current) => ({ ...current, triggerEvent: value }))}
                    options={[...notificationTriggerEvents]}
                  />
                </FormField>
              ) : (
                <>
                  <div className="notification-form-grid__split">
                    <FormField label="Date">
                      <ModalTextInput
                        value={form.scheduledDate}
                        onChange={(event) => setForm((current) => ({ ...current, scheduledDate: event.target.value }))}
                        placeholder="May 10, 2025"
                      />
                    </FormField>
                    <FormField label="Time">
                      <ModalTextInput
                        value={form.scheduledTime}
                        onChange={(event) => setForm((current) => ({ ...current, scheduledTime: event.target.value }))}
                        placeholder="9:00 AM"
                      />
                    </FormField>
                  </div>
                  <FormField label="Frequency">
                    <ModalSelect
                      value={form.frequency}
                      onChange={(value) => setForm((current) => ({ ...current, frequency: value }))}
                      options={["No Repeat", "Daily", "Weekly", "Monthly"]}
                    />
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
                <span>{form.kind === "Scheduled" ? `Date: ${form.scheduledDate}` : `Trigger: ${form.triggerEvent}`}</span>
                {form.kind === "Scheduled" ? <span>Time: {form.scheduledTime}</span> : null}
              </div>
            </div>
            <InlineCallout tone="warning">
              {form.kind === "Scheduled"
                ? "This notification will be sent once on the specified date and time."
                : "This notification will be triggered when the selected event occurs."}
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
          <div className="detail-key-list">
            <div className="detail-key-list__row">
              <span>Title</span>
              <strong>{activeRecord.title}</strong>
            </div>
            <div className="detail-key-list__row">
              <span>{activeRecord.kind === "Scheduled" ? "Scheduled Time" : "Trigger Event"}</span>
              <strong>{activeRecord.kind === "Scheduled" ? formatNotificationSchedule(activeRecord) : activeRecord.triggerEvent}</strong>
            </div>
            <div className="detail-key-list__row is-block">
              <span>Content</span>
              <strong className="detail-key-list__content">{activeRecord.content}</strong>
            </div>
            <div className="detail-key-list__row">
              <span>Recipients</span>
              <strong>{activeRecord.recipients}</strong>
            </div>
            <div className="detail-key-list__row">
              <span>Total Clicks</span>
              <strong>{activeRecord.totalClicks}</strong>
            </div>
            <div className="detail-key-list__row">
              <span>Status</span>
              <StatusPill label={activeRecord.status} tone={activeRecord.statusTone} />
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
