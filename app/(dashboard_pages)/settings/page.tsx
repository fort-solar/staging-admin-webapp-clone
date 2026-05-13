"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ErrorMessage } from "@/components/dashboard/error-message";
import {
  ActivityListItem,
  Avatar,
  InfoRow,
  Panel,
  StatusPill,
  Tabs,
  cx,
} from "@/components/dashboard/ui";
import {
  GlobeIcon,
  MailIcon,
  PhoneIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/dashboard/icons";
import { formatDateLabel, formatDateTimeLabel, formatEnumLabel } from "@/lib/admin-api";
import { dashboardGet, isDashboardSessionExpiredError } from "@/lib/api/client";
import { formatAdminRole } from "@/lib/auth/access-control";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus, type Tone } from "@/lib/dashboard-data";
import type { AdminMeApiResponse } from "@/types/api.types";
import type { AdminRole } from "@/types/common.types";

const settingsTabs = [
  "Personal Information",
  "Security",
  "Notifications",
  "Activity Log",
  "Preferences",
] as const;

type SettingsTab = (typeof settingsTabs)[number];

function SettingsField({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="form-field settings-field">
      <span className="form-field__label">
        {icon}
        <span>{label}</span>
      </span>
      {children}
    </label>
  );
}

function SettingsValue({ value }: { value: string }) {
  return <input className="dashboard-input" value={value} readOnly aria-readonly="true" />;
}

function SettingsSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="settings-switch-row">
      <div className="settings-switch__copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <button
        type="button"
        className={cx("settings-switch", checked && "is-active")}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        aria-label={label}
      >
        <span className="settings-switch__thumb" />
      </button>
    </div>
  );
}

function formatTextValue(value: string | null | undefined, fallback = "Not provided") {
  return value?.trim() ? value : fallback;
}

function formatAdminRoleValue(value: AdminRole | null | undefined) {
  return value ? formatAdminRole(value) : "Not provided";
}

function buildActivityItems({
  email,
  signedInAt,
  createdAt,
  emailVerified,
  permissions,
  status,
}: {
  email: string;
  signedInAt: string | null;
  createdAt: string | null;
  emailVerified: boolean;
  permissions: string[];
  status: string | null | undefined;
}) {
  const items: Array<{
    id: string;
    title: string;
    description: string;
    meta: string;
    tone: Tone;
  }> = [
    {
      id: "session",
      title: "Session Active",
      description: `Signed in as ${email}.`,
      meta: signedInAt ? formatDateTimeLabel(signedInAt) : "Sign-in time is not available yet.",
      tone: "success",
    },
    {
      id: "verification",
      title: emailVerified ? "Email Verified" : "Email Verification Pending",
      description: emailVerified
        ? "This admin email has already been verified."
        : "This admin email has not been verified yet.",
      meta: email,
      tone: emailVerified ? "success" : "warning",
    },
    {
      id: "permissions",
      title: "Permissions Loaded",
      description: permissions.length
        ? `${permissions.length} permissions are currently attached to this account.`
        : "No explicit permissions were returned for this account.",
      meta: permissions.length ? permissions.join(", ") : "Additional access data will appear here later.",
      tone: permissions.length ? "info" : "warning",
    },
  ];

  if (createdAt) {
    items.push({
      id: "created",
      title: "Account Created",
      description: `Account status is ${formatEnumLabel(status, "unknown").toLowerCase()}.`,
      meta: formatDateLabel(createdAt),
      tone: toneFromStatus(status ?? "unknown"),
    });
  }

  return items;
}

