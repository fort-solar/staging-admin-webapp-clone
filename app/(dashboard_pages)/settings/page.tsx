"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { adminActivityFeed, currentAdminUser } from "@/lib/dashboard-data";
import {
  ActivityListItem,
  Avatar,
  Button,
  Checkbox,
  InfoRow,
  Panel,
  SelectField,
  StatusPill,
  Tabs,
  TextField,
  cx,
} from "@/components/dashboard/ui";
import {
  CameraIcon,
  GlobeIcon,
  MailIcon,
  PhoneIcon,
  SaveIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/dashboard/icons";

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

function NotificationTypeRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="settings-checklist__row">
      <div className="settings-checklist__copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <Checkbox checked={checked} onChange={onChange} />
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("Personal Information");
  const [personalInfo, setPersonalInfo] = useState({
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarahjohnson@gmail.com",
    phone: "+1 000 567 3456",
    role: "Administrator",
    department: "Management",
  });
  const [security, setSecurity] = useState({
    twoFactorEnabled: true,
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    browser: true,
    systemUpdates: true,
    transactionUpdates: true,
    marketingPromotions: true,
    securityAlerts: true,
  });
  const [preferences, setPreferences] = useState({
    currency: "NGN (₦)",
    language: "English",
    timezone: "UTC (Coordinated Universal Time)",
    dateFormat: "MM/DD/YYYY",
  });
  const [profilePhotoName, setProfilePhotoName] = useState("");
  const [appearance, setAppearance] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return window.localStorage.getItem("fortsolar:appearance") === "dark" ? "dark" : "light";
  });

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

  function applyAppearance(next: "light" | "dark") {
    setAppearance(next);
    window.localStorage.setItem("fortsolar:appearance", next);
    document.documentElement.dataset.dashboardAppearance = next;
    window.dispatchEvent(new CustomEvent("fortsolar:appearance-change", { detail: next }));
  }

  return (
    <div className="dashboard-stack">
      <Panel className="settings-shell">
        <div className="settings-layout">
          <aside className="settings-summary">
            <div className="settings-summary__avatar-wrap">
              <Avatar src={currentAdminUser.avatar} alt={currentAdminUser.name} size="xl" className="settings-summary__avatar" />
              <input
                id="settings-profile-photo"
                className="settings-summary__photo-input"
                type="file"
                accept="image/*"
                onChange={(event) => setProfilePhotoName(event.target.files?.[0]?.name ?? "")}
              />
              <label className="settings-summary__camera" htmlFor="settings-profile-photo" aria-label="Update profile photo">
                <CameraIcon className="menu-icon" />
              </label>
            </div>

            <div className="settings-summary__identity">
              <h2>{currentAdminUser.name}</h2>
              <StatusPill label={currentAdminUser.role} tone="success" solid={false} />
              {profilePhotoName ? <span className="settings-summary__photo-name">{profilePhotoName}</span> : null}
            </div>

            <div className="settings-summary__meta">
              <InfoRow icon={<PhoneIcon className="mini-icon" />} label="Phone Number" value={personalInfo.phone} />
              <InfoRow icon={<MailIcon className="mini-icon" />} label="Email" value={personalInfo.email} />
              <InfoRow icon={<GlobeIcon className="mini-icon" />} label="Time Zone" value="West African Time" />
              <InfoRow icon={<ShieldIcon className="mini-icon" />} label="Security" value={security.twoFactorEnabled ? "2FA Enabled" : "2FA Disabled"} />
            </div>
          </aside>

          <section className="settings-panel">
            <Tabs value={activeTab} onChange={setActiveTab} options={settingsTabs} compact />

            {activeTab === "Personal Information" ? (
              <form
                className="settings-form"
                onSubmit={(event) => {
                  event.preventDefault();
                }}
              >
                <div className="settings-form-grid">
                  <SettingsField label="First Name" icon={<UsersIcon className="mini-icon" />}>
                    <TextField
                      value={personalInfo.firstName}
                      onChange={(event) => setPersonalInfo((current) => ({ ...current, firstName: event.target.value }))}
                      placeholder="Enter first name"
                    />
                  </SettingsField>
                  <SettingsField label="Last Name" icon={<UsersIcon className="mini-icon" />}>
                    <TextField
                      value={personalInfo.lastName}
                      onChange={(event) => setPersonalInfo((current) => ({ ...current, lastName: event.target.value }))}
                      placeholder="Enter last name"
                    />
                  </SettingsField>
                  <SettingsField label="Email Address" icon={<MailIcon className="mini-icon" />}>
                    <TextField
                      type="email"
                      value={personalInfo.email}
                      onChange={(event) => setPersonalInfo((current) => ({ ...current, email: event.target.value }))}
                      placeholder="Enter email address"
                    />
                  </SettingsField>
                  <SettingsField label="Phone Number" icon={<PhoneIcon className="mini-icon" />}>
                    <TextField
                      value={personalInfo.phone}
                      onChange={(event) => setPersonalInfo((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="Enter phone number"
                    />
                  </SettingsField>
                  <SettingsField label="Role" icon={<ShieldIcon className="mini-icon" />}>
                    <TextField
                      value={personalInfo.role}
                      onChange={(event) => setPersonalInfo((current) => ({ ...current, role: event.target.value }))}
                      placeholder="Enter role"
                    />
                  </SettingsField>
                  <SettingsField label="Department" icon={<UsersIcon className="mini-icon" />}>
                    <TextField
                      value={personalInfo.department}
                      onChange={(event) => setPersonalInfo((current) => ({ ...current, department: event.target.value }))}
                      placeholder="Enter department"
                    />
                  </SettingsField>
                </div>
                <div className="settings-actions">
                  <Button type="submit" variant="primary" leadingIcon={<SaveIcon className="mini-icon" />}>
                    Save Changes
                  </Button>
                </div>
              </form>
            ) : null}

            {activeTab === "Security" ? (
              <div className="settings-section">
                <SettingsSwitch
                  checked={security.twoFactorEnabled}
                  onChange={(next) => setSecurity((current) => ({ ...current, twoFactorEnabled: next }))}
                  label="Two-Factor Authentication"
                  description="Add an extra layer of security to your account"
                />

                {security.twoFactorEnabled ? (
                  <div className="settings-banner">Two-factor authentication is currently enabled for your account.</div>
                ) : null}

                <div className="settings-divider" />

                <form
                  className="settings-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                  }}
                >
                  <div className="settings-section-heading">
                    <h3>Change Password</h3>
                  </div>
                  <div className="settings-form-grid is-single">
                    <SettingsField label="Current Password">
                      <TextField
                        type="password"
                        value={security.currentPassword}
                        onChange={(event) => setSecurity((current) => ({ ...current, currentPassword: event.target.value }))}
                        placeholder="Enter current password"
                      />
                    </SettingsField>
                    <SettingsField label="New Password">
                      <TextField
                        type="password"
                        value={security.newPassword}
                        onChange={(event) => setSecurity((current) => ({ ...current, newPassword: event.target.value }))}
                        placeholder="Enter new password"
                      />
                    </SettingsField>
                    <SettingsField label="Confirm New Password">
                      <TextField
                        type="password"
                        value={security.confirmPassword}
                        onChange={(event) => setSecurity((current) => ({ ...current, confirmPassword: event.target.value }))}
                        placeholder="Confirm new password"
                      />
                    </SettingsField>
                  </div>
                  <div className="settings-actions">
                    <Button type="submit" variant="primary">
                      Update Password
                    </Button>
                  </div>
                </form>
              </div>
            ) : null}

            {activeTab === "Notifications" ? (
              <div className="settings-section">
                <div className="settings-section-heading">
                  <h3>Notifications Settings</h3>
                  <p>Manage how you receive notifications</p>
                </div>

                <div className="settings-switch-list">
                  <SettingsSwitch
                    checked={notifications.email}
                    onChange={(next) => setNotifications((current) => ({ ...current, email: next }))}
                    label="Email Notifications"
                    description="Receive notifications via email"
                  />
                  <SettingsSwitch
                    checked={notifications.sms}
                    onChange={(next) => setNotifications((current) => ({ ...current, sms: next }))}
                    label="SMS Notifications"
                    description="Receive notifications via SMS"
                  />
                  <SettingsSwitch
                    checked={notifications.browser}
                    onChange={(next) => setNotifications((current) => ({ ...current, browser: next }))}
                    label="Browser Notifications"
                    description="Receive notifications in browser"
                  />
                </div>

                <div className="settings-divider" />

                <div className="settings-section-heading">
                  <h3>Notifications Types</h3>
                </div>

                <div className="settings-checklist">
                  <NotificationTypeRow
                    title="System Updates"
                    description="Important system updates, maintenance notifications, and new features"
                    checked={notifications.systemUpdates}
                    onChange={(next) => setNotifications((current) => ({ ...current, systemUpdates: next }))}
                  />
                  <NotificationTypeRow
                    title="Transaction Updates"
                    description="Notifications about new sales, commissions, and revenue"
                    checked={notifications.transactionUpdates}
                    onChange={(next) => setNotifications((current) => ({ ...current, transactionUpdates: next }))}
                  />
                  <NotificationTypeRow
                    title="Marketing & Promotions"
                    description="New product announcements, promotions, and marketing materials"
                    checked={notifications.marketingPromotions}
                    onChange={(next) => setNotifications((current) => ({ ...current, marketingPromotions: next }))}
                  />
                  <NotificationTypeRow
                    title="Security Alerts"
                    description="Login attempts, password changes, and other security-related notifications"
                    checked={notifications.securityAlerts}
                    onChange={(next) => setNotifications((current) => ({ ...current, securityAlerts: next }))}
                  />
                </div>
              </div>
            ) : null}

            {activeTab === "Activity Log" ? (
              <div className="settings-activity">
                {adminActivityFeed.map((item) => (
                  <ActivityListItem key={item.id} title={item.title} description={item.description} meta={item.meta} tone={item.tone} />
                ))}
              </div>
            ) : null}

            {activeTab === "Preferences" ? (
              <div className="settings-section">
                <div className="settings-section-heading">
                  <h3>Application Preferences</h3>
                  <p>Manage system settings</p>
                </div>

                <SettingsSwitch
                  checked={appearance === "dark"}
                  onChange={(next) => applyAppearance(next ? "dark" : "light")}
                  label="Dark Mode"
                  description="Switch between light and dark interface theme"
                />

                <div className="settings-form-grid">
                  <SettingsField label="Default Currency">
                    <SelectField
                      value={preferences.currency}
                      onChange={(value) => setPreferences((current) => ({ ...current, currency: value }))}
                      options={["NGN (₦)", "USD ($)", "EUR (€)"]}
                    />
                  </SettingsField>
                  <SettingsField label="Default Language">
                    <SelectField
                      value={preferences.language}
                      onChange={(value) => setPreferences((current) => ({ ...current, language: value }))}
                      options={["English", "French", "Spanish"]}
                    />
                  </SettingsField>
                  <SettingsField label="Default Timezone">
                    <SelectField
                      value={preferences.timezone}
                      onChange={(value) => setPreferences((current) => ({ ...current, timezone: value }))}
                      options={[
                        "UTC (Coordinated Universal Time)",
                        "West African Time",
                        "Eastern Standard Time",
                      ]}
                    />
                  </SettingsField>
                  <SettingsField label="Date Format">
                    <SelectField
                      value={preferences.dateFormat}
                      onChange={(value) => setPreferences((current) => ({ ...current, dateFormat: value }))}
                      options={["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]}
                    />
                  </SettingsField>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </Panel>
    </div>
  );
}
