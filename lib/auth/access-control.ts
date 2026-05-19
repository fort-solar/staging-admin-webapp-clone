import type { AdminRole, KnownAdminRole } from "@/types/common.types";

export type PermissionAction = "read" | "create" | "update" | "delete";

export type PermissionResource =
  | "dashboard"
  | "verification_queue"
  | "customers"
  | "installers"
  | "admins"
  | "orders"
  | "notifications"
  | "products"
  | "bundles"
  | "transactions"
  | "blog"
  | "site_pages"
  | "installations"
  | "energy_audits"
  | "jobs"
  | "settings";

export type PermissionKey = `${PermissionResource}.${PermissionAction}`;

export type PermissionDescriptor = {
  resource: PermissionResource;
  action: PermissionAction;
};

export type NavSectionKey = "main" | "product" | "finance" | "content" | "operations" | "footer";

export type NavIconKey =
  | "dashboard"
  | "users"
  | "orders"
  | "notifications"
  | "products"
  | "bundles"
  | "transactions"
  | "package"
  | "pages"
  | "energy_audit"
  | "jobs"
  | "activity_history"
  | "settings";

export type DashboardNavChild = {
  label: string;
  href: string;
  permission: PermissionDescriptor;
};

export type DashboardNavItem = {
  label: string;
  icon: NavIconKey;
  section: NavSectionKey;
  href?: string;
  permission?: PermissionDescriptor;
  createHref?: string;
  createPermission?: PermissionDescriptor;
  children?: DashboardNavChild[];
};

type RouteRule = {
  prefix: string;
  permission: PermissionDescriptor;
  title: string;
};

type RolePermissionPreset = Partial<Record<PermissionResource, readonly PermissionAction[]>>;

type SectionWithItems = {
  key: NavSectionKey;
  label?: string;
  items: DashboardNavItem[];
};

const ALL_ACTIONS = ["read", "create", "update", "delete"] as const satisfies readonly PermissionAction[];
const READ_ONLY = ["read"] as const satisfies readonly PermissionAction[];
const READ_CREATE = ["read", "create"] as const satisfies readonly PermissionAction[];
const READ_CREATE_UPDATE = ["read", "create", "update"] as const satisfies readonly PermissionAction[];
const READ_UPDATE = ["read", "update"] as const satisfies readonly PermissionAction[];
const READ_WRITE = ["read", "create", "update"] as const satisfies readonly PermissionAction[];

const KNOWN_RESOURCES = [
  "dashboard",
  "verification_queue",
  "customers",
  "installers",
  "admins",
  "orders",
  "notifications",
  "products",
  "bundles",
  "transactions",
  "blog",
  "site_pages",
  "installations",
  "energy_audits",
  "jobs",
  "settings",
] as const satisfies readonly PermissionResource[];

const RESOURCE_ALIASES: Record<string, PermissionResource> = {
  dashboard: "dashboard",
  verification: "verification_queue",
  verifications: "verification_queue",
  verification_queue: "verification_queue",
  customers: "customers",
  "users.customers": "customers",
  installers: "installers",
  "users.installers": "installers",
  admins: "admins",
  "users.admins": "admins",
  orders: "orders",
  notifications: "notifications",
  products: "products",
  bundles: "bundles",
  packages: "bundles",
  transactions: "transactions",
  financials: "transactions",
  blog: "blog",
  site_pages: "site_pages",
  seo_pages: "site_pages",
  pages: "site_pages",
  installations: "installations",
  energy_audit: "energy_audits",
  energy_audits: "energy_audits",
  jobs: "jobs",
  job_board: "jobs",
  settings: "settings",
};

const ACTION_ALIASES: Record<string, readonly PermissionAction[]> = {
  read: ["read"],
  create: ["create"],
  update: ["update"],
  delete: ["delete"],
  write: ["create", "update"],
  manage: ALL_ACTIONS,
  "*": ALL_ACTIONS,
};

