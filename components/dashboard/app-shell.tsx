"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType, type ReactNode, type SVGProps, useEffect, useMemo, useState } from "react";
import { currentAdminUser, headerNotifications } from "@/lib/dashboard-data";
import {
  BellIcon,
  BundlesIcon,
  ChevronDownIcon,
  CollapseIcon,
  DashboardIcon,
  LogoutIcon,
  MoonIcon,
  NotificationIcon,
  OrdersIcon,
  PackageIcon,
  PlusIcon,
  ProductsIcon,
  SettingsIcon,
  SunIcon,
  TransactionsIcon,
  UsersIcon,
} from "@/components/dashboard/icons";
import { Avatar, IconButton, SearchField, cx } from "@/components/dashboard/ui";

type NavItem = {
  label: string;
  href?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  children?: { label: string; href: string }[];
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: DashboardIcon },
  {
    label: "Users",
    icon: UsersIcon,
    children: [
      { label: "Customers", href: "/users/customers" },
      { label: "Installers", href: "/users/installers" },
      { label: "Admins", href: "/users/admins" },
    ],
  },
  {
    label: "Orders",
    icon: OrdersIcon,
    children: [
      { label: "All Orders", href: "/orders" },
      { label: "Bundle Requests", href: "/orders/bundle-requests" },
    ],
  },
];

const notificationsNav = { label: "Notifications", href: "/notifications", icon: NotificationIcon };

const productNav = [
  { label: "Products", href: "/products", icon: ProductsIcon },
  { label: "Bundles", href: "/bundles", icon: BundlesIcon },
];

const financeNav = [
  { label: "Transactions", href: "/transactions", icon: TransactionsIcon },
];

const contentNav = [
  { label: "Blog", href: "/blog", icon: PackageIcon, createHref: "/blog/new" },
  { label: "SEO Pages", href: "/site-pages", icon: PackageIcon, createHref: "/site-pages/new" },
  { label: "Installations", href: "/installations", icon: PackageIcon, createHref: "/installations/new" },
];

const othersNav = [
  { label: "Energy Audit", href: "/energy-audit", icon: TransactionsIcon },
  { label: "Job Board", href: "/jobs", icon: PackageIcon, createHref: "/jobs/new" },
];

