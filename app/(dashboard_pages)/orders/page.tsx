"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { CreateCustomerModal } from "@/components/dashboard/create-customer-modal";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { EyeIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { FormField, Modal, ModalFooterActions, ModalSelect, ModalTextArea, ModalTextInput } from "@/components/dashboard/modals";
import { Button, Checkbox, EmptyScaffold, IconButton, MetricCardSecondary, Pagination, Panel, PanelHeader, SearchField, SelectField, StatusPill } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { isDashboardSessionExpiredError } from "@/lib/api/client";
import { createOrder, DEFAULT_PAGE_SIZE, formatCurrencyLabel, formatDateTimeLabel, formatEnumLabel, getCustomers, getDashboardOverview, getOrders, getPackages, getProductPanels } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { CreateCustomerRequest, CustomerRecord, DashboardOverview, OrderRecord, PackageRecord, PaginationMeta, ProductPanelRecord } from "@/types/api.types";

const orderFormId = "order-create-form";
const orderStatusOptions = ["pending", "processing", "completed", "cancelled"];
const orderItemTypeOptions = ["package", "product", "custom"];

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

type OrderFormItem = {
  key: string;
  item_type: string;
  item_id: string;
  name: string;
  catalog_search: string;
  quantity: string;
  unit_price: string;
};

type OrderFormState = {
  customer_user_id: string;
  status: string;
  currency: string;
  total_amount: string;
  notes: string;
  items: OrderFormItem[];
};

function createOrderItem(): OrderFormItem {
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    item_type: "package",
    item_id: "",
    name: "",
    catalog_search: "",
    quantity: "1",
    unit_price: "",
  };
}

function createInitialOrderForm(): OrderFormState {
  return {
    customer_user_id: "",
    status: "pending",
    currency: "NGN",
    total_amount: "",
    notes: "",
    items: [createOrderItem()],
  };
}

function getCustomerLabel(customer: CustomerRecord) {
  return `${customer.fullName || customer.name} (${customer.email})`;
}

function getProductPanelLabel(panel: ProductPanelRecord, currency = "NGN") {
  const brand = panel.brand ? ` - ${panel.brand}` : "";
  return `${panel.name}${brand} - ${formatCurrencyLabel(panel.price, currency)}`;
}

function getPackageLabel(pkg: PackageRecord, currency = "NGN") {
  return `${pkg.name} - ${formatCurrencyLabel(pkg.price, currency)}`;
}

