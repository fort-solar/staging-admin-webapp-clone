"use client";

import { use, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { ChevronLeftIcon } from "@/components/dashboard/icons";
import { Avatar, Button, InfoIcons, InfoRow, Panel, SelectField, StatusPill, TextAreaField, TextField } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { formatEnumLabel, formatManagedUserStatusLabel, getAdmin, normalizeManagedUserStatus, updateAdmin } from "@/lib/admin-api";
import { getAdminRoleAccessSummary, getKnownAdminRoleOptions } from "@/lib/auth/access-control";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { AdminRecord } from "@/types/api.types";

const statusOptions = [
  { label: "Active", value: "active" },
  { label: "Deactivated", value: "inactive" },
];
const roleOptions = getKnownAdminRoleOptions();

export default function AdminDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useAccessControl();
  const { toast } = useToast();
  const [admin, setAdmin] = useState<AdminRecord | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    status: "active",
    adminRole: "operations_manager",
  });
  const selectedRoleSummary = useMemo(() => getAdminRoleAccessSummary(form.adminRole), [form.adminRole]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canUpdateAdmin = can("admins", "update");

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getAdmin(id)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setAdmin(payload.data);
        setForm({
          name: payload.data.fullName || payload.data.name,
          phone: payload.data.phone ?? "",
          address: payload.data.address ?? "",
          status: normalizeManagedUserStatus(payload.data.status) || "active",
          adminRole: payload.data.adminRole,
        });
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(loadError, "Admin details could not be loaded."));
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

    if (!admin) {
      return;
    }

    setIsSaving(true);

    try {
      await updateAdmin(admin.id, {
        name: form.name,
        phone: form.phone,
        address: form.address,
        status: form.status,
        adminRole: form.adminRole,
      });

      const refreshed = await getAdmin(admin.id);
      setAdmin(refreshed.data);
      setForm({
        name: refreshed.data.fullName || refreshed.data.name,
        phone: refreshed.data.phone ?? "",
        address: refreshed.data.address ?? "",
        status: normalizeManagedUserStatus(refreshed.data.status) || "active",
        adminRole: refreshed.data.adminRole,
      });

      toast({
        title: "Admin updated",
        description: `${refreshed.data.fullName || refreshed.data.name} was updated successfully.`,
        variant: "success",
      });
    } catch (saveError) {
      if (isDashboardActionCancelledError(saveError) || isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: "Update failed",
        description: getErrorMessage(saveError, "The admin could not be updated."),
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
          <Link href="/users/admins" className="icon-button" aria-label="Back to admins">
            <ChevronLeftIcon className="menu-icon" />
          </Link>
          <Avatar src={admin?.avatar_url ?? undefined} alt={admin?.fullName || admin?.name || "Admin"} size="xl" />
          <div className="detail-hero__meta">
            <div className="inline-actions">
              <h2>{admin?.fullName || admin?.name || (isLoading ? "Loading admin..." : "Admin")}</h2>
              {admin ? <StatusPill label={formatManagedUserStatusLabel(admin.status)} tone={toneFromStatus(admin.status)} /> : null}
            </div>
            <p>{admin?.email || "Admin email will appear here once the record loads."}</p>
          </div>
        </div>
      </div>

      <div className="detail-layout px-6 py-6">
        <Panel className="border border-[var(--border)] p-6 shadow-none">
          <h3 className="m-0 text-sm font-bold sm:text-[15px]">Admin Information</h3>
          <ErrorMessage title="Admin load failed" message={error} className="mt-4" />
          <div className="mt-4">
            <InfoRow icon={InfoIcons.mail} label="Email" value={admin?.email || "N/A"} />
            <InfoRow icon={InfoIcons.phone} label="Phone Number" value={admin?.phone || "N/A"} />
            <InfoRow icon={InfoIcons.filter} label="Address" value={admin?.address || "N/A"} />
            <InfoRow label="Admin ID" value={admin?.id || "N/A"} />
            <InfoRow label="Role" value={formatEnumLabel(admin?.adminRole, "N/A")} />
            <InfoRow label="Email Verified" value={admin?.emailVerified ? "Yes" : "No"} />
          </div>
        </Panel>

        <Panel className="border border-[var(--border)] p-6 shadow-none">
          <div className="flex items-center justify-between gap-4">
            <h3 className="m-0 text-sm font-bold sm:text-[15px]">Update Admin</h3>
            {admin ? <StatusPill label={formatManagedUserStatusLabel(form.status)} tone={toneFromStatus(form.status)} solid={false} /> : null}
          </div>

          {!canUpdateAdmin ? (
            <p className="mt-4 text-sm text-[var(--text-soft)]">You do not have permission to update admin records.</p>
          ) : (
            <form className="mt-4 flex flex-col gap-4" onSubmit={handleSave}>
              <label className="form-field">
                <span className="form-field__label">
                  <span>Full Name</span>
                </span>
                <TextField value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Admin name" />
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
                  <span>Admin Role</span>
                </span>
                <div className="flex flex-col gap-3">
                  <SelectField value={form.adminRole} onChange={(value) => setForm((current) => ({ ...current, adminRole: value }))} options={roleOptions} />
                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">Role access</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text)]">{selectedRoleSummary.description}</p>
                    <ul className="mt-2 grid list-disc gap-x-5 gap-y-1 pl-4 text-xs leading-5 text-[var(--text-soft)] sm:grid-cols-2">
                      {selectedRoleSummary.capabilities.map((capability) => (
                        <li key={capability}>{capability}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </label>

              <label className="form-field">
                <span className="form-field__label">
                  <span>Address</span>
                </span>
                <TextAreaField value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} placeholder="Admin address" rows={5} />
              </label>

              <div className="inline-actions justify-end">
                <Button type="submit" variant="primary" disabled={isLoading || isSaving || !admin}>
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
