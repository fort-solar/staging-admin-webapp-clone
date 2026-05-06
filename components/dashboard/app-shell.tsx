"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType, type ReactNode, type SVGProps, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useNotifications } from "@/components/dashboard/notifications-provider";
import {
  BellIcon,
  BriefcaseIcon,
  BundlesIcon,
  ChevronDownIcon,
  CollapseIcon,
  DashboardIcon,
  EnergyAuditIcon,
  LogoutIcon,
  MoonIcon,
  NotificationIcon,
  OrdersIcon,
  PackageIcon,
  PagesIcon,
  PlusIcon,
  ProductsIcon,
  SettingsIcon,
  SunIcon,
  TransactionsIcon,
  UsersIcon,
} from "@/components/dashboard/icons";
import { Avatar, IconButton, SearchField, cx } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { formatAdminRole, getDefaultDashboardPath, getRouteTitle, getVisibleNavigation, normalizeAdminRole, type DashboardNavItem, type NavIconKey } from "@/lib/auth/access-control";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const iconMap: Record<NavIconKey, IconComponent> = {
  dashboard: DashboardIcon,
  users: UsersIcon,
  orders: OrdersIcon,
  notifications: NotificationIcon,
  products: ProductsIcon,
  bundles: BundlesIcon,
  transactions: TransactionsIcon,
  package: PackageIcon,
  pages: PagesIcon,
  energy_audit: EnergyAuditIcon,
  jobs: BriefcaseIcon,
  settings: SettingsIcon,
};

const emptyPermissions: string[] = [];

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function defaultHref(item: DashboardNavItem, fallback: string) {
  return item.href ?? item.children?.[0]?.href ?? fallback;
}

