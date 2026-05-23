"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { ChevronLeftIcon } from "@/components/dashboard/icons";
import { Avatar, Button, InfoIcons, InfoRow, Panel, SelectField, StatusPill, TextAreaField, TextField } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { formatEnumLabel, formatManagedUserStatusLabel, getInstaller, normalizeManagedUserStatus, updateInstaller } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { InstallerRecord } from "@/types/api.types";

const statusOptions = [
  { label: "Active", value: "active" },
  { label: "Deactivated", value: "inactive" },
];

export default function InstallerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useAccessControl();
  const { toast } = useToast();
  const [installer, setInstaller] = useState<InstallerRecord | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    status: "active",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canUpdateInstaller = can("installers", "update");

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getInstaller(id)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setInstaller(payload.data);
        setForm({
          name: payload.data.user.fullName || payload.data.user.name,
          phone: payload.data.user.phone ?? "",
          address: payload.data.user.address ?? "",
          status: normalizeManagedUserStatus(payload.data.user.status) || "active",
        });
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(loadError, "Installer details could not be loaded."));
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

    if (!installer) {
      return;
    }

    setIsSaving(true);

    try {
      await updateInstaller(installer.user.id, {
        name: form.name,
        phone: form.phone,
        address: form.address,
        status: form.status,
      });

      const refreshed = await getInstaller(installer.user.id);
      setInstaller(refreshed.data);
      setForm({
        name: refreshed.data.user.fullName || refreshed.data.user.name,
        phone: refreshed.data.user.phone ?? "",
        address: refreshed.data.user.address ?? "",
        status: normalizeManagedUserStatus(refreshed.data.user.status) || "active",
      });

      toast({
        title: "Installer updated",
        description: `${refreshed.data.user.fullName || refreshed.data.user.name} was updated successfully.`,
        variant: "success",
      });
    } catch (saveError) {
      if (isDashboardActionCancelledError(saveError) || isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: "Update failed",
        description: getErrorMessage(saveError, "The installer could not be updated."),
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
          <Link href="/users/installers" className="icon-button" aria-label="Back to installers">
            <ChevronLeftIcon className="menu-icon" />
          </Link>
          <Avatar src={installer?.user.avatar_url ?? undefined} alt={installer?.user.fullName || installer?.user.name || "Installer"} size="xl" />
          <div className="detail-hero__meta">
            <div className="inline-actions">
              <h2>{installer?.user.fullName || installer?.user.name || (isLoading ? "Loading installer..." : "Installer")}</h2>
              {installer ? <StatusPill label={formatManagedUserStatusLabel(installer.user.status)} tone={toneFromStatus(installer.user.status)} /> : null}
            </div>
            <p>{installer?.user.email || "Installer email will appear here once the record loads."}</p>
          </div>
        </div>
      </div>

      <div className="detail-layout px-6 py-6">
        <Panel className="border border-[var(--border)] p-6 shadow-none">
          <h3 className="m-0 text-sm font-bold sm:text-[15px]">Installer Information</h3>
          <ErrorMessage title="Installer load failed" message={error} className="mt-4" />
          <div className="mt-4">
            <InfoRow icon={InfoIcons.mail} label="Email" value={installer?.user.email || "N/A"} />
            <InfoRow icon={InfoIcons.phone} label="Phone Number" value={installer?.user.phone || "N/A"} />
            <InfoRow icon={InfoIcons.filter} label="Address" value={installer?.user.address || "N/A"} />
            <InfoRow label="Company Name" value={installer?.installerProfile.companyName || "N/A"} />
            <InfoRow label="Availability" value={formatEnumLabel(installer?.installerProfile.availabilityStatus, "N/A")} />
            <InfoRow label="Experience" value={`${installer?.installerProfile.experienceYears ?? 0} years`} />
            <InfoRow label="Rating" value={installer?.installerProfile.rating ? `${installer.installerProfile.rating.toFixed(1)} / 5` : "N/A"} />
            <InfoRow label="Jobs Completed" value={`${installer?.installerProfile.totalJobsCompleted ?? 0}`} />
            <InfoRow label="Location" value={[installer?.installerProfile.city, installer?.installerProfile.state].filter(Boolean).join(", ") || "N/A"} />
          </div>
        </Panel>

        <Panel className="border border-[var(--border)] p-6 shadow-none">
          <div className="flex items-center justify-between gap-4">
            <h3 className="m-0 text-sm font-bold sm:text-[15px]">Update Installer</h3>
            {installer ? <StatusPill label={formatManagedUserStatusLabel(form.status)} tone={toneFromStatus(form.status)} solid={false} /> : null}
          </div>

          {!canUpdateInstaller ? (
            <p className="mt-4 text-sm text-[var(--text-soft)]">You do not have permission to update installer records.</p>
          ) : (
            <form className="mt-4 flex flex-col gap-4" onSubmit={handleSave}>
              <label className="form-field">
                <span className="form-field__label">
                  <span>Full Name</span>
                </span>
                <TextField value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Installer name" />
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
                <TextAreaField value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} placeholder="Installer address" rows={5} />
              </label>

              <div className="inline-actions justify-end">
                <Button type="submit" variant="primary" disabled={isLoading || isSaving || !installer}>
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