export default function SettingsPage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("Personal Information");
  const [profile, setProfile] = useState<AdminMeApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [browserTimeZone, setBrowserTimeZone] = useState("Detecting browser timezone...");
  const [appearance, setAppearance] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return window.localStorage.getItem("fortsolar:appearance") === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    let cancelled = false;

    dashboardGet<AdminMeApiResponse>("/api/v1/admin/me")
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setProfile(payload);
      })
      .catch((loadError) => {
        if (cancelled || isDashboardSessionExpiredError(loadError)) {
          return;
        }

        setError(getErrorMessage(loadError, "Account settings could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleAppearanceChange(event: Event) {
      const next = (event as CustomEvent<"light" | "dark">).detail;
      if (next === "light" || next === "dark") {
        setAppearance(next);
      }
    }

    window.addEventListener("fortsolar:appearance-change", handleAppearanceChange as EventListener);
    return () => window.removeEventListener("fortsolar:appearance-change", handleAppearanceChange as EventListener);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setBrowserTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Browser timezone not available");
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function applyAppearance(next: "light" | "dark") {
    setAppearance(next);
    window.localStorage.setItem("fortsolar:appearance", next);
    document.documentElement.dataset.dashboardAppearance = next;
    window.dispatchEvent(new CustomEvent("fortsolar:appearance-change", { detail: next }));
  }

  const account = profile?.user;
  const accountSession = profile?.session;
  const permissions = profile?.permissions ?? session?.permissions ?? [];
  const fullName = formatTextValue(
    account?.fullName ?? session?.user.fullName ?? accountSession?.fullName,
    "Admin",
  );
  const displayName = formatTextValue(account?.name ?? session?.user.name, fullName);
  const email = formatTextValue(account?.email ?? session?.user.email ?? accountSession?.email, "No email available");
  const phone = formatTextValue(account?.phone);
  const address = formatTextValue(account?.address);
  const statusValue = account?.status ?? session?.user.status ?? null;
  const statusLabel = formatEnumLabel(statusValue, "Unknown");
  const adminRoleValue = account?.adminRole ?? session?.user.adminRole ?? accountSession?.adminRole ?? null;
  const adminRoleLabel = formatAdminRoleValue(adminRoleValue);
  const platformRoleLabel = formatEnumLabel(account?.role ?? session?.user.role, "Unknown");
  const memberSince = account?.createdAt ? formatDateLabel(account.createdAt) : "Not available";
  const signedInAt = accountSession?.signedInAt ?? session?.session.signedInAt ?? null;
  const signedInLabel = signedInAt ? formatDateTimeLabel(signedInAt) : "Not available";
  const emailVerificationLabel = account?.emailVerified ? "Verified" : "Pending verification";
  const profileNote = isLoading
    ? "Refreshing account details..."
    : error
      ? "Showing the latest session snapshot."
      : signedInAt
        ? `Signed in ${signedInLabel}`
        : "Live account details loaded.";
  const activityItems = buildActivityItems({
    email,
    signedInAt,
    createdAt: account?.createdAt ?? null,
    emailVerified: Boolean(account?.emailVerified),
    permissions,
    status: statusValue,
  });

  return (
    <div className="dashboard-stack">
      <Panel className="settings-shell">
        <div className="settings-layout">
          <aside className="settings-summary">
            <div className="settings-summary__avatar-wrap">
              <Avatar alt={displayName} size="xl" className="settings-summary__avatar" />
            </div>

            <div className="settings-summary__identity">
              <h2>{fullName}</h2>
              <StatusPill label={statusLabel} tone={toneFromStatus(statusValue ?? "unknown")} solid={false} />
              <span className="settings-summary__photo-name">{profileNote}</span>
            </div>

            <div className="settings-summary__meta">
              <InfoRow icon={<PhoneIcon className="mini-icon" />} label="Phone Number" value={phone} />
              <InfoRow icon={<MailIcon className="mini-icon" />} label="Email" value={email} />
              <InfoRow icon={<ShieldIcon className="mini-icon" />} label="Admin Role" value={adminRoleLabel} />
              <InfoRow icon={<UsersIcon className="mini-icon" />} label="Member Since" value={memberSince} />
            </div>
          </aside>

          <section className="settings-panel">
            <Tabs value={activeTab} onChange={setActiveTab} options={settingsTabs} compact />
            <ErrorMessage title="Settings load failed" message={error} />

            {activeTab === "Personal Information" ? (
              <div className="settings-section">
                <div className="settings-section-heading">
                  <h3>Profile Details</h3>
                  <p>
                    {error
                      ? "The live profile request failed, so fallback session data is shown where possible."
                      : isLoading
                        ? "Refreshing your account details."
                        : "Current account details from the active admin session."}
                  </p>
                </div>

                <div className="settings-form-grid">
                  <SettingsField label="Full Name" icon={<UsersIcon className="mini-icon" />}>
                    <SettingsValue value={fullName} />
                  </SettingsField>
                  <SettingsField label="Display Name" icon={<UsersIcon className="mini-icon" />}>
                    <SettingsValue value={displayName} />
                  </SettingsField>
                  <SettingsField label="Email Address" icon={<MailIcon className="mini-icon" />}>
                    <SettingsValue value={email} />
                  </SettingsField>
                  <SettingsField label="Phone Number" icon={<PhoneIcon className="mini-icon" />}>
                    <SettingsValue value={phone} />
                  </SettingsField>
                  <SettingsField label="Address" icon={<GlobeIcon className="mini-icon" />}>
                    <SettingsValue value={address} />
                  </SettingsField>
                  <SettingsField label="Account Status" icon={<ShieldIcon className="mini-icon" />}>
                    <SettingsValue value={statusLabel} />
                  </SettingsField>
                  <SettingsField label="Platform Role" icon={<ShieldIcon className="mini-icon" />}>
                    <SettingsValue value={platformRoleLabel} />
                  </SettingsField>
                  <SettingsField label="Admin Role" icon={<ShieldIcon className="mini-icon" />}>
                    <SettingsValue value={adminRoleLabel} />
                  </SettingsField>
                  <SettingsField label="Member Since" icon={<UsersIcon className="mini-icon" />}>
                    <SettingsValue value={memberSince} />
                  </SettingsField>
                </div>

                <div className="settings-divider" />

                <div className="settings-section-heading">
                  <h3>Permissions</h3>
                  <p>Current access returned for this account.</p>
                </div>

                {permissions.length ? (
                  <div className="settings-checklist">
                    {permissions.map((permission) => (
                      <div className="settings-checklist__row" key={permission}>
                        <div className="settings-checklist__copy">
                          <strong>{permission}</strong>
                          <span>Granted to the current admin session.</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="settings-banner">No explicit permissions were returned for this account yet.</div>
                )}
              </div>
            ) : null}

            {activeTab === "Security" ? (
              <div className="settings-section">
                <div className="settings-section-heading">
                  <h3>Security Overview</h3>
                  <p>Session and verification details currently available from the backend.</p>
                </div>

                <div className="settings-summary__meta">
                  <InfoRow icon={<ShieldIcon className="mini-icon" />} label="Last Sign In" value={signedInLabel} />
                  <InfoRow icon={<MailIcon className="mini-icon" />} label="Email Verification" value={emailVerificationLabel} />
                  <InfoRow icon={<ShieldIcon className="mini-icon" />} label="Account Status" value={statusLabel} />
                  <InfoRow icon={<UsersIcon className="mini-icon" />} label="Permissions" value={`${permissions.length} granted`} />
                </div>

                <div className="settings-divider" />
                <div className="settings-banner">
                  Password changes and two-factor controls will be connected when those backend fields and endpoints are added.
                </div>
              </div>
            ) : null}

            {activeTab === "Notifications" ? (
              <div className="settings-section">
                <div className="settings-section-heading">
                  <h3>Notification Preferences</h3>
                  <p>Notification-specific settings are not exposed by `/api/v1/admin/me` yet.</p>
                </div>

                <div className="settings-banner">
                  This tab is ready for backend notification fields when they are added. For now, the active contact email is shown below.
                </div>

                <div className="settings-summary__meta">
                  <InfoRow icon={<MailIcon className="mini-icon" />} label="Notification Email" value={email} />
                </div>
              </div>
            ) : null}

            {activeTab === "Activity Log" ? (
              <div className="settings-activity">
                {activityItems.map((item) => (
                  <ActivityListItem
                    key={item.id}
                    title={item.title}
                    description={item.description}
                    meta={item.meta}
                    tone={item.tone}
                  />
                ))}
              </div>
            ) : null}

            {activeTab === "Preferences" ? (
              <div className="settings-section">
                <div className="settings-section-heading">
                  <h3>Local Preferences</h3>
                  <p>These preferences are available in this browser while server-backed settings are still being added.</p>
                </div>

                <SettingsSwitch
                  checked={appearance === "dark"}
                  onChange={(next) => applyAppearance(next ? "dark" : "light")}
                  label="Dark Mode"
                  description="Switch between light and dark interface theme"
                />

                <div className="settings-divider" />

                <div className="settings-summary__meta">
                  <InfoRow icon={<GlobeIcon className="mini-icon" />} label="Browser Timezone" value={browserTimeZone} />
                  <InfoRow icon={<ShieldIcon className="mini-icon" />} label="Theme Mode" value={appearance === "dark" ? "Dark" : "Light"} />
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </Panel>
    </div>
  );
}