function ItemIcon({ icon, className }: { icon: NavIconKey; className: string }) {
  const Glyph = iconMap[icon];
  return <Glyph className={className} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session, logout } = useAuth();
  const { headerItems, unreadCount, markRead } = useNotifications();
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("fortsolar:sidebar-collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [appearance, setAppearance] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return window.localStorage.getItem("fortsolar:appearance") === "dark" ? "dark" : "light";
  });
  const [usersOpen, setUsersOpen] = useState(() => pathname.startsWith("/users"));
  const [ordersOpen, setOrdersOpen] = useState(() => pathname.startsWith("/orders"));
  const [headerSearch, setHeaderSearch] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const role = normalizeAdminRole(session?.session.adminRole ?? session?.user.adminRole);
  const permissions = session?.permissions ?? emptyPermissions;
  const pageTitle = useMemo(() => getRouteTitle(pathname), [pathname]);
  const homePath = useMemo(() => getDefaultDashboardPath(role, permissions), [permissions, role]);
  const visibleNavigation = useMemo(() => getVisibleNavigation(role, permissions), [permissions, role]);
  const bodySections = useMemo(() => visibleNavigation.filter((section) => section.key !== "footer"), [visibleNavigation]);
  const footerSection = useMemo(() => visibleNavigation.find((section) => section.key === "footer"), [visibleNavigation]);
  const closeTransientUi = () => {
    setMobileOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  };

  useEffect(() => {
    window.localStorage.setItem("fortsolar:sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    window.localStorage.setItem("fortsolar:appearance", appearance);
    document.documentElement.dataset.dashboardAppearance = appearance;
    window.dispatchEvent(new CustomEvent("fortsolar:appearance-change", { detail: appearance }));
  }, [appearance]);

  useEffect(() => {
    function handleAppearanceChange(event: Event) {
      const next = (event as CustomEvent<"light" | "dark">).detail;

      if (next === "light" || next === "dark") {
        setAppearance(next);
      }
    }

    window.addEventListener("fortsolar:appearance-change", handleAppearanceChange as EventListener);

    return () => {
      window.removeEventListener("fortsolar:appearance-change", handleAppearanceChange as EventListener);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const usersMenuOpen = pathname.startsWith("/users") || usersOpen;
  const ordersMenuOpen = pathname.startsWith("/orders") || ordersOpen;
  const displayName = session?.user.fullName || session?.user.name || "Admin";
  const displayRole = formatAdminRole(session?.session.adminRole ?? session?.user.adminRole);

  async function handleLogout() {
    closeTransientUi();
    setIsLoggingOut(true);

    try {
      await logout();
    } catch {
      toast({
        title: "Sign-out failed",
        description: "We could not fully end the session cleanly, but local access has been removed.",
        variant: "error",
      });
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (!session) {
    return null;
  }

  return (
    <div className={cx("dashboard-app", collapsed && "is-collapsed", mobileOpen && "is-mobile-open")}>
      {mobileOpen ? <button type="button" className="dashboard-overlay" onClick={() => setMobileOpen(false)} aria-label="Close sidebar overlay" /> : null}
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar__brand">
          <Link href={homePath} className="brand-mark brand-mark--dashboard">
            {collapsed ? (
              <span className="brand-mark__icon" aria-hidden="true">
                <Image src="/favicon.ico" alt="" fill sizes="40px" />
              </span>
            ) : null}
            <span className="brand-mark__word">
              <span>Fort</span>
              <strong>solar</strong>
            </span>
          </Link>
        </div>

        {bodySections.map((section) => (
          <div key={section.key} className={cx("dashboard-sidebar__section", section.key === "finance" && "is-finance")}>
            {section.label ? <p className="sidebar-section-title">{section.label}</p> : null}
            <nav className="sidebar-nav">
              {section.items.map((item) => {
                const href = defaultHref(item, homePath);
                const active = matches(pathname, href);
                const isGroup = Boolean(item.children?.length);
                const groupOpen = item.label === "Users" ? usersMenuOpen : ordersMenuOpen;

                if (!isGroup) {
                  return item.createHref ? (
                    <div key={item.label} className="sidebar-link-row">
                      <Link href={href} className={cx("sidebar-link", active && "is-active")} title={item.label} onClick={closeTransientUi}>
                        <ItemIcon icon={item.icon} className="sidebar-link__icon" />
                        <span>{item.label}</span>
                      </Link>
                      {!collapsed ? (
                        <Link href={item.createHref} className="sidebar-create-link" aria-label={`Create ${item.label}`} onClick={closeTransientUi}>
                          <PlusIcon className="mini-icon" />
                        </Link>
                      ) : null}
                    </div>
                  ) : (
                    <Link key={item.label} href={href} className={cx("sidebar-link", active && "is-active")} title={item.label} onClick={closeTransientUi}>
                      <ItemIcon icon={item.icon} className="sidebar-link__icon" />
                      <span>{item.label}</span>
                    </Link>
                  );
                }

                return (
                  <div key={item.label} className="sidebar-group">
                    <button
                      type="button"
                      className={cx("sidebar-link", active && "is-active")}
                      onClick={() => {
                        if (collapsed) {
                          setCollapsed(false);
                          return;
                        }

                        if (item.label === "Users") {
                          setUsersOpen((value) => !value);
                        } else {
                          setOrdersOpen((value) => !value);
                        }
                      }}
                      title={item.label}
                    >
                      <ItemIcon icon={item.icon} className="sidebar-link__icon" />
                      <span>{item.label}</span>
                      <ChevronDownIcon className={cx("sidebar-link__chevron", groupOpen && "is-open")} />
                    </button>
                    {groupOpen && !collapsed ? (
                      <div className="sidebar-subnav">
                        {item.children?.map((child) => (
                          <Link key={child.href} href={child.href} className={cx("sidebar-sublink", matches(pathname, child.href) && "is-active")} onClick={closeTransientUi}>
                            <span className="sidebar-sublink__rail" />
                            <span>{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </div>
        ))}

        <div className="dashboard-sidebar__footer">
          {footerSection?.items.map((item) => (
            <Link key={item.label} href={item.href ?? "/settings"} className={cx("sidebar-link", matches(pathname, item.href ?? "/settings") && "is-active")} title={item.label} onClick={closeTransientUi}>
              <ItemIcon icon={item.icon} className="sidebar-link__icon" />
              <span>{item.label}</span>
            </Link>
          ))}
          <button type="button" className="sidebar-link is-logout" title="Log Out" onClick={handleLogout} disabled={isLoggingOut}>
            <LogoutIcon className="sidebar-link__icon" />
            <span>{isLoggingOut ? "Logging Out..." : "Log Out"}</span>
          </button>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-header__title-wrap">
            <IconButton
              label={mobileOpen ? "Close sidebar" : "Open sidebar"}
              icon={<CollapseIcon className="sidebar-toggle-icon" />}
              onClick={() => setMobileOpen((value) => !value)}
              className="mobile-only"
            />
            <h1>{pageTitle}</h1>
            <IconButton
              label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              icon={<CollapseIcon className={cx("sidebar-toggle-icon", collapsed && "is-collapsed")} />}
              onClick={() => setCollapsed((value) => !value)}
              className="desktop-only sidebar-collapse-button"
            />
          </div>
          <div className="dashboard-header__tools">
            <SearchField value={headerSearch} onChange={setHeaderSearch} placeholder="Search data, users, or reports" className="dashboard-header__search" />
            <div className="header-actions">
              <div className="header-popover">
                <IconButton label="Notifications" icon={<BellIcon className="topbar-icon" />} onClick={() => setNotificationsOpen((value) => !value)} />
                {notificationsOpen ? (
                  <div className="topbar-panel">
                    <div className="topbar-panel__header">
                      <strong>Notifications</strong>
                      <span>{unreadCount} new</span>
                    </div>
                    <div className="topbar-panel__body">
                      {headerItems.length ? (
                        headerItems.map((item) =>
                          item.link ? (
                            <Link
                              key={item.id}
                              href={item.link}
                              className="topbar-notice"
                              onClick={() => {
                                setNotificationsOpen(false);
                                void markRead(item.id, true);
                              }}
                            >
                              <span className={cx("topbar-notice__dot", `is-${item.tone}`)} />
                              <div>
                                <h4>{item.title}</h4>
                                <p>{item.description}</p>
                                <small>{item.time}</small>
                              </div>
                            </Link>
                          ) : (
                            <button
                              key={item.id}
                              type="button"
                              className="topbar-notice"
                              onClick={() => {
                                void markRead(item.id, true);
                              }}
                            >
                              <span className={cx("topbar-notice__dot", `is-${item.tone}`)} />
                              <div>
                                <h4>{item.title}</h4>
                                <p>{item.description}</p>
                                <small>{item.time}</small>
                              </div>
                            </button>
                          ),
                        )
                      ) : (
                        <p className="text-sm text-[var(--text-soft)]">No recent notifications.</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className="theme-toggle"
                onClick={() => setAppearance((value) => (value === "light" ? "dark" : "light"))}
                aria-label={`Switch to ${appearance === "light" ? "dark" : "light"} mode`}
                aria-pressed={appearance === "dark"}
              >
                <span className={cx("theme-toggle__thumb", appearance === "dark" && "is-shifted")} />
                <SunIcon className="theme-toggle__icon" />
                <MoonIcon className="theme-toggle__icon" />
              </button>

              <div className="header-popover">
                <button type="button" className="profile-button" onClick={() => setProfileOpen((value) => !value)}>
                  <Avatar src={session.user.avatar_url ?? undefined} alt={displayName} size="sm" />
                  <ChevronDownIcon className="profile-button__chevron" />
                </button>
                {profileOpen ? (
                  <div className="topbar-panel is-profile-panel">
                    <div className="profile-panel__identity">
                      <Avatar src={session.user.avatar_url ?? undefined} alt={displayName} size="lg" />
                      <div className="flex flex-col gap-1">
                        <strong>{displayName}</strong>
                        <span>{displayRole}</span>
                      </div>
                    </div>
                    <Link href="/settings" className="profile-panel__link" onClick={closeTransientUi}>
                      <SettingsIcon className="menu-icon" />
                      <span>Account settings</span>
                    </Link>
                    <button type="button" className="profile-panel__link is-danger" onClick={handleLogout} disabled={isLoggingOut}>
                      <LogoutIcon className="menu-icon" />
                      <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
