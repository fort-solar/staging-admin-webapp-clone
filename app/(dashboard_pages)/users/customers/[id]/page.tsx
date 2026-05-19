"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { ChevronLeftIcon } from "@/components/dashboard/icons";
import { Avatar, Button, InfoIcons, InfoRow, Panel, SelectField, StatusPill, TextAreaField, TextField } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { isDashboardSessionExpiredError } from "@/lib/api/client";
import { formatEnumLabel, formatManagedUserStatusLabel, getCustomer, normalizeManagedUserStatus, updateCustomer } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { CustomerRecord } from "@/types/api.types";

const statusOptions = ["active", "deactivated", "suspended"];

export default function CustomerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useAccessControl();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    status: "active",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canUpdateCustomer = can("customers", "update");

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getCustomer(id)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setCustomer(payload.data);
        setForm({
          name: payload.data.fullName || payload.data.name,
          phone: payload.data.phone ?? "",
          address: payload.data.address ?? "",
          status: normalizeManagedUserStatus(payload.data.status) || "active",
        });
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(loadError, "Customer details could not be loaded."));
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

    if (!customer) {
      return;
    }

    setIsSaving(true);

    try {
      await updateCustomer(customer.id, {
        name: form.name,
        phone: form.phone,
        address: form.address,
        status: form.status,
      });

      const refreshed = await getCustomer(customer.id);
      setCustomer(refreshed.data);
      setForm({
        name: refreshed.data.fullName || refreshed.data.name,
        phone: refreshed.data.phone ?? "",
        address: refreshed.data.address ?? "",
        status: normalizeManagedUserStatus(refreshed.data.status) || "active",
      });

      toast({
        title: "Customer updated",
        description: `${refreshed.data.fullName || refreshed.data.name} was updated successfully.`,
        variant: "success",
      });
    } catch (saveError) {
      if (isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: "Update failed",
        description: getErrorMessage(saveError, "The customer could not be updated."),
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Panel className="overflow-hidden">
      <div className="detail-hero">
        <div className="detail-hero__identity">
          <Link href="/users/customers" className="icon-button" aria-label="Back to customers">
            <ChevronLeftIcon className="menu-icon" />
          </Link>
          <Avatar src={customer?.avatar_url ?? undefined} alt={customer?.fullName || customer?.name || "Customer"} size="xl" />
          <div className="detail-hero__meta">
            <div className="inline-actions">
              <h2>{customer?.fullName || customer?.name || (isLoading ? "Loading customer..." : "Customer")}</h2>
              {customer ? <StatusPill label={formatManagedUserStatusLabel(customer.status)} tone={toneFromStatus(customer.status)} className="min-h-7.5!" /> : null}
            </div>
            <p>{customer?.email || "Customer email will appear here once the record loads."}</p>
          </div>
        </div>
      </div>

      <div className="detail-layout px-6 py-6">
        <Panel className="border border-[var(--border)] p-6 shadow-none">
          <h3 className="m-0 text-sm font-bold sm:text-[15px]">Customer Information</h3>
          <ErrorMessage title="Customer load failed" message={error} className="mt-4" />
          <div className="mt-4">
            <InfoRow icon={InfoIcons.mail} label="Email" value={customer?.email || "N/A"} />
            <InfoRow icon={InfoIcons.phone} label="Phone Number" value={customer?.phone || "N/A"} />
            <InfoRow icon={InfoIcons.filter} label="Address" value={customer?.address || "N/A"} />
            <InfoRow label="Customer ID" value={customer?.id || "N/A"} />
            <InfoRow label="Role" value={formatEnumLabel(customer?.role, "N/A")} />
            <InfoRow label="Email Verified" value={customer?.emailVerified ? "Yes" : "No"} />
          </div>
        </Panel>

        <Panel className="border border-[var(--border)] p-6 shadow-none">
          <div className="flex items-center justify-between gap-4">
            <h3 className="m-0 text-sm font-bold sm:text-[15px]">Update Customer</h3>
            {customer ? <StatusPill label={formatManagedUserStatusLabel(form.status)} tone={toneFromStatus(form.status)} solid={false} /> : null}
          </div>

          {!canUpdateCustomer ? (
            <p className="mt-4 text-sm text-[var(--text-soft)]">You do not have permission to update customer records.</p>
          ) : (
            <form className="mt-4 flex flex-col gap-4" onSubmit={handleSave}>
              <label className="form-field">
                <span className="form-field__label">
                  <span>Full Name</span>
                </span>
                <TextField value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Customer name" />
              </label>

              <label className="form-field">
                <span className="form-field__label">
                  <span>Phone Number</span>
                </span>
                <TextField value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+2348000000000" />
              </label>

              <label className="form-field">
                <span className="form-field__label">
                  <span>Status</span>
                </span>
                <SelectField value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={statusOptions} />
              </label>

              <label className="form-field">
                <span className="form-field__label">
                  <span>Address</span>
                </span>
                <TextAreaField value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} placeholder="Customer address" rows={5} />
              </label>

              <div className="inline-actions justify-end">
                <Button type="submit" variant="primary" disabled={isLoading || isSaving || !customer}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </Panel>
      </div>
    </Panel>
  );
}
