"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { ChevronLeftIcon } from "@/components/dashboard/icons";
import { Button, InfoRow, Panel, SelectField, StatusPill, TextAreaField, TextField } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { formatCurrencyLabel, formatDateTimeLabel, formatEnumLabel, getOrder, updateOrder } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { OrderDetail } from "@/types/api.types";

const orderStatusOptions = ["pending", "processing", "completed", "cancelled"];

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [form, setForm] = useState({
    status: "pending",
    currency: "NGN",
    totalAmount: "0",
    notes: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getOrder(id)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setDetail(payload.data);
        setForm({
          status: payload.data.order.status,
          currency: payload.data.order.currency,
          totalAmount: payload.data.order.total_amount,
          notes: payload.data.order.notes ?? "",
        });
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(loadError, "Order details could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!detail) {
      return;
    }

    setIsSaving(true);

    try {
      await updateOrder(detail.order.id, {
        status: form.status,
        currency: form.currency,
        total_amount: Number(form.totalAmount) || 0,
        notes: form.notes,
      });

      const refreshed = await getOrder(detail.order.id);
      setDetail(refreshed.data);
      setForm({
        status: refreshed.data.order.status,
        currency: refreshed.data.order.currency,
        totalAmount: refreshed.data.order.total_amount,
        notes: refreshed.data.order.notes ?? "",
      });

      toast({
        title: "Order updated",
        description: `Order ${refreshed.data.order.id} was updated successfully.`,
        variant: "success",
      });
    } catch (saveError) {
      if (isDashboardActionCancelledError(saveError) || isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: "Update failed",
        description: getErrorMessage(saveError, "The order could not be updated."),
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="dashboard-stack">
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 pb-4 pt-6">
          <div className="inline-actions">
            <Link href="/orders" className="icon-button" aria-label="Back to orders">
              <ChevronLeftIcon className="menu-icon" />
            </Link>
            <h2 className="m-0 text-lg font-extrabold sm:text-[20px]">{detail ? `#${detail.order.id}` : isLoading ? "Loading order..." : "Order"}</h2>
          </div>
          {detail ? <StatusPill label={formatEnumLabel(detail.order.status)} tone={toneFromStatus(detail.order.status)} /> : null}
        </div>

        <ErrorMessage title="Order load failed" message={error} className="mx-6 mb-4" />

        <Panel className="mx-6 mb-6 border border-[var(--border)] shadow-none">
          <div className="grid gap-0 xl:grid-cols-3">
            <div className="border-b border-[var(--border)] p-6 xl:border-b-0 xl:border-r">
              <h3 className="m-0 text-sm font-bold sm:text-[15px]">Order Information</h3>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                <InfoRow label="Order ID" value={detail?.order.id || "N/A"} />
                <InfoRow label="Customer" value={detail?.order.customer_name || "N/A"} />
                <InfoRow label="Customer Email" value={detail?.order.customer_email || "N/A"} />
                <InfoRow label="Created" value={formatDateTimeLabel(detail?.order.created_at)} />
                <InfoRow label="Updated" value={formatDateTimeLabel(detail?.order.updated_at)} />
                <InfoRow label="Total Amount" value={detail ? formatCurrencyLabel(detail.order.total_amount, detail.order.currency) : "N/A"} />
                <InfoRow label="Currency" value={detail?.order.currency || "N/A"} />
                <InfoRow label="Notes" value={detail?.order.notes || "N/A"} />
              </div>
            </div>

            <div className="border-b border-[var(--border)] p-6 xl:border-b-0 xl:border-r">
              <h3 className="m-0 text-sm font-bold sm:text-[15px]">Order Items</h3>
              <div className="mt-5 flex flex-col gap-4">
                {detail?.items.length ? (
                  detail.items.map((item) => (
                    <div key={item.id} className="rounded-[16px] border border-[var(--border)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <strong>{item.name}</strong>
                        <span>{formatCurrencyLabel(item.unit_price, detail.order.currency)}</span>
                      </div>
                      <p className="mb-0 mt-2 text-sm text-[var(--text-soft)]">
                        {formatEnumLabel(item.item_type)} • Quantity {item.quantity}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="mt-4 text-sm text-[var(--text-soft)]">{isLoading ? "Loading items..." : "No order items were returned."}</p>
                )}
              </div>

              <div className="mt-8">
                <h4 className="m-0 text-sm font-bold sm:text-[15px]">Package Requests</h4>
                <div className="mt-4 flex flex-col gap-4">
                  {detail?.bundleRequests.length ? (
                    detail.bundleRequests.map((request) => (
                      <div key={request.id} className="rounded-[16px] border border-[var(--border)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <strong>{request.bundle_name}</strong>
                          <StatusPill label={formatEnumLabel(request.status)} tone={toneFromStatus(request.status)} solid={false} />
                        </div>
                        <p className="mb-0 mt-2 text-sm text-[var(--text-soft)]">{request.admin_note || "No admin note provided."}</p>
                      </div>
                    ))
                  ) : (
                    <p className="mt-4 text-sm text-[var(--text-soft)]">{isLoading ? "Loading package requests..." : "No package requests were returned for this order."}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6">
              <h3 className="m-0 text-sm font-bold sm:text-[15px]">Update Order</h3>
              <form className="mt-5 flex flex-col gap-4" onSubmit={handleSave}>
                <label className="form-field">
                  <span className="form-field__label">
                    <span>Status</span>
                  </span>
                  <SelectField value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={orderStatusOptions} />
                </label>

                <label className="form-field">
                  <span className="form-field__label">
                    <span>Currency</span>
                  </span>
                  <TextField value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))} placeholder="NGN" />
                </label>

                <label className="form-field">
                  <span className="form-field__label">
                    <span>Total Amount</span>
                  </span>
                  <TextField value={form.totalAmount} onChange={(event) => setForm((current) => ({ ...current, totalAmount: event.target.value }))} placeholder="250000" />
                </label>

                <label className="form-field">
                  <span className="form-field__label">
                    <span>Notes</span>
                  </span>
                  <TextAreaField value={form.notes} onChange={(value) => setForm((current) => ({ ...current, notes: value }))} placeholder="Order notes" rows={5} />
                </label>

                <Button type="submit" variant="primary" disabled={isLoading || isSaving || !detail}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </form>

              <div className="mt-8">
                <h4 className="m-0 text-sm font-bold sm:text-[15px]">Order Events</h4>
                <div className="mt-4 flex flex-col gap-4">
                  {detail?.events.length ? (
                    detail.events.map((event) => (
                      <div key={event.id} className="rounded-[16px] border border-[var(--border)] p-4">
                        <strong>{formatEnumLabel(event.kind)}</strong>
                        <p className="mb-0 mt-2 text-sm text-[var(--text-soft)]">{event.message}</p>
                        <small className="text-[var(--text-faint)]">{formatDateTimeLabel(event.created_at)}</small>
                      </div>
                    ))
                  ) : (
                    <p className="mt-4 text-sm text-[var(--text-soft)]">{isLoading ? "Loading events..." : "No order events were returned."}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </Panel>
    </div>
  );
}