const ROLE_PERMISSION_PRESETS: Record<KnownAdminRole, RolePermissionPreset> = {
  super_admin: Object.fromEntries(KNOWN_RESOURCES.map((resource) => [resource, ALL_ACTIONS])) as RolePermissionPreset,
  operations_manager: {
    installers: READ_ONLY,
    installations: READ_CREATE_UPDATE,
    energy_audits: READ_CREATE_UPDATE,
    jobs: ALL_ACTIONS,
    settings: READ_UPDATE,
  },
  content_manager: {
    blog: ALL_ACTIONS,
    site_pages: READ_CREATE,
    installations: READ_UPDATE,
    settings: READ_UPDATE,
  },
  business_manager: {
    dashboard: READ_ONLY,
    customers: READ_WRITE,
    installers: READ_WRITE,
    orders: ALL_ACTIONS,
    notifications: ALL_ACTIONS,
    products: ALL_ACTIONS,
    bundles: ALL_ACTIONS,
    transactions: READ_CREATE_UPDATE,
    settings: READ_UPDATE,
  },
};

const ROUTE_RULES: RouteRule[] = [
  { prefix: "/dashboard/verification-queue", permission: { resource: "verification_queue", action: "read" }, title: "Installer Verification Queue" },
  { prefix: "/dashboard", permission: { resource: "dashboard", action: "read" }, title: "Dashboard" },
  { prefix: "/users/customers", permission: { resource: "customers", action: "read" }, title: "Buyer Management" },
  { prefix: "/users/installers", permission: { resource: "installers", action: "read" }, title: "Installer Management" },
  { prefix: "/users/admins", permission: { resource: "admins", action: "read" }, title: "Admin Management" },
  { prefix: "/orders/bundle-requests", permission: { resource: "orders", action: "read" }, title: "Package Request Management" },
  { prefix: "/orders", permission: { resource: "orders", action: "read" }, title: "Order Management" },
  { prefix: "/notifications", permission: { resource: "notifications", action: "read" }, title: "Notification Management" },
  { prefix: "/products/new", permission: { resource: "products", action: "create" }, title: "Add Product" },
  { prefix: "/products", permission: { resource: "products", action: "read" }, title: "Product Management" },
  { prefix: "/packages/new", permission: { resource: "bundles", action: "create" }, title: "Add Package" },
  { prefix: "/packages", permission: { resource: "bundles", action: "read" }, title: "Package Management" },
  { prefix: "/bundles/new", permission: { resource: "bundles", action: "create" }, title: "Add Package" },
  { prefix: "/bundles", permission: { resource: "bundles", action: "read" }, title: "Package Management" },
  { prefix: "/transactions", permission: { resource: "transactions", action: "read" }, title: "Transaction Management" },
  { prefix: "/blog/new", permission: { resource: "blog", action: "create" }, title: "Create Blog Post" },
  { prefix: "/blog", permission: { resource: "blog", action: "read" }, title: "Blog Management" },
  { prefix: "/site-pages/new", permission: { resource: "site_pages", action: "create" }, title: "Create SEO Page" },
  { prefix: "/site-pages", permission: { resource: "site_pages", action: "read" }, title: "SEO Page Management" },
  { prefix: "/installations/new", permission: { resource: "installations", action: "create" }, title: "Add Installation" },
  { prefix: "/installations", permission: { resource: "installations", action: "read" }, title: "Installations Management" },
  { prefix: "/energy-audit", permission: { resource: "energy_audits", action: "read" }, title: "Energy Calculator" },
  { prefix: "/jobs/new", permission: { resource: "jobs", action: "create" }, title: "Add Job" },
  { prefix: "/jobs", permission: { resource: "jobs", action: "read" }, title: "Job Management" },
  { prefix: "/activity-history", permission: { resource: "settings", action: "read" }, title: "Activity History" },
  { prefix: "/settings", permission: { resource: "settings", action: "read" }, title: "Account Settings" },
];