export default function OrdersPage() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [rows, setRows] = useState<OrderRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [openModal, setOpenModal] = useState(false);
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState<OrderFormState>(() => createInitialOrderForm());
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerRecord[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [isCustomerLoading, setIsCustomerLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null);
  const [packageResults, setPackageResults] = useState<Record<string, PackageRecord[]>>({});
  const [packageLoading, setPackageLoading] = useState<Record<string, boolean>>({});
  const [packageErrors, setPackageErrors] = useState<Record<string, string | null>>({});
  const [productPanelResults, setProductPanelResults] = useState<Record<string, ProductPanelRecord[]>>({});
  const [productPanelLoading, setProductPanelLoading] = useState<Record<string, boolean>>({});
  const [productPanelErrors, setProductPanelErrors] = useState<Record<string, string | null>>({});
  const deferredQuery = useDeferredValue(query);
  const deferredCustomerQuery = useDeferredValue(customerQuery);
  const canCreateCustomers = can("customers", "create");
  const canCreateOrders = can("orders", "create");

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    Promise.all([getDashboardOverview(), getOrders({ page, limit: DEFAULT_PAGE_SIZE })])
      .then(([overviewPayload, ordersPayload]) => {
        if (cancelled) {
          return;
        }

        setOverview(overviewPayload.data);
        setRows(ordersPayload.data);
        setPagination(ordersPayload.pagination);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(loadError, "Orders could not be loaded."));
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
    if (!openModal) {
      return;
    }

    let cancelled = false;

    setIsCustomerLoading(true);
    setCustomerSearchError(null);

    getCustomers({
      page: 1,
      limit: 10,
      search: deferredCustomerQuery.trim() || undefined,
      q: deferredCustomerQuery.trim() || undefined,
      fields: ["id", "name", "fullName", "email"],
    })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setCustomerResults(payload.data);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        if (isDashboardSessionExpiredError(loadError)) {
          return;
        }

        setCustomerSearchError(getErrorMessage(loadError, "Customer search could not be loaded."));
        setCustomerResults([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsCustomerLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deferredCustomerQuery, openModal]);

  const productLookupSignature = useMemo(
    () => form.items.map((item) => `${item.key}:${item.item_type}:${item.catalog_search}`).join("|"),
    [form.items],
  );

  useEffect(() => {
    if (!openModal) {
      return;
    }

    const packageItems = form.items.filter((item) => item.item_type === "package");

    if (!packageItems.length) {
      setPackageResults({});
      setPackageLoading({});
      setPackageErrors({});
      return;
    }

    let cancelled = false;

    setPackageLoading(Object.fromEntries(packageItems.map((item) => [item.key, true])));
    setPackageErrors(Object.fromEntries(packageItems.map((item) => [item.key, null])));

    Promise.all(
      packageItems.map(async (item) => {
        try {
          const payload = await getPackages({
            page: 1,
            limit: 10,
            search: item.catalog_search.trim() || undefined,
            q: item.catalog_search.trim() || undefined,
            fields: ["id", "name", "price", "is_active", "slug"],
          });

          return {
            key: item.key,
            data: payload.data.filter((pkg) => pkg.is_active),
            error: null,
          };
        } catch (loadError) {
          if (isDashboardSessionExpiredError(loadError)) {
            return { key: item.key, data: [], error: null };
          }

          return {
            key: item.key,
            data: [],
            error: getErrorMessage(loadError, "Package search could not be loaded."),
          };
        }
      }),
    ).then((responses) => {
      if (cancelled) {
        return;
      }

      setPackageResults(Object.fromEntries(responses.map((response) => [response.key, response.data])));
      setPackageErrors(Object.fromEntries(responses.map((response) => [response.key, response.error])));
      setPackageLoading(Object.fromEntries(responses.map((response) => [response.key, false])));
    });

    return () => {
      cancelled = true;
    };
  }, [form.items, openModal, productLookupSignature]);

  useEffect(() => {
    if (!openModal) {
      return;
    }

    const productItems = form.items.filter((item) => item.item_type === "product");

    if (!productItems.length) {
      setProductPanelResults({});
      setProductPanelLoading({});
      setProductPanelErrors({});
      return;
    }

    let cancelled = false;

    setProductPanelLoading(Object.fromEntries(productItems.map((item) => [item.key, true])));
    setProductPanelErrors(Object.fromEntries(productItems.map((item) => [item.key, null])));

    Promise.all(
      productItems.map(async (item) => {
        try {
          const payload = await getProductPanels({
            page: 1,
            limit: 10,
            search: item.catalog_search.trim() || undefined,
            q: item.catalog_search.trim() || undefined,
            fields: ["id", "name", "brand", "price", "is_active"],
          });

          return {
            key: item.key,
            data: payload.data.filter((panel) => panel.is_active),
            error: null,
          };
        } catch (loadError) {
          if (isDashboardSessionExpiredError(loadError)) {
            return { key: item.key, data: [], error: null };
          }

          return {
            key: item.key,
            data: [],
            error: getErrorMessage(loadError, "Product search could not be loaded."),
          };
        }
      }),
    ).then((responses) => {
      if (cancelled) {
        return;
      }

      setProductPanelResults(Object.fromEntries(responses.map((response) => [response.key, response.data])));
      setProductPanelErrors(Object.fromEntries(responses.map((response) => [response.key, response.error])));
      setProductPanelLoading(Object.fromEntries(responses.map((response) => [response.key, false])));
    });

    return () => {
      cancelled = true;
    };
  }, [form.items, openModal, productLookupSignature]);

  const statusOptions = useMemo(() => ["All", ...Array.from(new Set(rows.map((order) => formatEnumLabel(order.status))))], [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter((order) => {
        const statusLabel = formatEnumLabel(order.status);
        const haystack = [
          order.id,
          order.customer_name,
          order.customer_email,
          order.notes ?? "",
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

  const customerSelectOptions = useMemo(() => {
    const options = customerResults.map((customer) => ({
      value: customer.id,
      label: getCustomerLabel(customer),
    }));

    if (selectedCustomer && !options.some((option) => option.value === selectedCustomer.id)) {
      return [{ value: selectedCustomer.id, label: getCustomerLabel(selectedCustomer) }, ...options];
    }

    return options;
  }, [customerResults, selectedCustomer]);

  const itemSubtotal = useMemo(
    () =>
      form.items.reduce((sum, item) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unit_price);
        return sum + (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0);
      }, 0),
    [form.items],
  );

  function resetCreateOrderForm() {
    setForm(createInitialOrderForm());
    setCreateCustomerOpen(false);
    setCustomerQuery("");
    setCustomerResults([]);
    setSelectedCustomer(null);
    setCustomerSearchError(null);
    setPackageResults({});
    setPackageLoading({});
    setPackageErrors({});
    setProductPanelResults({});
    setProductPanelLoading({});
    setProductPanelErrors({});
  }

  function openCreateOrderModal() {
    resetCreateOrderForm();
    setOpenModal(true);
  }

  function closeCreateOrderModal() {
    if (isSaving) {
      return;
    }

    setCreateCustomerOpen(false);
    setOpenModal(false);
    resetCreateOrderForm();
  }

  function completeCreateOrderModal() {
    setCreateCustomerOpen(false);
    setOpenModal(false);
    resetCreateOrderForm();
  }

  function handleCustomerSelect(customerId: string) {
    setForm((current) => ({ ...current, customer_user_id: customerId }));
    setSelectedCustomer(customerResults.find((customer) => customer.id === customerId) ?? selectedCustomer);
  }

  async function handleCustomerCreated(createdCustomer: CreateCustomerRequest) {
    const searchTerm = createdCustomer.email.trim() || createdCustomer.name.trim();

    setCustomerQuery(searchTerm);
    setIsCustomerLoading(true);
    setCustomerSearchError(null);

    try {
      const payload = await getCustomers({
        page: 1,
        limit: 10,
        search: searchTerm || undefined,
        q: searchTerm || undefined,
        fields: ["id", "name", "fullName", "email"],
      });

      setCustomerResults(payload.data);

      const normalizedEmail = createdCustomer.email.trim().toLowerCase();
      const normalizedName = createdCustomer.name.trim().toLowerCase();
      const matchedCustomer =
        payload.data.find((customer) => customer.email.trim().toLowerCase() === normalizedEmail) ??
        payload.data.find((customer) => (customer.fullName || customer.name).trim().toLowerCase() === normalizedName) ??
        payload.data[0] ??
        null;

      if (matchedCustomer) {
        setSelectedCustomer(matchedCustomer);
        setForm((current) => ({ ...current, customer_user_id: matchedCustomer.id }));
      }
    } catch (loadError) {
      if (isDashboardSessionExpiredError(loadError)) {
        return;
      }

      setCustomerSearchError(getErrorMessage(loadError, "The new customer was created, but the refreshed search could not be loaded."));
    } finally {
      setIsCustomerLoading(false);
    }
  }

  function handleItemChange(key: string, field: keyof Omit<OrderFormItem, "key">, value: string) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    }));
  }

  function handleProductPanelSelect(key: string, panelId: string) {
    const panel = (productPanelResults[key] ?? []).find((record) => record.id === panelId);

    if (!panel) {
      handleItemChange(key, "item_id", panelId);
      return;
    }

    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.key === key
          ? {
              ...item,
              item_id: panel.id,
              name: panel.name,
              unit_price: String(panel.price ?? ""),
              catalog_search: item.catalog_search || panel.name,
            }
          : item,
      ),
    }));
  }

  function handlePackageSelect(key: string, packageId: string) {
    const pkg = (packageResults[key] ?? []).find((record) => record.id === packageId);

    if (!pkg) {
      handleItemChange(key, "item_id", packageId);
      return;
    }

    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.key === key
          ? {
              ...item,
              item_id: pkg.id,
              name: pkg.name,
              unit_price: String(pkg.price ?? ""),
              catalog_search: item.catalog_search || pkg.name,
            }
          : item,
      ),
    }));
  }

  function addItemRow() {
    setForm((current) => ({ ...current, items: [...current.items, createOrderItem()] }));
  }

  function removeItemRow(key: string) {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((item) => item.key !== key),
    }));
  }

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      await createOrder({
        customer_user_id: form.customer_user_id,
        status: form.status,
        currency: form.currency.trim() || "NGN",
        total_amount: Number(form.total_amount),
        notes: form.notes.trim(),
        items: form.items.map((item) => ({
          item_type: item.item_type,
          item_id: item.item_id.trim(),
          name: item.name.trim(),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          metadata: { additionalProp1: {} },
        })),
      });

      toast({
        title: "Order created",
        description: `${selectedCustomer ? selectedCustomer.fullName || selectedCustomer.name : "Customer"} order was created successfully.`,
        variant: "success",
      });

      completeCreateOrderModal();
      setPage(1);
      setRefreshKey((value) => value + 1);
    } catch (createError) {
      if (isDashboardSessionExpiredError(createError)) {
        return;
      }

      toast({
        title: "Create order failed",
        description: getErrorMessage(createError, "The order could not be created."),
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="dashboard-stack">
        <section className="stats-grid--three">
          <MetricCardSecondary title="Total Orders" value={(overview?.orders.total ?? pagination.total).toLocaleString()} icon="orders" spark={[20, 36, 48, 62, 42, 28]} />
          <MetricCardSecondary title="Completed Orders" value={(overview?.orders.byStatus.completed ?? 0).toLocaleString()} icon="verification" spark={[16, 24, 32, 44, 54, 62]} />
          <MetricCardSecondary title="Pending Orders" value={(overview?.orders.byStatus.pending ?? 0).toLocaleString()} icon="bundles" spark={[42, 38, 28, 22, 18, 12]} />
        </section>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Order List"
            action={
              canCreateOrders ? (
                <Button variant="primary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={openCreateOrderModal}>
                  Create Order
                </Button>
              ) : undefined
            }
          />
          <div className="dashboard-table-toolbar">
            <SearchField value={query} onChange={setQuery} placeholder="Search orders..." />
            <div className="inline-actions">
              <SelectField value={status} onChange={setStatus} options={statusOptions} />
            </div>
          </div>

          <ErrorMessage title="Order load failed" message={error} className="mx-6 mt-4" />

          {!isLoading && !rows.length && !error ? (
            <div className="p-6">
              <EmptyScaffold title="No orders found" description="No record found on the database" />
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
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Created</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Notes</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length ? (
                      filteredRows.map((order) => (
                        <tr key={order.id}>
                          <td className="table-checkbox-cell">
                            <Checkbox />
                          </td>
                          <td>{order.id}</td>
                          <td>
                            <div className="person-cell__text">
                              <strong>{order.customer_name}</strong>
                              <span>{order.customer_email}</span>
                            </div>
                          </td>
                          <td>{formatDateTimeLabel(order.created_at)}</td>
                          <td>{formatCurrencyLabel(order.total_amount, order.currency)}</td>
                          <td>
                            <StatusPill label={formatEnumLabel(order.status)} tone={toneFromStatus(order.status)} />
                          </td>
                          <td>{order.notes || "N/A"}</td>
                          <td className="text-right">
                            <Link href={`/orders/${order.id}`} className="inline-flex">
                              <IconButton label={`View ${order.id}`} icon={<EyeIcon className="menu-icon" />} />
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="cell-subtle">
                          {isLoading ? "Loading orders..." : "No orders matched the current filters."}
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
        onClose={closeCreateOrderModal}
        title="Create Order"
        size="lg"
        footer={<ModalFooterActions formId={orderFormId} cancelLabel="Cancel" submitLabel={isSaving ? "Creating..." : "Create Order"} onCancel={closeCreateOrderModal} disabled={isSaving} />}
      >
        <ErrorMessage title="Customer search failed" message={customerSearchError} />

        <form id={orderFormId} className="flex flex-col gap-5" onSubmit={handleCreateOrder}>
          <div className="grid gap-4">
            <FormField label="Search Customer" hint="Search by customer name. The matching users are loaded from the database.">
              <SearchField value={customerQuery} onChange={setCustomerQuery} placeholder="Search customers by name..." />
            </FormField>
            <FormField
              label="Customer"
              hint={
                isCustomerLoading
                  ? "Loading matching customers..."
                  : !customerSelectOptions.length
                    ? canCreateCustomers
                      ? "No matching customers found. Create one to continue."
                      : "No matching customers found."
                    : "Select the customer to attach to this order."
              }
            >
              <ModalSelect value={form.customer_user_id} onChange={handleCustomerSelect} options={customerSelectOptions} placeholder="Select a customer" required />
            </FormField>
            {!isCustomerLoading && !customerSelectOptions.length && canCreateCustomers ? (
              <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm text-[var(--text-soft)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>No customer matched this search. Create the customer now and continue with this order.</span>
                  <Button variant="secondary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={() => setCreateCustomerOpen(true)}>
                    Create Customer
                  </Button>
                </div>
              </div>
            ) : null}
            {selectedCustomer ? (
              <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-soft)]">
                Selected customer: <strong className="text-[var(--text)]">{selectedCustomer.fullName || selectedCustomer.name}</strong> - {selectedCustomer.email}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Status">
              <ModalSelect value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={orderStatusOptions} />
            </FormField>
            <FormField label="Currency">
              <ModalTextInput value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="NGN" />
            </FormField>
            <FormField label="Total Amount" hint={`Current item subtotal: ${formatCurrencyLabel(itemSubtotal, form.currency || "NGN")}`}>
              <input
                className="dashboard-input"
                type="number"
                min="0"
                step="0.01"
                value={form.total_amount}
                onChange={(event) => setForm((current) => ({ ...current, total_amount: event.target.value }))}
                placeholder="250000"
                required
              />
            </FormField>
          </div>

          <FormField label="Notes">
            <ModalTextArea value={form.notes} onChange={(value) => setForm((current) => ({ ...current, notes: value }))} placeholder="Internal note for this order" />
          </FormField>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="m-0 text-sm font-bold text-[var(--text)] sm:text-[15px]">Order Items</h3>
              <p className="mt-1 text-xs text-[var(--text-soft)]">Add at least one order item. Each item is submitted with its own type, ID, quantity, and unit price.</p>
            </div>
            <Button variant="secondary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={addItemRow}>
              Add Item
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            {form.items.map((item, index) => (
              <div key={item.key} className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <strong className="text-sm text-[var(--text)]">Item {index + 1}</strong>
                  <button
                    type="button"
                    className="icon-square-button is-danger"
                    aria-label={`Remove item ${index + 1}`}
                    onClick={() => removeItemRow(item.key)}
                    disabled={form.items.length === 1}
                  >
                    <TrashIcon className="mini-icon" />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Item Type">
                    <ModalSelect value={item.item_type} onChange={(value) => handleItemChange(item.key, "item_type", value)} options={orderItemTypeOptions} />
                  </FormField>
                  {item.item_type === "product" ? (
                    <>
                      <FormField label="Search Products" hint="Query active product panels by name or brand.">
                        <SearchField value={item.catalog_search} onChange={(value) => handleItemChange(item.key, "catalog_search", value)} placeholder="Search product panels..." />
                      </FormField>
                      <FormField
                        label="Product Panel"
                        hint={
                          productPanelLoading[item.key]
                            ? "Loading product panels..."
                            : productPanelErrors[item.key]
                              ? productPanelErrors[item.key] || undefined
                              : !(productPanelResults[item.key] ?? []).length
                                ? "No matching product panels found."
                                : "Select the product panel to attach to this order item."
                        }
                      >
                        <ModalSelect
                          value={item.item_id}
                          onChange={(value) => handleProductPanelSelect(item.key, value)}
                          options={[
                            ...(!item.item_id || (productPanelResults[item.key] ?? []).some((panel) => panel.id === item.item_id)
                              ? []
                              : [{ value: item.item_id, label: `${item.name || "Selected product"}${item.unit_price ? ` - ${formatCurrencyLabel(item.unit_price, form.currency || "NGN")}` : ""}` }]),
                            ...(productPanelResults[item.key] ?? []).map((panel) => ({
                              value: panel.id,
                              label: getProductPanelLabel(panel, form.currency || "NGN"),
                            })),
                          ]}
                          placeholder="Select a product panel"
                          required
                        />
                      </FormField>
                    </>
                  ) : null}
                  {item.item_type === "package" ? (
                    <>
                      <FormField label="Search Packages" hint="Query active packages by name.">
                        <SearchField value={item.catalog_search} onChange={(value) => handleItemChange(item.key, "catalog_search", value)} placeholder="Search packages..." />
                      </FormField>
                      <FormField
                        label="Package"
                        hint={
                          packageLoading[item.key]
                            ? "Loading packages..."
                            : packageErrors[item.key]
                              ? packageErrors[item.key] || undefined
                              : !(packageResults[item.key] ?? []).length
                                ? "No matching packages found."
                                : "Select the package to attach to this order item."
                        }
                      >
                        <ModalSelect
                          value={item.item_id}
                          onChange={(value) => handlePackageSelect(item.key, value)}
                          options={[
                            ...(!item.item_id || (packageResults[item.key] ?? []).some((pkg) => pkg.id === item.item_id)
                              ? []
                              : [{ value: item.item_id, label: `${item.name || "Selected package"}${item.unit_price ? ` - ${formatCurrencyLabel(item.unit_price, form.currency || "NGN")}` : ""}` }]),
                            ...(packageResults[item.key] ?? []).map((pkg) => ({
                              value: pkg.id,
                              label: getPackageLabel(pkg, form.currency || "NGN"),
                            })),
                          ]}
                          placeholder="Select a package"
                          required
                        />
                      </FormField>
                    </>
                  ) : null}
                  <FormField label="Item ID">
                    <input
                      className="dashboard-input"
                      type="text"
                      value={item.item_id}
                      onChange={(event) => handleItemChange(item.key, "item_id", event.target.value)}
                      placeholder="Enter item id"
                      readOnly={item.item_type === "product" || item.item_type === "package"}
                      required
                    />
                  </FormField>
                  <FormField label="Item Name">
                    <input
                      className="dashboard-input"
                      type="text"
                      value={item.name}
                      onChange={(event) => handleItemChange(item.key, "name", event.target.value)}
                      placeholder="3.5kW Home System"
                      readOnly={item.item_type === "product" || item.item_type === "package"}
                      required
                    />
                  </FormField>
                  <FormField label="Quantity">
                    <input
                      className="dashboard-input"
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(event) => handleItemChange(item.key, "quantity", event.target.value)}
                      placeholder="1"
                      required
                    />
                  </FormField>
                  <FormField label="Unit Price">
                    <input
                      className="dashboard-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(event) => handleItemChange(item.key, "unit_price", event.target.value)}
                      placeholder="250000"
                      required
                    />
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal>

      <CreateCustomerModal
        open={createCustomerOpen}
        onClose={() => setCreateCustomerOpen(false)}
        initialValues={customerQuery ? { email: customerQuery.includes("@") ? customerQuery.trim() : "", name: customerQuery.includes("@") ? "" : customerQuery.trim() } : undefined}
        onCreated={handleCustomerCreated}
        title="Create Customer For Order"
      />
    </>
  );
}
