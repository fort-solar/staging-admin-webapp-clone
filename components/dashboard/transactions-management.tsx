"use client";

import { type FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormSubmitter, getFormSubmitIntent } from "@/components/dashboard/form-submitter";
import { DirectoryToolbar, KeyValueList, TagList } from "@/components/dashboard/management-primitives";
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
} from "@/components/dashboard/ui";
import { EyeIcon, FilterIcon, PlusIcon } from "@/components/dashboard/icons";
import { useToast } from "@/components/ui/toast";
import {
  createTransaction,
  DEFAULT_PAGE_SIZE,
  formatCurrencyLabel,
  formatDateTimeLabel,
  formatEnumLabel,
  getCustomers,
  getDashboardOverview,
  getInstallations,
  getTransaction,
  getTransactions,
  loadAllPaginatedRecords,
  updateTransaction,
} from "@/lib/admin-api";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { CustomerRecord, DashboardOverview, InstallationRecord, PaginationMeta, TransactionRecord } from "@/types/api.types";

const transactionFormId = "transaction-form";
const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

const transactionTypeOptions = ["payment", "refund", "payout", "adjustment"] as const;
const transactionStatusOptions = ["pending", "processing", "completed", "cancelled"] as const;
const paymentMethodOptions = ["transfer", "card", "cash", "bank_transfer", "wallet"] as const;

type TransactionFormState = {
  userId: string;
  installationId: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  paymentMethod: string;
  paymentReference: string;
  description: string;
  metadata: string;
};

const defaultFormState: TransactionFormState = {
  userId: "",
  installationId: "",
  type: "payment",
  amount: "",
  currency: "NGN",
  status: "pending",
  paymentMethod: "transfer",
  paymentReference: "",
  description: "",
  metadata: "{}",
};

function formatCustomerOption(customer: CustomerRecord) {
  const name = customer.fullName || customer.name || customer.email;
  return `${name} (${customer.email})`;
}

function formatInstallationOption(installation: InstallationRecord) {
  const customer = installation.customer_name || installation.customer_email || installation.user_id;
  const location = [installation.city, installation.state].filter(Boolean).join(", ");
  return [customer, location, formatEnumLabel(installation.status)].filter(Boolean).join(" • ");
}

function withSelectedOption(options: Array<{ label: string; value: string }>, value: string, fallbackLabel: string) {
  if (!value || options.some((option) => option.value === value)) {
    return options;
  }

  return [{ value, label: fallbackLabel }, ...options];
}

function parseMetadataInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {};
  }

  const parsed = JSON.parse(trimmed) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Metadata must be a valid JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function createFormState(record?: TransactionRecord | null): TransactionFormState {
  if (!record) {
    return defaultFormState;
  }

  return {
    userId: record.user_id,
    installationId: record.installation_id ?? "",
    type: record.type,
    amount: String(record.amount),
    currency: record.currency,
    status: record.status,
    paymentMethod: record.payment_method,
    paymentReference: record.payment_reference ?? "",
    description: record.description ?? "",
    metadata: JSON.stringify(record.metadata ?? {}, null, 2),
  };
}