const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard", section: "main", permission: { resource: "dashboard", action: "read" } },
  {
    label: "Users",
    icon: "users",
    section: "main",
    children: [
      { label: "Customers", href: "/users/customers", permission: { resource: "customers", action: "read" } },
      { label: "Installers", href: "/users/installers", permission: { resource: "installers", action: "read" } },
      { label: "Admins", href: "/users/admins", permission: { resource: "admins", action: "read" } },
    ],
  },
  {
    label: "Orders",
    icon: "orders",
    section: "main",
    children: [
      { label: "All Orders", href: "/orders", permission: { resource: "orders", action: "read" } },
      { label: "Package Requests", href: "/orders/bundle-requests", permission: { resource: "orders", action: "read" } },
    ],
  },
  { label: "Notifications", href: "/notifications", icon: "notifications", section: "main", permission: { resource: "notifications", action: "read" } },
  {
    label: "Products",
    href: "/products",
    icon: "products",
    section: "product",
    permission: { resource: "products", action: "read" },
    createHref: "/products/new",
    createPermission: { resource: "products", action: "create" },
  },
  {
    label: "Packages",
    href: "/packages",
    icon: "bundles",
    section: "product",
    permission: { resource: "bundles", action: "read" },
    createHref: "/packages/new",
    createPermission: { resource: "bundles", action: "create" },
  },
  { label: "Transactions", href: "/transactions", icon: "transactions", section: "finance", permission: { resource: "transactions", action: "read" } },
  {
    label: "Blog",
    href: "/blog",
    icon: "package",
    section: "content",
    permission: { resource: "blog", action: "read" },
    createHref: "/blog/new",
    createPermission: { resource: "blog", action: "create" },
  },
  {
    label: "SEO Pages",
    href: "/site-pages",
    icon: "pages",
    section: "content",
    permission: { resource: "site_pages", action: "read" },
    createHref: "/site-pages/new",
    createPermission: { resource: "site_pages", action: "create" },
  },
  {
    label: "Installations",
    href: "/installations",
    icon: "package",
    section: "content",
    permission: { resource: "installations", action: "read" },
    createHref: "/installations/new",
    createPermission: { resource: "installations", action: "create" },
  },
  { label: "Energy Audit", href: "/energy-audit", icon: "energy_audit", section: "operations", permission: { resource: "energy_audits", action: "read" } },
  {
    label: "Job Board",
    href: "/jobs",
    icon: "jobs",
    section: "operations",
    permission: { resource: "jobs", action: "read" },
    createHref: "/jobs/new",
    createPermission: { resource: "jobs", action: "create" },
  },
  { label: "Activity History", href: "/activity-history", icon: "activity_history", section: "footer", permission: { resource: "settings", action: "read" } },
  { label: "Settings", href: "/settings", icon: "settings", section: "footer", permission: { resource: "settings", action: "read" } },
];

const DEFAULT_PATH_ORDER: PermissionResource[] = [
  "dashboard",
  "orders",
  "notifications",
  "products",
  "bundles",
  "transactions",
  "blog",
  "site_pages",
  "installations",
  "energy_audits",
  "jobs",
  "customers",
  "installers",
  "admins",
  "settings",
];

const SECTION_LABELS: Record<Exclude<NavSectionKey, "footer">, string> = {
  main: "Main menu",
  product: "Product",
  finance: "Finance",
  content: "Content",
  operations: "Operations",
};

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function matchesPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function permissionKey(resource: PermissionResource, action: PermissionAction): PermissionKey {
  return `${resource}.${action}`;
}

function rolePermissionSet(role: AdminRole | null | undefined) {
  const normalized = normalizeAdminRole(role);
  const preset = normalized in ROLE_PERMISSION_PRESETS ? ROLE_PERMISSION_PRESETS[normalized as KnownAdminRole] : { settings: READ_UPDATE };
  const permissions = new Set<PermissionKey>();

  for (const resource of Object.keys(preset) as PermissionResource[]) {
    for (const action of preset[resource] ?? []) {
      permissions.add(permissionKey(resource, action));
    }
  }

  return permissions;
}

function effectivePermissionSet(role: AdminRole | null | undefined, permissions: string[] = []) {
  const effectivePermissions = rolePermissionSet(role);

  for (const permission of permissions) {
    for (const normalized of normalizePermissionEntries(permission)) {
      effectivePermissions.add(normalized);
    }
  }

  return effectivePermissions;
}

function normalizePermissionEntries(permission: string) {
  const normalized = normalizeLookupKey(permission);

  if (!normalized) {
    return [];
  }

  if (normalized === "*" || normalized === "all") {
    return KNOWN_RESOURCES.flatMap((resource) => ALL_ACTIONS.map((action) => permissionKey(resource, action)));
  }

  const lastDot = normalized.lastIndexOf(".");
  const resourcePart = lastDot === -1 ? normalized : normalized.slice(0, lastDot);
  const actionPart = lastDot === -1 ? "read" : normalized.slice(lastDot + 1);
  const resource = RESOURCE_ALIASES[resourcePart];
  const actions = ACTION_ALIASES[actionPart];

  if (!resource || !actions) {
    return [];
  }

  return actions.map((action) => permissionKey(resource, action));
}