function routeTitle(pathname: string) {
  if (pathname.startsWith("/users/customers")) return "Buyer Management";
  if (pathname.startsWith("/users/installers")) return "Installer Management";
  if (pathname.startsWith("/users/admins")) return "Admin Management";
  if (pathname.startsWith("/orders/bundle-requests")) return "Bundle Request Management";
  if (pathname.startsWith("/orders")) return "Order Management";
  if (pathname.startsWith("/dashboard/verification-queue")) return "Installer Verification Queue";
  if (pathname.startsWith("/notifications")) return "Notification Management";
  if (pathname.startsWith("/products")) return "Product Management";
  if (pathname.startsWith("/bundles")) return "Bundle Management";
  if (pathname.startsWith("/transactions")) return "Transaction Management";
  if (pathname.startsWith("/blog")) return "Blog Management";
  if (pathname.startsWith("/site-pages")) return "SEO Page Management";
  if (pathname.startsWith("/installations")) return "Installations Management";
  if (pathname.startsWith("/energy-audit")) return "Energy Calculator";
  if (pathname.startsWith("/jobs")) return "Job Management";
  if (pathname.startsWith("/settings")) return "Account Settings";
  return "Dashboard";
}

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function defaultHref(item: NavItem) {
  return item.href ?? item.children?.[0]?.href ?? "/dashboard";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
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
  const pageTitle = useMemo(() => routeTitle(pathname), [pathname]);
  const NotificationsNavIcon = notificationsNav.icon;
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

  const usersMenuOpen = pathname.startsWith("/users") || usersOpen;
  const ordersMenuOpen = pathname.startsWith("/orders") || ordersOpen;

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className={cx("dashboard-app", collapsed && "is-collapsed", mobileOpen && "is-mobile-open")}>
      {mobileOpen ? <button type="button" className="dashboard-overlay" onClick={() => setMobileOpen(false)} aria-label="Close sidebar overlay" /> : null}
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar__brand">
          <Link href="/dashboard" className="brand-mark">
            <span>Fort</span>
            <strong>solar</strong>
          </Link>
          <IconButton
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            icon={<CollapseIcon className="sidebar-toggle-icon" />}
            onClick={() => setCollapsed((value) => !value)}
            className="desktop-only sidebar-collapse-button"
          />
        </div>

        <div className="dashboard-sidebar__section">
          <p className="sidebar-section-title">Main menu</p>
          <nav className="sidebar-nav">
            {navItems.map((item) => {
              const href = defaultHref(item);
              const active = matches(pathname, href);
              const isGroup = Boolean(item.children?.length);
              const groupOpen = item.label === "Users" ? usersMenuOpen : ordersMenuOpen;
              const Icon = item.icon;

              if (!isGroup) {
                return (
                  <Link key={item.label} href={href} className={cx("sidebar-link", active && "is-active")} title={item.label} onClick={closeTransientUi}>
                    <Icon className="sidebar-link__icon" />
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
                    <Icon className="sidebar-link__icon" />
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
            <Link
              href={notificationsNav.href}
              className={cx("sidebar-link", matches(pathname, notificationsNav.href) && "is-active")}
              title={notificationsNav.label}
              onClick={closeTransientUi}
            >
              <NotificationsNavIcon className="sidebar-link__icon" />
              <span>{notificationsNav.label}</span>
            </Link>
          </nav>
        </div>

        <div className="dashboard-sidebar__section">
          <p className="sidebar-section-title">Product</p>
          <nav className="sidebar-nav">
            {productNav.map((item) => (
              <Link key={item.label} href={item.href} className={cx("sidebar-link", matches(pathname, item.href) && "is-active")} title={item.label} onClick={closeTransientUi}>
                <item.icon className="sidebar-link__icon" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="dashboard-sidebar__section is-finance">
          <p className="sidebar-section-title">Finance</p>
          <nav className="sidebar-nav">
            {financeNav.map((item) => (
              <Link key={item.label} href={item.href} className={cx("sidebar-link", matches(pathname, item.href) && "is-active")} title={item.label} onClick={closeTransientUi}>
                <item.icon className="sidebar-link__icon" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="dashboard-sidebar__section">
          <p className="sidebar-section-title">Content</p>
          <nav className="sidebar-nav">
            {contentNav.map((item) => (
              <div key={item.label} className="sidebar-link-row">
                <Link href={item.href} className={cx("sidebar-link", matches(pathname, item.href) && "is-active")} title={item.label} onClick={closeTransientUi}>
                  <item.icon className="sidebar-link__icon" />
                  <span>{item.label}</span>
                </Link>
                {!collapsed ? (
                  <Link href={item.createHref} className="sidebar-create-link" aria-label={`Create ${item.label}`} onClick={closeTransientUi}>
                    <PlusIcon className="mini-icon" />
                  </Link>
                ) : null}
              </div>
            ))}
          </nav>
        </div>

        <div className="dashboard-sidebar__section">
          <p className="sidebar-section-title">Others</p>
          <nav className="sidebar-nav">
            {othersNav.map((item) => (
              <div key={item.label} className="sidebar-link-row">
                <Link href={item.href} className={cx("sidebar-link", matches(pathname, item.href) && "is-active")} title={item.label} onClick={closeTransientUi}>
                  <item.icon className="sidebar-link__icon" />
                  <span>{item.label}</span>
                </Link>
                {"createHref" in item && item.createHref && !collapsed ? (
                  <Link href={item.createHref} className="sidebar-create-link" aria-label={`Create ${item.label}`} onClick={closeTransientUi}>
                    <PlusIcon className="mini-icon" />
                  </Link>
                ) : null}
              </div>
            ))}
          </nav>
        </div>

        <div className="dashboard-sidebar__footer">
          <Link href="/settings" className={cx("sidebar-link", matches(pathname, "/settings") && "is-active")} title="Settings" onClick={closeTransientUi}>
            <SettingsIcon className="sidebar-link__icon" />
            <span>Settings</span>
          </Link>
          <Link href="/login" className="sidebar-link is-logout" title="Log Out" onClick={closeTransientUi}>
            <LogoutIcon className="sidebar-link__icon" />
            <span>Log Out</span>
          </Link>
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
                      <span>{headerNotifications.length} new</span>
                    </div>
                    <div className="topbar-panel__body">
                      {headerNotifications.map((item) => (
                        <article key={item.id} className="topbar-notice">
                          <span className={cx("topbar-notice__dot", `is-${item.tone}`)} />
                          <div>
                            <h4>{item.title}</h4>
                            <p>{item.description}</p>
                            <small>{item.time}</small>
                          </div>
                        </article>
                      ))}
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
                  <Avatar src={currentAdminUser.avatar} alt={currentAdminUser.name} size="sm" />
                  <ChevronDownIcon className="profile-button__chevron" />
                </button>
                {profileOpen ? (
                  <div className="topbar-panel is-profile-panel">
                    <div className="profile-panel__identity">
                      <Avatar src={currentAdminUser.avatar} alt={currentAdminUser.name} size="lg" />
                      <div className="flex flex-col gap-1">
                        <strong>{currentAdminUser.name}</strong>
                        <span>{currentAdminUser.role}</span>
                      </div>
                    </div>
                    <Link href="/settings" className="profile-panel__link" onClick={closeTransientUi}>
                      <SettingsIcon className="menu-icon" />
                      <span>Account settings</span>
                    </Link>
                    <Link href="/login" className="profile-panel__link is-danger" onClick={closeTransientUi}>
                      <LogoutIcon className="menu-icon" />
                      <span>Log out</span>
                    </Link>
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
