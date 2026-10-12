"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormField, Modal } from "@/components/dashboard/modals";
import { CopyIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import {
  Button,
  EmptyScaffold,
  MetricCardSecondary,
  Pagination,
  Panel,
  PanelHeader,
  SearchField,
  SelectField,
  StatusPill,
  TextAreaField,
  TextField,
  cx,
} from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import {
  DEFAULT_PAGE_SIZE,
  formatDateLabel,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getProducts,
} from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import type { CouponRecord, CreateCouponRequest, PaginationMeta, AdminProductRecord } from "@/types/api.types";

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

const statusFilterOptions = [
  { label: "All Coupons", value: "All" },
  { label: "Active", value: "true" },
  { label: "Inactive", value: "false" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function DiscountCouponsPage() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [products, setProducts] = useState<AdminProductRecord[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [targetType, setTargetType] = useState<"all" | "specific">("all");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const deferredQuery = useDeferredValue(query);

  // Load products for product selector
  useEffect(() => {
    getProducts({ limit: 100 })
      .then((res) => {
        if (res.data) setProducts(res.data);
      })
      .catch(() => undefined);
  }, []);

  // Fetch coupons
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const activeParam: "true" | "false" | undefined =
      statusFilter === "true" ? "true" : statusFilter === "false" ? "false" : undefined;

    getCoupons({
      page,
      limit,
      search: deferredQuery.trim() || undefined,
      is_active: activeParam,
    })
      .then((payload) => {
        if (cancelled) return;
        setCoupons(payload.data || []);
        if (payload.pagination) setPagination(payload.pagination);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getErrorMessage(err, "Failed to load discount coupons."));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, limit, deferredQuery, statusFilter, refreshKey]);

  // Metric counts
  const metrics = useMemo(() => {
    const total = pagination.total || coupons.length;
    const now = new Date();
    const activeCount = coupons.filter(
      (c) => c.is_active && new Date(c.expiry_date) > now,
    ).length;
    const totalRedemptions = coupons.reduce((sum, c) => sum + (c.times_used || 0), 0);
    const expiredCount = coupons.filter(
      (c) => new Date(c.expiry_date) <= now || !c.is_active,
    ).length;

    return { total, activeCount, totalRedemptions, expiredCount };
  }, [coupons, pagination.total]);

  function handleOpenCreateModal() {
    setEditingCoupon(null);
    setCode("");
    setDescription("");
    setDiscountType("percentage");
    setDiscountValue("");
    setMinOrderAmount("0");
    setMaxDiscountAmount("");
    setStartDate(new Date().toISOString().slice(0, 10));
    // Default expiry 30 days ahead
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    setExpiryDate(nextMonth.toISOString().slice(0, 10));
    setUsageLimit("");
    setIsActive(true);
    setTargetType("all");
    setSelectedProductIds([]);
    setIsModalOpen(true);
  }

  function handleOpenEditModal(coupon: CouponRecord) {
    setEditingCoupon(coupon);
    setCode(coupon.code);
    setDescription(coupon.description || "");
    setDiscountType(coupon.discount_type);
    setDiscountValue(String(coupon.discount_value));
    setMinOrderAmount(String(coupon.min_order_amount || 0));
    setMaxDiscountAmount(coupon.max_discount_amount ? String(coupon.max_discount_amount) : "");
    setStartDate(coupon.start_date ? new Date(coupon.start_date).toISOString().slice(0, 10) : "");
    setExpiryDate(coupon.expiry_date ? new Date(coupon.expiry_date).toISOString().slice(0, 10) : "");
    setUsageLimit(coupon.usage_limit ? String(coupon.usage_limit) : "");
    setIsActive(coupon.is_active);
    if (coupon.applicable_product_ids && coupon.applicable_product_ids.length > 0) {
      setTargetType("specific");
      setSelectedProductIds(coupon.applicable_product_ids);
    } else {
      setTargetType("all");
      setSelectedProductIds([]);
    }
    setIsModalOpen(true);
  }

  async function handleSubmitCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      toast({ title: "Validation error", description: "Coupon code is required.", variant: "error" });
      return;
    }
    const val = Number(discountValue);
    if (Number.isNaN(val) || val <= 0) {
      toast({ title: "Validation error", description: "Enter a valid positive discount value.", variant: "error" });
      return;
    }
    if (discountType === "percentage" && val > 100) {
      toast({ title: "Validation error", description: "Percentage discount cannot exceed 100%.", variant: "error" });
      return;
    }
    if (!expiryDate) {
      toast({ title: "Validation error", description: "Expiration date is required.", variant: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateCouponRequest = {
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        discount_type: discountType,
        discount_value: val,
        min_order_amount: Number(minOrderAmount) || 0,
        max_discount_amount: maxDiscountAmount.trim() ? Number(maxDiscountAmount) : null,
        start_date: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
        expiry_date: new Date(expiryDate).toISOString(),
        usage_limit: usageLimit.trim() ? Number(usageLimit) : null,
        is_active: isActive,
        applicable_product_ids: targetType === "specific" ? selectedProductIds : [],
      };

      if (editingCoupon) {
        await updateCoupon(editingCoupon.id, payload);
        toast({ title: "Coupon updated", description: `Coupon ${payload.code} updated successfully.`, variant: "success" });
      } else {
        await createCoupon(payload);
        toast({ title: "Coupon created", description: `Coupon ${payload.code} created successfully.`, variant: "success" });
      }
      setIsModalOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast({
        title: "Operation failed",
        description: getErrorMessage(err, "Failed to save discount coupon."),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteCoupon(id: string, couponCode: string) {
    if (!confirm(`Are you sure you want to delete coupon ${couponCode}? This action cannot be reversed.`)) {
      return;
    }
    try {
      await deleteCoupon(id);
      toast({ title: "Coupon deleted", description: `Coupon ${couponCode} was removed.`, variant: "success" });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast({ title: "Delete failed", description: getErrorMessage(err), variant: "error" });
    }
  }

  async function handleToggleStatus(coupon: CouponRecord) {
    try {
      await updateCoupon(coupon.id, { is_active: !coupon.is_active });
      toast({
        title: coupon.is_active ? "Coupon deactivated" : "Coupon activated",
        description: `Coupon ${coupon.code} is now ${!coupon.is_active ? "active" : "inactive"}.`,
        variant: "success",
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast({ title: "Status update failed", description: getErrorMessage(err), variant: "error" });
    }
  }

  function copyCode(c: string) {
    navigator.clipboard?.writeText(c);
    toast({ title: "Copied!", description: `Coupon code "${c}" copied to clipboard.`, variant: "success" });
  }

  return (
    <div className="dashboard-stack">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-title">Discount Coupons</h2>
          <p className="section-description">
            Create promotional discount codes with expiration dates, minimum spends, and product-specific eligibility.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenCreateModal}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Create Coupon
        </Button>
      </div>

      {/* Metrics Banner */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCardSecondary title="Total Coupons" value={metrics.total.toLocaleString()} icon="products" spark={[12, 18, 24, 30, 36, 42]} />
        <MetricCardSecondary title="Active Promotions" value={metrics.activeCount.toLocaleString()} icon="verification" spark={[10, 18, 22, 30, 38, 46]} />
        <MetricCardSecondary title="Total Times Used" value={metrics.totalRedemptions.toLocaleString()} icon="sales" spark={[14, 20, 26, 34, 44, 52]} />
        <MetricCardSecondary title="Expired / Inactive" value={metrics.expiredCount.toLocaleString()} icon="calendar" spark={[8, 12, 16, 20, 24, 28]} />
      </div>

      {/* Directory & Table Panel */}
      <Panel>
        <PanelHeader
          title="Promotional Codes"
          description="Manage retail discounts applied by customers during storefront checkout."
        />

        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <SearchField
              value={query}
              onChange={(val) => {
                setQuery(val);
                setPage(1);
              }}
              placeholder="Search coupon code or note..."
            />
          </div>
          <div className="w-full sm:w-48">
            <SelectField
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
              options={statusFilterOptions}
            />
          </div>
        </div>

        {error ? (
          <div className="p-6">
            <ErrorMessage message={error} />
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center text-sm text-[var(--text-soft)]">
            Loading discount coupons...
          </div>
        ) : coupons.length === 0 ? (
          <EmptyScaffold
            title="No discount coupons found"
            description="Create your first discount coupon code to reward loyal customers and run promotions."
            action={
              <Button variant="primary" onClick={handleOpenCreateModal}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Create Coupon
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="dashboard-table w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs font-semibold uppercase text-[var(--text-soft)]">
                  <th className="px-5 py-3">Code & Description</th>
                  <th className="px-5 py-3">Discount</th>
                  <th className="px-5 py-3">Min Order</th>
                  <th className="px-5 py-3">Applicability</th>
                  <th className="px-5 py-3">Expiry Date</th>
                  <th className="px-5 py-3">Redemptions</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {coupons.map((coupon) => {
                  const isExpired = new Date(coupon.expiry_date) <= new Date();
                  const targetCount = coupon.applicable_product_ids?.length || 0;

                  return (
                    <tr key={coupon.id} className="hover:bg-[var(--surface-muted)] transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-bold tracking-wider text-[var(--text)]">
                            {coupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyCode(coupon.code)}
                            className="text-[var(--text-soft)] hover:text-[var(--brand)] transition p-1"
                            title="Copy code"
                          >
                            <CopyIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {coupon.description ? (
                          <p className="mt-0.5 text-xs text-[var(--text-soft)] line-clamp-1">
                            {coupon.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 font-semibold text-[var(--text)]">
                        {coupon.discount_type === "percentage" ? (
                          <span>
                            {coupon.discount_value}% Off
                            {coupon.max_discount_amount ? (
                              <span className="block text-xs font-normal text-[var(--text-soft)]">
                                Max: {formatCurrency(coupon.max_discount_amount)}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span>{formatCurrency(coupon.discount_value)} Off</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[var(--text-soft)]">
                        {coupon.min_order_amount > 0 ? formatCurrency(coupon.min_order_amount) : "No minimum"}
                      </td>
                      <td className="px-5 py-4">
                        {targetCount === 0 ? (
                          <span className="inline-flex items-center rounded-md bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text)]">
                            All Products
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                            {targetCount} Specific {targetCount === 1 ? "Product" : "Products"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={isExpired ? "text-rose-600 font-semibold" : "text-[var(--text)]"}>
                          {formatDateLabel(coupon.expiry_date)}
                        </span>
                        {isExpired ? (
                          <span className="block text-[10px] text-rose-500 font-bold uppercase">Expired</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-[var(--text)]">
                        <span>
                          {coupon.times_used}{" "}
                          <span className="text-xs text-[var(--text-soft)]">
                            / {coupon.usage_limit ? coupon.usage_limit : "∞"}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill
                          label={!coupon.is_active ? "Inactive" : isExpired ? "Expired" : "Active"}
                          tone={
                            !coupon.is_active
                              ? "neutral"
                              : isExpired
                                ? "danger"
                                : "success"
                          }
                        />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(coupon)}
                            className="rounded-lg border border-[var(--field-border)] px-2.5 py-1 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] transition"
                          >
                            {coupon.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(coupon)}
                            className="rounded-lg border border-[var(--field-border)] px-2.5 py-1 text-xs font-medium text-[var(--brand)] hover:bg-[var(--brand-soft)] transition"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCoupon(coupon.id, coupon.code)}
                            className="rounded-lg border border-[var(--field-border)] p-1 text-rose-600 hover:bg-rose-50 transition"
                            title="Delete coupon"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-[var(--border)] p-4">
          <Pagination
            page={page}
            totalPages={Math.max(1, pagination.totalPages)}
            onChange={setPage}
          />
        </div>
      </Panel>

      {/* Create / Edit Coupon Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : "Create Discount Coupon"}
        size="lg"
      >
        <form onSubmit={handleSubmitCoupon} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Coupon Code *">
              <input
                className="dashboard-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                placeholder="e.g. SOLARPROMO10"
                required
              />
            </FormField>

            <FormField label="Discount Type">
              <SelectField
                value={discountType}
                onChange={(val) => setDiscountType(val as "percentage" | "fixed")}
                options={[
                  { label: "Percentage (%) Off", value: "percentage" },
                  { label: "Fixed Amount (₦) Off", value: "fixed" },
                ]}
              />
            </FormField>
          </div>

          <FormField label="Internal Campaign Note / Description">
            <TextAreaField
              value={description}
              onChange={setDescription}
              placeholder="e.g. Easter promotion for residential battery packages"
              rows={2}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={discountType === "percentage" ? "Discount Percentage (%) *" : "Discount Amount (₦) *"}>
              <input
                className="dashboard-input"
                type="number"
                min="1"
                max={discountType === "percentage" ? "100" : undefined}
                step="any"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percentage" ? "10" : "50000"}
                required
              />
            </FormField>

            <FormField label="Minimum Order Spend (₦)">
              <input
                className="dashboard-input"
                type="number"
                min="0"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                placeholder="0"
              />
            </FormField>

            <FormField label="Maximum Discount Cap (₦)">
              <input
                className="dashboard-input"
                type="number"
                min="0"
                value={maxDiscountAmount}
                onChange={(e) => setMaxDiscountAmount(e.target.value)}
                placeholder="Leave blank for no cap"
                disabled={discountType === "fixed"}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Start Date">
              <input
                className="dashboard-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FormField>

            <FormField label="Expiry Date *">
              <input
                className="dashboard-input"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
              />
            </FormField>

            <FormField label="Total Usage Limit">
              <input
                className="dashboard-input"
                type="number"
                min="1"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="Unlimited"
              />
            </FormField>
          </div>

          {/* Product Eligibility Scope */}
          <div className="rounded-xl border border-[var(--field-border)] bg-[var(--surface-muted)] p-4">
            <span className="block text-sm font-semibold text-[var(--text)] mb-2">
              Product Eligibility
            </span>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
                <input
                  type="radio"
                  name="targetType"
                  value="all"
                  checked={targetType === "all"}
                  onChange={() => setTargetType("all")}
                  className="accent-[#168416]"
                />
                Applicable to all catalog products
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
                <input
                  type="radio"
                  name="targetType"
                  value="specific"
                  checked={targetType === "specific"}
                  onChange={() => setTargetType("specific")}
                  className="accent-[#168416]"
                />
                Restrict to specific products
              </label>
            </div>

            {targetType === "specific" ? (
              <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
                {products.length === 0 ? (
                  <p className="text-xs text-[var(--text-soft)]">Loading catalog products...</p>
                ) : (
                  products.map((p) => {
                    const checked = selectedProductIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={cx(
                          "flex cursor-pointer items-center justify-between rounded-md px-3 py-1.5 text-xs transition",
                          checked ? "bg-[var(--brand-soft)] font-semibold text-[var(--brand)]" : "hover:bg-[var(--surface-muted)] text-[var(--text)]",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProductIds((prev) => [...prev, p.id]);
                              } else {
                                setSelectedProductIds((prev) => prev.filter((id) => id !== p.id));
                              }
                            }}
                            className="accent-[#168416]"
                          />
                          <span>{p.name}</span>
                        </div>
                        <span className="text-[var(--text-soft)]">{formatCurrency(p.price)}</span>
                      </label>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-[#168416]"
            />
            <label htmlFor="isActiveCheck" className="text-sm font-medium text-[var(--text)]">
              Coupon is active and redeemable immediately
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingCoupon ? "Save Changes" : "Create Coupon"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