function navigationHrefForResource(resource: PermissionResource) {
  const match = DASHBOARD_NAV_ITEMS.find((item) => item.permission?.resource === resource || item.children?.some((child) => child.permission.resource === resource));
  const directHref = match?.href;
  const nestedHref = match?.children?.find((child) => child.permission.resource === resource)?.href;
  return directHref ?? nestedHref ?? null;
}

export function normalizeAdminRole(role: AdminRole | null | undefined): AdminRole {
  const normalized = role ? normalizeLookupKey(role) : "";
  return (normalized || "super_admin") as AdminRole;
}

export function formatAdminRole(role: AdminRole | null | undefined) {
  return normalizeAdminRole(role)
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function getEffectivePermissionKeys(role: AdminRole | null | undefined, permissions: string[] = []) {
  return Array.from(effectivePermissionSet(role, permissions)).sort();
}

export function hasPermissionAccess(permission: PermissionDescriptor, role: AdminRole | null | undefined, permissions: string[] = []) {
  return effectivePermissionSet(role, permissions).has(permissionKey(permission.resource, permission.action));
}

export function getRouteTitle(pathname: string) {
  if (pathname.startsWith("/blog/") && pathname.endsWith("/edit")) {
    return "Edit Blog Post";
  }

  if (pathname.startsWith("/site-pages/") && pathname.endsWith("/edit")) {
    return "Edit SEO Page";
  }

  return ROUTE_RULES.find((rule) => matchesPath(pathname, rule.prefix))?.title ?? "Dashboard";
}

export function getRequiredPermissionForPath(pathname: string) {
  if (pathname.startsWith("/blog/") && pathname.endsWith("/edit")) {
    return { resource: "blog", action: "update" } as const;
  }

  if (pathname.startsWith("/site-pages/") && pathname.endsWith("/edit")) {
    return { resource: "site_pages", action: "update" } as const;
  }

  return ROUTE_RULES.find((rule) => matchesPath(pathname, rule.prefix))?.permission ?? null;
}

export function isDashboardPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/users") {
    return true;
  }

  return ROUTE_RULES.some((rule) => matchesPath(pathname, rule.prefix));
}

export function isPathAllowed(pathname: string, role: AdminRole | null | undefined, permissions: string[] = []): boolean {
  if (pathname === "/users") {
    return Boolean(getUsersLandingPath(role, permissions));
  }

  const requiredPermission = getRequiredPermissionForPath(pathname);

  if (!requiredPermission) {
    return false;
  }

  return hasPermissionAccess(requiredPermission, role, permissions);
}

export function getDefaultDashboardPath(role: AdminRole | null | undefined, permissions: string[] = []) {
  for (const resource of DEFAULT_PATH_ORDER) {
    if (hasPermissionAccess({ resource, action: "read" }, role, permissions)) {
      const href = navigationHrefForResource(resource);

      if (href) {
        return href;
      }
    }
  }

  return "/settings";
}

export function getUsersLandingPath(role: AdminRole | null | undefined, permissions: string[] = []) {
  const userRoutes = ["/users/customers", "/users/installers", "/users/admins"];
  return userRoutes.find((href) => isPathAllowed(href, role, permissions)) ?? null;
}

export function getVisibleNavigation(role: AdminRole | null | undefined, permissions: string[] = []) {
  return DASHBOARD_NAV_ITEMS.reduce<SectionWithItems[]>((sections, item) => {
    const nextItem =
      item.children?.length
        ? {
            ...item,
            children: item.children.filter((child) => hasPermissionAccess(child.permission, role, permissions)),
          }
        : item.permission && hasPermissionAccess(item.permission, role, permissions)
          ? {
              ...item,
              createHref:
                item.createHref && item.createPermission && hasPermissionAccess(item.createPermission, role, permissions)
                  ? item.createHref
                  : undefined,
            }
          : item;

    const visible = nextItem.children?.length ? nextItem.children.length > 0 : nextItem.permission ? hasPermissionAccess(nextItem.permission, role, permissions) : false;

    if (!visible) {
      return sections;
    }

    const existingSection = sections.find((section) => section.key === nextItem.section);

    if (existingSection) {
      existingSection.items.push(nextItem);
      return sections;
    }

    sections.push({
      key: nextItem.section,
      label: nextItem.section === "footer" ? undefined : SECTION_LABELS[nextItem.section],
      items: [nextItem],
    });

    return sections;
  }, []);
}