export function TransactionsManagementScreen() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [rows, setRows] = useState<TransactionRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailRecord, setDetailRecord] = useState<TransactionRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TransactionRecord | null>(null);
  const [form, setForm] = useState<TransactionFormState>(defaultFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [installations, setInstallations] = useState<InstallationRecord[]>([]);
  const [isLoadingReferences, setIsLoadingReferences] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const canCreateTransactions = can("transactions", "create");
  const canUpdateTransactions = can("transactions", "update");

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    Promise.all([
      getTransactions({
        page,
        limit: DEFAULT_PAGE_SIZE,
        search: deferredQuery.trim() || undefined,
        q: deferredQuery.trim() || undefined,
      }),
      getDashboardOverview(),
    ])
      .then(([transactionsPayload, overviewPayload]) => {
        if (cancelled) {
          return;
        }

        setRows(transactionsPayload.data);
        setPagination(transactionsPayload.pagination);
        setOverview(overviewPayload.data);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(loadError, "Transactions could not be loaded."));
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

  useEffect(() => {
    if (!detailId) {
      setDetailRecord(null);
      setDetailError(null);
      return;
    }

    let cancelled = false;

    setDetailLoading(true);
    setDetailError(null);

    getTransaction(detailId)
      .then((payload) => {
        if (!cancelled) {
          setDetailRecord(payload.data);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setDetailError(getErrorMessage(loadError, "The transaction details could not be loaded."));
          setDetailRecord(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [detailId]);

  useEffect(() => {
    if (!formOpen) {
      return;
    }

    let cancelled = false;
    setIsLoadingReferences(true);
    setReferenceError(null);

    Promise.allSettled([
      loadAllPaginatedRecords(getCustomers, {
        fields: ["id", "name", "fullName", "email"],
      }),
      loadAllPaginatedRecords(getInstallations, {
        fields: ["id", "user_id", "customer_email", "customer_name", "status", "city", "state"],
      }),
    ])
      .then(([customersResult, installationsResult]) => {
        if (cancelled) {
          return;
        }

        const errors: string[] = [];

        if (customersResult.status === "fulfilled") {
          setCustomers(customersResult.value);
        } else if (!isDashboardSessionExpiredError(customersResult.reason)) {
          errors.push(getErrorMessage(customersResult.reason, "Customers could not be loaded."));
        }

        if (installationsResult.status === "fulfilled") {
          setInstallations(installationsResult.value);
        } else if (!isDashboardSessionExpiredError(installationsResult.reason)) {
          errors.push(getErrorMessage(installationsResult.reason, "Installations could not be loaded."));
        }

        setReferenceError(errors[0] ?? null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingReferences(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [formOpen]);

  const filteredRows = useMemo(() => rows, [rows]);
  const customerOptions = useMemo(
    () =>
      withSelectedOption(
        customers.map((customer) => ({
          value: customer.id,
          label: formatCustomerOption(customer),
        })),
        form.userId,
        `Selected customer (${form.userId})`,
      ),
    [customers, form.userId],
  );
  const installationOptions = useMemo(
    () =>
      withSelectedOption(
        [
          { value: "", label: "No installation linked" },
          ...installations.map((installation) => ({
            value: installation.id,
            label: formatInstallationOption(installation),
          })),
        ],
        form.installationId,
        `Selected installation (${form.installationId})`,
      ),
    [form.installationId, installations],
  );

  const metrics = useMemo(
    () => [
      {
        title: "Total Revenue",
        value: formatCurrencyLabel(overview?.revenue.total ?? 0),
        subtitle: "completed payments",
        icon: "wallet" as const,
        spark: overview?.ui.primaryMetrics[0]?.spark ?? [18, 24, 32, 40, 52, 64],
      },
      {
        title: "Total Transactions",
        value: (overview?.transactions.total ?? pagination.total).toLocaleString(),
        subtitle: "all records",
        icon: "orders" as const,
        spark: [12, 16, 20, 28, 36, 44],
      },
      {
        title: "Pending",
        value: (overview?.transactions.pending ?? rows.filter((item) => item.status.toLowerCase() === "pending").length).toLocaleString(),
        subtitle: "awaiting settlement",
        icon: "calendar" as const,
        spark: [24, 22, 20, 18, 14, 12],
      },
      {
        title: "Completed",
        value: (overview?.transactions.completed ?? rows.filter((item) => item.status.toLowerCase() === "completed").length).toLocaleString(),
        subtitle: "successfully settled",
        icon: "verification" as const,
        spark: [8, 14, 18, 26, 34, 42],
      },
    ],
    [overview, pagination.total, rows],
  );

  function openCreate() {
    setEditingRecord(null);
    setForm(defaultFormState);
    setIsLoadingReferences(true);
    setReferenceError(null);
    setFormOpen(true);
  }

  function openEdit(record: TransactionRecord) {
    setEditingRecord(record);
    setForm(createFormState(record));
    setIsLoadingReferences(true);
    setReferenceError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingRecord(null);
    setForm(defaultFormState);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);

      const metadata = parseMetadataInput(form.metadata);
      const amount = Number(form.amount);

      if (!Number.isFinite(amount)) {
        throw new Error("Amount must be a valid number.");
      }

      if (!editingRecord && !form.userId.trim()) {
        throw new Error("Select a customer.");
      }

      const intent = getFormSubmitIntent(event, "submit");
      const status = intent === "publish" ? "completed" : form.status;

      if (editingRecord) {
        await updateTransaction(editingRecord.id, {
          installation_id: form.installationId || null,
          type: form.type,
          amount,
          currency: form.currency,
          status,
          payment_method: form.paymentMethod,
          payment_reference: form.paymentReference || null,
          description: form.description,
          metadata,
        });
      } else {
        await createTransaction({
          user_id: form.userId,
          installation_id: form.installationId || null,
          type: form.type,
          amount,
          currency: form.currency,
          status,
          payment_method: form.paymentMethod,
          payment_reference: form.paymentReference || null,
          description: form.description,
          metadata,
        });
      }

      toast({
        title: editingRecord ? "Transaction updated" : "Transaction created",
        description: editingRecord ? "The transaction changes were saved successfully." : "The new transaction was created successfully.",
        variant: "success",
      });
      closeForm();
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      if (isDashboardActionCancelledError(submitError)) {
        return;
      }

      toast({
        title: editingRecord ? "Update failed" : "Create failed",
        description: getErrorMessage(submitError, "The transaction could not be saved."),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="dashboard-stack">
        <ErrorMessage title="Transactions load failed" message={error} />

        <section className="stats-grid--four">
          {metrics.map((metric) => (
            <MetricCardSecondary key={metric.title} {...metric} />
          ))}
        </section>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Transactions"
            description="Track admin-side transaction records, create manual entries, and patch existing settlements."
          />
          <div className="management-surface__body">
            <DirectoryToolbar
              searchValue={query}
              onSearchChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              searchPlaceholder="Search transactions..."
              filters={
                <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                  Filter
                </Button>
              }
              action={
                canCreateTransactions ? (
                  <Button variant="primary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={openCreate}>
                    Add Transaction
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
                  <th>Transaction ID</th>
                  <th>User ID</th>
                  <th>Type</th>
                  <th>Created</th>
                  <th>Amount</th>
                  <th>Payment Method</th>
                  <th>Status</th>
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
                      <td>{record.id}</td>
                      <td>{record.user_id}</td>
                      <td>{formatEnumLabel(record.type)}</td>
                      <td>{formatDateTimeLabel(record.created_at)}</td>
                      <td>{formatCurrencyLabel(record.amount, record.currency)}</td>
                      <td>{formatEnumLabel(record.payment_method)}</td>
                      <td>
                        <StatusPill label={formatEnumLabel(record.status)} tone={toneFromStatus(record.status)} />
                      </td>
                      <td className="text-right">
                        <TableActionsMenu
                          items={[
                            {
                              label: "View Transaction",
                              icon: <EyeIcon className="menu-icon" />,
                              onSelect: () => setDetailId(record.id),
                            },
                            ...(canUpdateTransactions
                              ? [
                                  {
                                    label: "Edit Transaction",
                                    onSelect: () => openEdit(record),
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
                    <td colSpan={9} className="cell-subtle">
                      {isLoading ? "Loading transactions..." : "No transactions matched the current search."}
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
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        title={detailRecord?.id ?? detailId ?? "Transaction Details"}
        size="lg"
        footer={
          <div className="form-submitter is-between">
            <Button variant="secondary" onClick={() => setDetailId(null)}>
              Close
            </Button>
            {detailRecord && canUpdateTransactions ? (
              <Button
                variant="primary"
                onClick={() => {
                  setDetailId(null);
                  openEdit(detailRecord);
                }}
              >
                Edit Transaction
              </Button>
            ) : null}
          </div>
        }
      >
        {detailLoading ? (
          <p className="text-sm text-[var(--text-soft)]">Loading transaction details...</p>
        ) : detailError ? (
          <p className="text-sm text-[var(--text-soft)]">{detailError}</p>
        ) : detailRecord ? (
          <div className="transaction-detail">
            <div className="transaction-detail__status-row">
              <StatusPill label={formatEnumLabel(detailRecord.status)} tone={toneFromStatus(detailRecord.status)} />
              <span>{formatEnumLabel(detailRecord.type)}</span>
            </div>

            <section className="transaction-detail__section">
              <h3>Record Details</h3>
              <div className="transaction-detail__buyer-grid">
                <KeyValueList
                  items={[
                    { label: "Transaction ID", value: detailRecord.id },
                    { label: "User ID", value: detailRecord.user_id },
                    { label: "Installation ID", value: detailRecord.installation_id ?? "N/A" },
                    { label: "Reference", value: detailRecord.payment_reference ?? "N/A" },
                  ]}
                />
                <KeyValueList
                  items={[
                    { label: "Created", value: formatDateTimeLabel(detailRecord.created_at) },
                    { label: "Updated", value: formatDateTimeLabel(detailRecord.updated_at) },
                    { label: "Payment Method", value: formatEnumLabel(detailRecord.payment_method) },
                    { label: "Currency", value: detailRecord.currency },
                  ]}
                />
              </div>
            </section>

            <section className="payment-card">
              <div>
                <h3>Settlement</h3>
                <p>{detailRecord.description || "No description supplied."}</p>
                <span>{formatCurrencyLabel(detailRecord.amount, detailRecord.currency)}</span>
              </div>
              <strong>Status: {formatEnumLabel(detailRecord.status)}</strong>
            </section>

            <section className="transaction-detail__section">
              <h3>Metadata</h3>
              <pre className="summary-card overflow-auto p-4 text-xs">{JSON.stringify(detailRecord.metadata ?? {}, null, 2)}</pre>
            </section>

            <TagList items={[formatEnumLabel(detailRecord.type), formatEnumLabel(detailRecord.payment_method), detailRecord.currency]} />
          </div>
        ) : (
          <p className="text-sm text-[var(--text-soft)]">No transaction details are available.</p>
        )}
      </Modal>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingRecord ? "Edit Transaction" : "Create Transaction"}
        size="lg"
        footer={
          <FormSubmitter
            formId={transactionFormId}
            cancelLabel="Cancel"
            onCancel={closeForm}
            primaryLabel={editingRecord ? "Save Changes" : "Create Transaction"}
            primaryIntent="submit"
            secondaryActions={editingRecord ? [{ label: "Mark Completed", intent: "publish", variant: "secondary" }] : []}
            disabled={isSubmitting}
          />
        }
      >
        <form id={transactionFormId} onSubmit={handleSubmit}>
          <div className="notification-form-grid">
            {!editingRecord ? (
              <FormField label="Customer" hint={isLoadingReferences ? "Loading customers..." : referenceError || "Select the customer for this transaction."}>
                <ModalSelect value={form.userId} onChange={(value) => setForm((current) => ({ ...current, userId: value }))} options={customerOptions} placeholder="Select customer" disabled={isLoadingReferences} required />
              </FormField>
            ) : null}
            <FormField label="Installation" hint={isLoadingReferences ? "Loading installations..." : "Optionally link this transaction to an installation."}>
              <ModalSelect value={form.installationId} onChange={(value) => setForm((current) => ({ ...current, installationId: value }))} options={installationOptions} placeholder="Select installation" disabled={isLoadingReferences} />
            </FormField>
            <FormField label="Type">
              <ModalSelect value={form.type} onChange={(value) => setForm((current) => ({ ...current, type: value }))} options={[...transactionTypeOptions]} />
            </FormField>
            <FormField label="Amount">
              <ModalTextInput value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="250000" />
            </FormField>
            <FormField label="Currency">
              <ModalTextInput value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="NGN" />
            </FormField>
            <FormField label="Status">
              <ModalSelect value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={[...transactionStatusOptions]} />
            </FormField>
            <FormField label="Payment Method">
              <ModalSelect value={form.paymentMethod} onChange={(value) => setForm((current) => ({ ...current, paymentMethod: value }))} options={[...paymentMethodOptions]} />
            </FormField>
            <FormField label="Payment Reference">
              <ModalTextInput value={form.paymentReference} onChange={(event) => setForm((current) => ({ ...current, paymentReference: event.target.value }))} placeholder="Optional payment reference" />
            </FormField>
            <FormField label="Description">
              <ModalTextInput value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Deposit" />
            </FormField>
            <FormField label="Metadata" hint="Use a JSON object, for example: { &quot;source&quot;: &quot;admin&quot; }">
              <ModalTextArea value={form.metadata} onChange={(value) => setForm((current) => ({ ...current, metadata: value }))} placeholder="{}" />
            </FormField>
          </div>
        </form>
      </Modal>
    </>
  );
}
