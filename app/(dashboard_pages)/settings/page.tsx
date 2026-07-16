"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useNotifications } from "@/components/dashboard/notifications-provider";
import { ErrorMessage } from "@/components/dashboard/error-message";
import {
  ActivityListItem,
  Avatar,
  Button,
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
import { normalizeAdminActivity } from "@/lib/admin-activity";
import { formatDateLabel, formatDateTimeLabel, formatEnumLabel, formatManagedUserStatusLabel, getAdminActivity } from "@/lib/admin-api";
import { dashboardGet, isDashboardSessionExpiredError, submitDashboardForm } from "@/lib/api/client";
import { formatAdminRole } from "@/lib/auth/access-control";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus, type Tone } from "@/lib/dashboard-data";
import type { AdminActivityRecord, AdminMeApiResponse } from "@/types/api.types";
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
      description: `Account status is ${formatManagedUserStatusLabel(status, "unknown").toLowerCase()}.`,
      meta: formatDateLabel(createdAt),
      tone: toneFromStatus(status ?? "unknown"),
    });
  }

  return items;
}

export default function SettingsPage() {
  const { session, refreshSession } = useAuth();
  const {
    notifications,
    markRead,
    browserNotificationStatus,
    isPermissionSubmitting,
    openBrowserNotificationsPrompt,
    refreshBrowserNotificationStatus,
    requestBrowserNotifications,
  } = useNotifications();
  const [activeTab, setActiveTab] = useState<SettingsTab>("Personal Information");
  const [profile, setProfile] = useState<AdminMeApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityRows, setActivityRows] = useState<AdminActivityRecord[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [browserTimeZone, setBrowserTimeZone] = useState("Detecting browser timezone...");
  const [appearance, setAppearance] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return window.localStorage.getItem("fortsolar:appearance") === "dark" ? "dark" : "light";
  });

  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);

  useEffect(() => {
    if (profile?.user) {
      setProfileName(profile.user.name || "");
      setProfilePhone(profile.user.phone || "");
      setProfileAddress(profile.user.address || "");
    }
  }, [profile]);

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
  }, [profileRefreshKey]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSaveError(null);
    setProfileSaveSuccess(false);

    try {
      await submitDashboardForm(
        "/api/v1/auth/me",
        {
          name: profileName,
          phone: profilePhone,
          address: profileAddress,
        },
        { method: "PATCH" }
      );
      setProfileSaveSuccess(true);
      await refreshSession();
      setProfileRefreshKey((k) => k + 1);
    } catch (err: any) {
      setProfileSaveError(err.message || "Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

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

  useEffect(() => {
    let cancelled = false;

    getAdminActivity({ scope: "me", page: 1, limit: 8 })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setActivityRows(payload.data);
        setActivityError(null);
      })
      .catch((loadError) => {
        if (cancelled || isDashboardSessionExpiredError(loadError)) {
          return;
        }

        setActivityRows([]);
        setActivityError(getErrorMessage(loadError, "Personal activity history could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) {
          setActivityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
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
  const statusLabel = formatManagedUserStatusLabel(statusValue, "Unknown");
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
  const personalActivityFeed = activityRows.map(normalizeAdminActivity);
  const unreadNotificationCount = notifications.filter((item) => !item.is_read).length;
  const browserPermissionLabel =
    browserNotificationStatus.permission === "granted"
      ? "Allowed"
      : browserNotificationStatus.permission === "denied"
        ? "Blocked"
        : browserNotificationStatus.permission === "default"
          ? "Not requested"
          : browserNotificationStatus.permission === "unsupported"
            ? "Unsupported"
            : "Checking";
  const browserPermissionTone: Tone =
    browserNotificationStatus.permission === "granted"
      ? "success"
      : browserNotificationStatus.permission === "denied"
        ? "danger"
        : browserNotificationStatus.permission === "unsupported"
          ? "danger"
          : "warning";
  const browserSubscriptionLabel =
    !browserNotificationStatus.isConfigured
      ? "Not configured"
      : browserNotificationStatus.initState === "failed"
        ? "Initialization failed"
        : browserNotificationStatus.isOptedIn
          ? "Subscribed"
          : browserNotificationStatus.permission === "granted"
            ? "Pending registration"
            : "Not subscribed";
  const browserSubscriptionTone: Tone =
    !browserNotificationStatus.isConfigured || browserNotificationStatus.initState === "failed"
      ? "danger"
      : browserNotificationStatus.isOptedIn
        ? "success"
        : browserNotificationStatus.permission === "granted"
          ? "info"
          : "warning";
  const browserNotificationSummary = !browserNotificationStatus.isConfigured
    ? "OneSignal is not configured for this environment yet."
    : browserNotificationStatus.permission === "unsupported"
      ? "This browser does not support web push notifications."
      : browserNotificationStatus.initState === "failed"
        ? "OneSignal could not initialize on this origin. Check the active app ID and site URL for this environment."
        : browserNotificationStatus.permission === "denied"
          ? "Notifications were blocked in this browser. Retrying from here will hand off to the browser settings when the native prompt can no longer re-open."
          : browserNotificationStatus.isOptedIn
            ? "This browser is subscribed to push notifications for the current OneSignal app."
            : "Browser push is available, but this browser has not finished subscribing yet.";
  const browserNotificationActionLabel =
    browserNotificationStatus.permission === "denied"
      ? "Open Browser Settings"
      : browserNotificationStatus.permission === "granted"
        ? "Retry Subscription"
        : "Enable Browser Notifications";
  const canManageBrowserNotifications = browserNotificationStatus.isConfigured && browserNotificationStatus.isSupported;
  const showPrimaryBrowserNotificationAction = canManageBrowserNotifications && !browserNotificationStatus.isOptedIn;
  const browserNotificationTriggerLabel = browserNotificationStatus.notifyButtonEnabled
    ? "OneSignal bell enabled"
    : "Profile retry only";

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

            <div className="settings-divider" style={{ margin: "20px 0" }} />

            <div style={{ width: "100%" }}>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px", display: "block" }}>Interface Theme</span>
              <SettingsSwitch
                checked={appearance === "dark"}
                onChange={(next) => applyAppearance(next ? "dark" : "light")}
                label="Dark Mode"
                description="Use dark interface colors"
              />
            </div>
          </aside>

          <section className="settings-panel">
            <Tabs value={activeTab} onChange={setActiveTab} options={settingsTabs} compact />
            <ErrorMessage title="Settings load failed" message={error} />

            {activeTab === "Personal Information" ? (
              <form onSubmit={handleSaveProfile} className="settings-section">
                <div className="settings-section-heading">
                  <h3>Profile Details</h3>
                  <p>
                    {error
                      ? "The live profile request failed, so fallback session data is shown where possible."
                      : isLoading
                        ? "Refreshing your account details."
                        : "Edit and save your account details."}
                  </p>
                </div>

                {profileSaveSuccess && (
                  <div className="status-pill status-pill--success" style={{ padding: "10px", borderRadius: "6px", marginBottom: "15px", display: "block", textAlign: "center", color: "#10b981", background: "rgba(16, 185, 129, 0.1)", fontSize: "13px" }}>
                    Profile details updated successfully!
                  </div>
                )}
                {profileSaveError && (
                  <div className="status-pill status-pill--danger" style={{ padding: "10px", borderRadius: "6px", marginBottom: "15px", display: "block", textAlign: "center", color: "#ef4444", background: "rgba(239, 68, 68, 0.1)", fontSize: "13px" }}>
                    {profileSaveError}
                  </div>
                )}

                <div className="settings-form-grid">
                  <SettingsField label="Full / Display Name" icon={<UsersIcon className="mini-icon" />}>
                    <input
                      type="text"
                      className="dashboard-input"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                    />
                  </SettingsField>
                  <SettingsField label="Email Address" icon={<MailIcon className="mini-icon" />}>
                    <SettingsValue value={email} />
                  </SettingsField>
                  <SettingsField label="Phone Number" icon={<PhoneIcon className="mini-icon" />}>
                    <input
                      type="text"
                      className="dashboard-input"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                    />
                  </SettingsField>
                  <SettingsField label="Address" icon={<GlobeIcon className="mini-icon" />}>
                    <input
                      type="text"
                      className="dashboard-input"
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                    />
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

                <div className="inline-actions justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? "Saving Profile..." : "Save Profile Details"}
                  </Button>
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
              </form>
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
                  <h3>Browser Push Subscription</h3>
                  <p>Review this browser&apos;s OneSignal subscription state and trigger setup again from here at any time.</p>
                </div>

                <div className="settings-checklist">
                  <div className="settings-checklist__row">
                    <div className="settings-checklist__copy">
                      <strong>Browser Permission</strong>
                      <span>{browserNotificationSummary}</span>
                    </div>
                    <StatusPill label={browserPermissionLabel} tone={browserPermissionTone} solid={false} />
                  </div>
                  <div className="settings-checklist__row">
                    <div className="settings-checklist__copy">
                      <strong>OneSignal Subscription</strong>
                      <span>Current registration state for this browser profile and environment.</span>
                    </div>
                    <StatusPill label={browserSubscriptionLabel} tone={browserSubscriptionTone} solid={false} />
                  </div>
                  <div className="settings-checklist__row">
                    <div className="settings-checklist__copy">
                      <strong>Prompt Fallback</strong>
                      <span>
                        {browserNotificationStatus.notifyButtonEnabled
                          ? "The OneSignal subscription bell is enabled as an extra opt-in path on this environment."
                          : "The floating OneSignal subscription bell is disabled, so this profile section is the retry path."}
                      </span>
                    </div>
                    <StatusPill label={browserNotificationTriggerLabel} tone="info" solid={false} />
                  </div>
                </div>

                <div className="settings-form-grid is-single">
                  <SettingsField label="OneSignal Subscription ID" icon={<ShieldIcon className="mini-icon" />}>
                    <SettingsValue value={browserNotificationStatus.subscriptionId ?? "Not available yet"} />
                  </SettingsField>
                </div>

                <div className="inline-actions justify-between">
                  <div className="settings-summary__meta">
                    <InfoRow icon={<MailIcon className="mini-icon" />} label="Notification Email" value={email} />
                  </div>
                  <div className="inline-actions">
                    {showPrimaryBrowserNotificationAction ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          if (browserNotificationStatus.permission === "default") {
                            openBrowserNotificationsPrompt();
                            return;
                          }

                          void requestBrowserNotifications();
                        }}
                        disabled={isPermissionSubmitting}
                      >
                        {isPermissionSubmitting ? "Working..." : browserNotificationActionLabel}
                      </Button>
                    ) : null}
                    <Button variant="secondary" size="sm" onClick={() => void refreshBrowserNotificationStatus()} disabled={isPermissionSubmitting}>
                      Refresh Status
                    </Button>
                  </div>
                </div>

                <div className="settings-divider" />

                <div className="settings-section-heading">
                  <h3>Profile Notifications</h3>
                  <p>Latest admin notifications delivered to this dashboard session.</p>
                </div>

                {notifications.length ? (
                  <div className="settings-checklist">
                    {notifications.map((notification) => (
                      <div className="settings-checklist__row" key={notification.id}>
                        <div className="settings-checklist__copy">
                          <strong>{notification.title}</strong>
                          <span>{notification.message}</span>
                          <span>{formatDateTimeLabel(notification.created_at)}</span>
                        </div>
                        <div className="inline-actions">
                          <StatusPill label={notification.is_read ? "Read" : "Unread"} tone={notification.is_read ? "neutral" : "warning"} solid={false} />
                          {!notification.is_read ? (
                            <Button variant="secondary" size="sm" onClick={() => void markRead(notification.id, true)}>
                              Mark Read
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="settings-banner">No notifications have been delivered to this profile yet.</div>
                )}

                <div className="settings-divider" />

                <div className="inline-actions justify-between">
                  <div className="inline-actions">
                    <span className="text-sm text-[var(--text-soft)]">Unread: {unreadNotificationCount}</span>
                    <Link href="/notifications" className="action-button is-secondary is-sm">
                      Open Notifications
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "Activity Log" ? (
              <div className="settings-section">
                <div className="settings-section-heading">
                  <h3>My Activity History</h3>
                  <p>Recent audit log entries for the signed-in admin account.</p>
                </div>

                <ErrorMessage title="Activity history load failed" message={activityError} />

                <div className="settings-activity">
                  {personalActivityFeed.length
                    ? personalActivityFeed.map((item) => (
                        <ActivityListItem
                          key={item.id}
                          title={item.title}
                          description={item.description}
                          meta={item.meta}
                          tone={item.tone}
                        />
                      ))
                    : activityLoading
                      ? (
                          <div className="settings-banner">Loading your activity history...</div>
                        )
                      : activityError
                        ? activityItems.map((item) => (
                            <ActivityListItem
                              key={item.id}
                              title={item.title}
                              description={item.description}
                              meta={item.meta}
                              tone={item.tone}
                            />
                          ))
                        : (
                            <div className="settings-banner">No personal activity history has been recorded yet.</div>
                          )}
                </div>

                <div className="settings-divider" />

                <div className="inline-actions justify-end">
                  <Link href="/activity-history" className="action-button is-secondary is-sm">
                    Open Full Activity History
                  </Link>
                </div>
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
