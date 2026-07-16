export type Tone = "success" | "warning" | "danger" | "info" | "purple" | "neutral";

export type MetricIconName =
  | "wallet"
  | "sales"
  | "orders"
  | "products"
  | "installers"
  | "customers"
  | "bundles"
  | "notifications"
  | "calendar"
  | "verification"
  | "admins"
  | "retention"
  | "flag";

export type MetricPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export type MetricRecord = {
  title: string;
  value: string;
  delta?: string;
  deltaTone?: Tone;
  subtitle?: string;
  period?: MetricPeriod;
  icon: MetricIconName;
  spark: number[];
};

export type NotificationRecord = {
  id: string;
  title: string;
  description: string;
  time: string;
  tone: Tone;
};

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  location: string;
  joined: string;
  orders: number;
  spent: string;
  status: string;
  statusTone: Tone;
  phone: string;
};

export type InstallerRow = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  installations: number;
  performance: number;
  verification: string;
  verificationTone: Tone;
  status: string;
  statusTone: Tone;
  phone: string;
  address: string;
};

export type AdminRow = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  lastActive: string;
  joined: string;
  status: string;
  statusTone: Tone;
  phone: string;
  location: string;
};

export type OrderRow = {
  id: string;
  customer: string;
  product: string;
  image: string;
  extraItems: string;
  trackingId: string;
  date: string;
  amount: string;
  status: string;
  statusTone: Tone;
};

export type BundleRequestRow = {
  id: string;
  customer: string;
  bundle: string;
  email: string;
  phone: string;
  location: string;
  financing: "Yes" | "No";
  date: string;
  status: string;
  statusTone: Tone;
};

export type VerificationRow = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  date: string;
  status: string;
  tone: Tone;
  adminNote?: string;
  documents: VerificationDocument[];
};

export type VerificationDocument = {
  id: string;
  label: string;
  category: string;
  pages: number;
};

export type ActivityRecord = {
  id: string;
  title: string;
  description: string;
  meta: string;
  tone: Tone;
};

export type ReviewRecord = {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  status?: string;
  statusTone?: Tone;
  media?: string[];
  orderId?: string;
  itemLabel?: string;
};

export type RatingBreakdownRow = {
  label: string;
  value: string;
  fill: number;
};

export type ChartPeriod = "all" | "yearly" | "monthly" | "weekly";

export const metricPeriodOptions: MetricPeriod[] = ["daily", "weekly", "monthly", "quarterly", "yearly"];

export const avatarAssets = {
  sarah: "avatar-sarah",
  john: "avatar-john",
  nessie: "avatar-nessie",
  charles: "avatar-charles",
  james: "avatar-james",
  emily: "avatar-emily",
  michael: "avatar-michael",
  wade: "avatar-wade",
} as const;

export const productAssets = {
  panel: "product-panel",
  battery: "product-battery",
  inverter: "product-inverter",
  fan: "product-fan",
  furniture: "product-furniture",
  bundle: "product-bundle",
} as const;

export const mapPreview = "/dashboard/map.svg";

export function toneFromStatus(status: string): Tone {
  const normalized = status.toLowerCase();

  if (normalized.includes("inactive") || normalized.includes("deactivated") || normalized.includes("disactivated")) {
    return "neutral";
  }

  if (
    normalized.includes("approved") ||
    normalized.includes("active") ||
    normalized.includes("verified") ||
    normalized.includes("delivered") ||
    normalized.includes("completed") ||
    normalized.includes("granted") ||
    normalized.includes("published") ||
    normalized.includes("sent") ||
    normalized === "open"
  ) {
    return "success";
  }

  if (normalized.includes("pending") || normalized.includes("processing") || normalized.includes("new") || normalized === "assigned") {
    return "warning";
  }

  if (normalized.includes("cancelled") || normalized.includes("rejected") || normalized.includes("suspended") || normalized.includes("flagged") || normalized.includes("restricted")) {
    return "danger";
  }

  if (normalized.includes("packed") || normalized.includes("transit") || normalized.includes("shipped") || normalized.includes("paused") || normalized.includes("progress")) {
    return normalized.includes("shipped") ? "purple" : "info";
  }

  return "neutral";
}

export function toneFromOrderStatus(status: string): Tone {
  return toneFromStatus(status);
}

export const currentAdminUser = {
  name: "Sarah Johnson",
  role: "Super Admin",
  avatar: avatarAssets.sarah,
  initials: "SJ",
};

export const headerNotifications: NotificationRecord[] = [
  {
    id: "NTF-1",
    title: "3 installer documents awaiting review",
    description: "The verification queue has new submissions from Lagos and Abuja.",
    time: "2 mins ago",
    tone: "warning",
  },
  {
    id: "NTF-2",
    title: "Bundle request updated",
    description: "Savannah Nguyen's package request moved to installer dispatch.",
    time: "12 mins ago",
    tone: "info",
  },
  {
    id: "NTF-3",
    title: "Revenue target exceeded",
    description: "Sales closed above the weekly target by 10.4%.",
    time: "1 hour ago",
    tone: "success",
  },
];

export const dashboardPrimaryMetrics: MetricRecord[] = [
  {
    title: "Total Revenue",
    value: "₦7.4M",
    delta: "+10.4%",
    deltaTone: "success",
    subtitle: "from last month",
    icon: "wallet",
    spark: [18, 28, 40, 64, 36, 30],
  },
  {
    title: "Total Sales",
    value: "₦350K",
    delta: "+10.4%",
    deltaTone: "success",
    subtitle: "from last month",
    icon: "sales",
    spark: [20, 42, 48, 60, 40, 34],
  },
  {
    title: "Total Orders",
    value: "10.7K",
    delta: "-0.4%",
    deltaTone: "danger",
    subtitle: "from last month",
    icon: "orders",
    spark: [14, 18, 26, 62, 30, 18],
  },
];

export const dashboardSecondaryMetrics: MetricRecord[] = [
  {
    title: "Active Installers",
    value: "100",
    delta: "+10.4%",
    deltaTone: "success",
    period: "monthly",
    icon: "installers",
    spark: [14, 18, 24, 30, 38, 42],
  },
  {
    title: "Active Buyers",
    value: "30K",
    delta: "-40%",
    deltaTone: "danger",
    period: "monthly",
    icon: "customers",
    spark: [54, 52, 48, 40, 30, 24],
  },
  {
    title: "Bundle requests",
    value: "123",
    period: "monthly",
    icon: "bundles",
    spark: [10, 18, 26, 34, 26, 18],
  },
  {
    title: "Installer Verifications",
    value: "8",
    delta: "+1.4%",
    deltaTone: "success",
    subtitle: "since yesterday",
    icon: "verification",
    spark: [8, 16, 18, 22, 20, 26],
  },
];

export const revenueSeries: Record<
  ChartPeriod,
  {
    labels: string[];
    values: number[];
    tooltipIndex: number;
    tooltipLabel: string;
    tooltipValue: string;
  }
> = {
  all: {
    labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    values: [16000, 28000, 28000, 20000, 36000, 23000, 31000],
    tooltipIndex: 3,
    tooltipLabel: "April 12, 8:00AM",
    tooltipValue: "₦20,000",
  },
  yearly: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
    values: [11000, 18000, 22000, 16000, 26000, 32000, 35000],
    tooltipIndex: 5,
    tooltipLabel: "June performance",
    tooltipValue: "₦32,000",
  },
  monthly: {
    labels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7"],
    values: [12000, 24000, 24000, 18000, 30000, 22000, 26000],
    tooltipIndex: 4,
    tooltipLabel: "Week 5 performance",
    tooltipValue: "₦30,000",
  },
  weekly: {
    labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    values: [9000, 15000, 18000, 14000, 22000, 16000, 21000],
    tooltipIndex: 6,
    tooltipLabel: "Saturday close",
    tooltipValue: "₦21,000",
  },
};

export const dashboardRecentActivities: ActivityRecord[] = [
  {
    id: "ACT-1",
    title: "New Vendor Registration",
    description: "Eco Crafts submitted their verification documents",
    meta: "10 mins ago",
    tone: "success",
  },
  {
    id: "ACT-2",
    title: "Transaction Completed",
    description: "₦32,450 payment released to Home Essentials",
    meta: "20 mins ago",
    tone: "success",
  },
  {
    id: "ACT-3",
    title: "New Bundle Request",
    description: "Customer reported an item not as described",
    meta: "45 mins ago",
    tone: "danger",
  },
  {
    id: "ACT-4",
    title: "System Alert",
    description: "Payment gateway experiencing delay",
    meta: "1 hour ago",
    tone: "purple",
  },
];

export const customerDirectory: CustomerRow[] = [
  {
    id: "CUS78956",
    name: "John Doe",
    email: "michael.mitc@example.com",
    avatar: avatarAssets.john,
    location: "Lagos, Nigeria",
    joined: "Jan 12, 2023",
    orders: 24,
    spent: "₦25,400",
    status: "Active",
    statusTone: toneFromStatus("Active"),
    phone: "+1 000 567 3456",
  },
  {
    id: "CUS78957",
    name: "Nessie Smith",
    email: "nevaeh.simmons@example.com",
    avatar: avatarAssets.nessie,
    location: "Lagos, Nigeria",
    joined: "Mar 8, 2023",
    orders: 45,
    spent: "₦25,400",
    status: "New",
    statusTone: toneFromStatus("New"),
    phone: "+1 000 567 3488",
  },
  {
    id: "CUS78958",
    name: "Charles Clifford",
    email: "georgia.young@example.com",
    avatar: avatarAssets.charles,
    location: "Lagos, Nigeria",
    joined: "Nov 22, 2023",
    orders: 42,
    spent: "₦25,400",
    status: "Active",
    statusTone: toneFromStatus("Active"),
    phone: "+1 000 321 8821",
  },
  {
    id: "CUS78959",
    name: "James Harrison",
    email: "bill.sanders@example.com",
    avatar: avatarAssets.james,
    location: "Lagos, Nigeria",
    joined: "Jan 15, 2022",
    orders: 39,
    spent: "₦25,400",
    status: "Inactive",
    statusTone: toneFromStatus("Inactive"),
    phone: "+1 000 667 1981",
  },
  {
    id: "CUS78960",
    name: "Emily Wilson",
    email: "deanna.curtis@example.com",
    avatar: avatarAssets.emily,
    location: "Edo, Nigeria",
    joined: "Feb 20, 2022",
    orders: 50,
    spent: "₦25,400",
    status: "Active",
    statusTone: toneFromStatus("Active"),
    phone: "+1 000 905 4421",
  },
  {
    id: "CUS78961",
    name: "Michael Kim",
    email: "dolores.chambers@example.com",
    avatar: avatarAssets.michael,
    location: "Port Harcourt, Nigeria",
    joined: "May 1, 2022",
    orders: 46,
    spent: "₦25,400",
    status: "Active",
    statusTone: toneFromStatus("Active"),
    phone: "+1 000 112 5548",
  },
];

export const installerDirectory: InstallerRow[] = [
  {
    id: "VEN78956",
    name: "Wade Warren",
    email: "debbie.baker@example.com",
    avatar: avatarAssets.wade,
    installations: 124,
    performance: 4.9,
    verification: "Verified",
    verificationTone: toneFromStatus("Verified"),
    status: "Active",
    statusTone: toneFromStatus("Active"),
    phone: "+1 000 567 3456",
    address: "123 Main Street Apt 4B, New York, NY 10001",
  },
  {
    id: "VEN78957",
    name: "Marvin McKinney",
    email: "curtis.weaver@example.com",
    avatar: avatarAssets.charles,
    installations: 287,
    performance: 4.5,
    verification: "Verified",
    verificationTone: toneFromStatus("Verified"),
    status: "Active",
    statusTone: toneFromStatus("Active"),
    phone: "+1 000 232 8894",
    address: "17 Admiralty Way, Lekki, Lagos",
  },
  {
    id: "VEN78958",
    name: "Ralph Edwards",
    email: "deanna.curtis@example.com",
    avatar: avatarAssets.michael,
    installations: 156,
    performance: 4.2,
    verification: "Verified",
    verificationTone: toneFromStatus("Verified"),
    status: "Active",
    statusTone: toneFromStatus("Active"),
    phone: "+1 000 212 9812",
    address: "31 Gana Street, Maitama, Abuja",
  },
  {
    id: "VEN78959",
    name: "Bessie Cooper",
    email: "sara.cruz@example.com",
    avatar: avatarAssets.nessie,
    installations: 120,
    performance: 5,
    verification: "Verified",
    verificationTone: toneFromStatus("Verified"),
    status: "Active",
    statusTone: toneFromStatus("Active"),
    phone: "+1 000 111 2234",
    address: "5 Herbert Macaulay Way, Yaba, Lagos",
  },
  {
    id: "VEN78960",
    name: "Cameron Williamson",
    email: "tim.jennings@example.com",
    avatar: avatarAssets.john,
    installations: 120,
    performance: 5,
    verification: "Verified",
    verificationTone: toneFromStatus("Verified"),
    status: "Active",
    statusTone: toneFromStatus("Active"),
    phone: "+1 000 447 0098",
    address: "12 Stadium Road, Port Harcourt",
  },
  {
    id: "VEN78961",
    name: "Jenny Wilson",
    email: "georgia.young@example.com",
    avatar: avatarAssets.emily,
    installations: 20,
    performance: 4.6,
    verification: "Verified",
    verificationTone: toneFromStatus("Verified"),
    status: "Flagged",
    statusTone: toneFromStatus("Flagged"),
    phone: "+1 000 441 0071",
    address: "22 Ikorodu Road, Maryland, Lagos",
  },
];

export const adminDirectory: AdminRow[] = [
  {
    id: "ADM1201",
    name: "Sarah Johnson",
    email: "sarah.johnson@gmail.com",
    avatar: avatarAssets.sarah,
    role: "Super Admin",
    lastActive: "01 Apr 2025 | 12:30 pm",
    joined: "Jan 12, 2023",
    status: "Active",
    statusTone: toneFromStatus("Active"),
    phone: "+1 000 567 3456",
    location: "Lagos",
  },
  {
    id: "ADM1202",
    name: "Nessie Smith",
    email: "nessie.smith@gmail.com",
    avatar: avatarAssets.nessie,
    role: "Admin",
    lastActive: "01 Apr 2025 | 12:30 pm",
    joined: "Jan 12, 2023",
    status: "Active",
    statusTone: toneFromStatus("Active"),
    phone: "+1 000 567 3488",
    location: "Lagos",
  },
  {
    id: "ADM1203",
    name: "Charles Clifford",
    email: "charles.clifford@gmail.com",
    avatar: avatarAssets.charles,
    role: "BDM",
    lastActive: "01 Apr 2025 | 12:30 pm",
    joined: "Jan 12, 2023",
    status: "Inactive",
    statusTone: toneFromStatus("Inactive"),
    phone: "+1 000 321 8821",
    location: "Lagos",
  },
  {
    id: "ADM1204",
    name: "James Harrison",
    email: "james.harrison@gmail.com",
    avatar: avatarAssets.james,
    role: "Admin",
    lastActive: "01 Apr 2025 | 12:30 pm",
    joined: "Jan 12, 2023",
    status: "Inactive",
    statusTone: toneFromStatus("Inactive"),
    phone: "+1 000 667 1981",
    location: "Port Harcourt",
  },
  {
    id: "ADM1205",
    name: "Emily Wilson",
    email: "emily.wilson@gmail.com",
    avatar: avatarAssets.emily,
    role: "BDM",
    lastActive: "01 Apr 2025 | 12:30 pm",
    joined: "Jan 12, 2023",
    status: "Active",
    statusTone: toneFromStatus("Active"),
    phone: "+1 000 905 4421",
    location: "Abuja",
  },
  {
    id: "ADM1206",
    name: "Michael Kim",
    email: "michael.kim@gmail.com",
    avatar: avatarAssets.michael,
    role: "Admin",
    lastActive: "01 Apr 2025 | 12:30 pm",
    joined: "Jan 12, 2023",
    status: "Suspended",
    statusTone: toneFromStatus("Suspended"),
    phone: "+1 000 112 5548",
    location: "Benin",
  },
];

export const orderRows: OrderRow[] = [
  {
    id: "ORD192001",
    customer: "John Doe",
    product: "JDDW2 Solar Panels",
    image: productAssets.panel,
    extraItems: "+5 others",
    trackingId: "--",
    date: "Jan 12, 2025",
    amount: "₦320,000",
    status: "Cancelled",
    statusTone: toneFromOrderStatus("Cancelled"),
  },
  {
    id: "ORD192002",
    customer: "Nessie Smith",
    product: "Lithium Battery",
    image: productAssets.battery,
    extraItems: "+3 others",
    trackingId: "UK8843GIG10",
    date: "Feb 12, 2024",
    amount: "₦320,000",
    status: "Order Packed",
    statusTone: toneFromOrderStatus("Order Packed"),
  },
  {
    id: "ORD192003",
    customer: "Charles Clifford",
    product: "Smart Inverter",
    image: productAssets.inverter,
    extraItems: "+15 others",
    trackingId: "UK8843GIG10",
    date: "Mar 12, 2024",
    amount: "₦320,000",
    status: "Processing",
    statusTone: toneFromOrderStatus("Processing"),
  },
  {
    id: "ORD192004",
    customer: "James Harrison",
    product: "Adjustable Dumbbells",
    image: productAssets.furniture,
    extraItems: "+2 others",
    trackingId: "UK8843GIG10",
    date: "Apr 12, 2023",
    amount: "₦320,000",
    status: "Delivered",
    statusTone: toneFromOrderStatus("Delivered"),
  },
  {
    id: "ORD192005",
    customer: "Emily Wilson",
    product: "Solar fan",
    image: productAssets.fan,
    extraItems: "+7 others",
    trackingId: "UK8843GIG10",
    date: "May 12, 2022",
    amount: "₦320,000",
    status: "In Transit",
    statusTone: toneFromOrderStatus("In Transit"),
  },
  {
    id: "ORD192006",
    customer: "Michael Kim",
    product: "Baseball Cap",
    image: productAssets.bundle,
    extraItems: "+5 others",
    trackingId: "UK8843GIG10",
    date: "Jun 12, 2022",
    amount: "₦320,000",
    status: "Shipped",
    statusTone: toneFromOrderStatus("Shipped"),
  },
];

export const bundleRequestRows: BundleRequestRow[] = [
  {
    id: "BR1001",
    customer: "Bessie Cooper",
    bundle: "Campus Bundle",
    email: "randomuser@email.com",
    phone: "+234 9012624166",
    location: "Port Harcourt",
    financing: "Yes",
    date: "24 May, 2020",
    status: "Processing",
    statusTone: toneFromStatus("Processing"),
  },
  {
    id: "BR1002",
    customer: "Savannah Nguyen",
    bundle: "Campus Bundle",
    email: "randomuser@email.com",
    phone: "+234 9012624166",
    location: "Ibeju",
    financing: "No",
    date: "8 Sep, 2020",
    status: "System Installed",
    statusTone: toneFromStatus("Approved"),
  },
  {
    id: "BR1003",
    customer: "Floyd Miles",
    bundle: "Campus Bundle",
    email: "randomuser@email.com",
    phone: "+234 9012624166",
    location: "Ikeja",
    financing: "No",
    date: "22 Oct, 2020",
    status: "System Installed",
    statusTone: toneFromStatus("Approved"),
  },
  {
    id: "BR1004",
    customer: "Darlene Robertson",
    bundle: "Campus Bundle",
    email: "randomuser@email.com",
    phone: "+234 9012624166",
    location: "Gwarimpa",
    financing: "Yes",
    date: "21 Sep, 2020",
    status: "Installer in-transit",
    statusTone: toneFromStatus("In Transit"),
  },
  {
    id: "BR1005",
    customer: "Cody Fisher",
    bundle: "Home Bundle",
    email: "randomuser@email.com",
    phone: "+234 9012624166",
    location: "Oron",
    financing: "No",
    date: "17 Oct, 2020",
    status: "Closed",
    statusTone: "neutral",
  },
  {
    id: "BR1006",
    customer: "Jenny Wilson",
    bundle: "Campus Lite",
    email: "randomuser@email.com",
    phone: "+234 9012624166",
    location: "Lagos",
    financing: "Yes",
    date: "1 Feb, 2020",
    status: "Packed",
    statusTone: toneFromStatus("Shipped"),
  },
];

export const verificationRows: VerificationRow[] = [
  {
    id: "VER1",
    name: "Cody Fisher",
    email: "alma.lawson@example.com",
    avatar: avatarAssets.john,
    date: "March 6, 2018",
    status: "Pending",
    tone: toneFromStatus("Pending"),
    documents: [
      { id: "cac", label: "Certification", category: "Business Registration", pages: 1 },
      { id: "nin", label: "NIN", category: "National Identity", pages: 1 },
      { id: "utility", label: "Utility Bill", category: "Address Verification", pages: 2 },
    ],
  },
  {
    id: "VER2",
    name: "Bessie Cooper",
    email: "nevaeh.simmons@example.com",
    avatar: avatarAssets.nessie,
    date: "October 30, 2017",
    status: "Pending",
    tone: toneFromStatus("Pending"),
    documents: [
      { id: "cac", label: "Certification", category: "Business Registration", pages: 2 },
      { id: "nin", label: "NIN", category: "National Identity", pages: 1 },
      { id: "permit", label: "Installer Permit", category: "Technical License", pages: 1 },
    ],
  },
  {
    id: "VER3",
    name: "Albert Flores",
    email: "michael.mitc@example.com",
    avatar: avatarAssets.charles,
    date: "October 24, 2018",
    status: "Approved",
    tone: toneFromStatus("Approved"),
    documents: [
      { id: "cac", label: "Certification", category: "Business Registration", pages: 1 },
      { id: "tax", label: "Tax Clearance", category: "Compliance", pages: 2 },
      { id: "nin", label: "NIN", category: "National Identity", pages: 1 },
    ],
  },
  {
    id: "VER4",
    name: "Jerome Bell",
    email: "nathan.roberts@example.com",
    avatar: avatarAssets.james,
    date: "February 9, 2015",
    status: "Rejected",
    tone: toneFromStatus("Rejected"),
    adminNote: "Uploaded ID is blurred and the business certificate does not match the registered installer name.",
    documents: [
      { id: "cac", label: "Certification", category: "Business Registration", pages: 1 },
      { id: "nin", label: "NIN", category: "National Identity", pages: 1 },
      { id: "address", label: "Address Proof", category: "Utility Bill", pages: 1 },
    ],
  },
  {
    id: "VER5",
    name: "Dianne Russell",
    email: "kenzi.lawson@example.com",
    avatar: avatarAssets.emily,
    date: "May 9, 2014",
    status: "Pending",
    tone: toneFromStatus("Pending"),
    documents: [
      { id: "cac", label: "Certification", category: "Business Registration", pages: 2 },
      { id: "nin", label: "NIN", category: "National Identity", pages: 1 },
      { id: "insurance", label: "Insurance", category: "Liability Cover", pages: 1 },
    ],
  },
  {
    id: "VER6",
    name: "Darlene Robertson",
    email: "jessica.hanson@example.com",
    avatar: avatarAssets.sarah,
    date: "February 28, 2018",
    status: "Approved",
    tone: toneFromStatus("Approved"),
    documents: [
      { id: "cac", label: "Certification", category: "Business Registration", pages: 1 },
      { id: "permit", label: "Installer Permit", category: "Technical License", pages: 1 },
      { id: "tax", label: "Tax Clearance", category: "Compliance", pages: 2 },
    ],
  },
  {
    id: "VER7",
    name: "Jenny Wilson",
    email: "michelle.rivera@example.com",
    avatar: avatarAssets.emily,
    date: "April 28, 2016",
    status: "Pending",
    tone: toneFromStatus("Pending"),
    documents: [
      { id: "cac", label: "Certification", category: "Business Registration", pages: 1 },
      { id: "nin", label: "NIN", category: "National Identity", pages: 1 },
      { id: "bank", label: "Bank Statement", category: "Financial Record", pages: 2 },
    ],
  },
  {
    id: "VER8",
    name: "Darrell Steward",
    email: "willie.jennings@example.com",
    avatar: avatarAssets.wade,
    date: "May 12, 2019",
    status: "Approved",
    tone: toneFromStatus("Approved"),
    documents: [
      { id: "cac", label: "Certification", category: "Business Registration", pages: 1 },
      { id: "permit", label: "Installer Permit", category: "Technical License", pages: 2 },
      { id: "insurance", label: "Insurance", category: "Liability Cover", pages: 1 },
    ],
  },
];

export const customerPurchases = [
  {
    id: "ORD192001",
    product: "JDW445 Panels",
    image: productAssets.panel,
    extraItems: "+5 others",
    orderDate: "Jan 25, 2025",
    amount: "₦320,000",
    payment: "Paid via Card",
    delivery: "March 25, 2025",
    status: "In Transit",
  },
  {
    id: "ORD192002",
    product: "Casio Inverter",
    image: productAssets.inverter,
    extraItems: "+15 others",
    orderDate: "Jan 25, 2025",
    amount: "₦320,000",
    payment: "Paid via Card",
    delivery: "March 25, 2025",
    status: "Delivered",
  },
  {
    id: "ORD192003",
    product: "Lithium Battery",
    image: productAssets.battery,
    extraItems: "+3 others",
    orderDate: "Jan 25, 2025",
    amount: "₦320,000",
    payment: "Paid via Card",
    delivery: "March 25, 2025",
    status: "Delivered",
  },
];

export const customerWishlist = [
  {
    id: "WISH-1",
    title: "450W Monocrystalline Solar Panel",
    subtitle: "Clean energy essentials",
    image: productAssets.panel,
    price: "₦132,000",
  },
  {
    id: "WISH-2",
    title: "48V Lithium Battery Pack",
    subtitle: "Backup power",
    image: productAssets.battery,
    price: "₦85,000",
  },
  {
    id: "WISH-3",
    title: "Smart Hybrid Inverter",
    subtitle: "Home optimization",
    image: productAssets.inverter,
    price: "₦210,000",
  },
];

export const customerActivityFeed: ActivityRecord[] = [
  {
    id: "C-ACT-1",
    title: "User Login",
    description: "Login Activity: User logged in to their Qarrt account",
    meta: "23/02/2025 | Benin-City | Android",
    tone: "success",
  },
  {
    id: "C-ACT-2",
    title: "New Order Placed",
    description: "User placed an order worth ₦320,000",
    meta: "23/02/2025 | Benin-City | Android",
    tone: "info",
  },
  {
    id: "C-ACT-3",
    title: "New Review Submitted",
    description: "User left a review for Tech Gadgets Vendor - check it out!",
    meta: "23/02/2025 | Benin-City | Android",
    tone: "warning",
  },
  {
    id: "C-ACT-4",
    title: "Updated Profile Info",
    description: "User updated their account details",
    meta: "23/02/2025 | Benin-City | Android",
    tone: "success",
  },
  {
    id: "C-ACT-5",
    title: "Cancelled an Order",
    description: "User cancelled their recent order #ORD123456",
    meta: "23/02/2025 | Benin-City | Android",
    tone: "danger",
  },
  {
    id: "C-ACT-6",
    title: "Filed a Dispute",
    description: "User opened a disputed on order #ORD123456",
    meta: "23/02/2025 | Benin-City | Android",
    tone: "danger",
  },
  {
    id: "C-ACT-7",
    title: "Changed Password",
    description: "Security Update: User changed their account password",
    meta: "23/02/2025 | Benin-City | Android",
    tone: "purple",
  },
];

export const customerRatingBreakdown: RatingBreakdownRow[] = [
  { label: "5 - Excellent", value: "1000", fill: 68 },
  { label: "4 - Good", value: "800", fill: 52 },
  { label: "3 - Okay", value: "2000", fill: 82 },
];

export const customerReviews: ReviewRecord[] = [
  {
    id: "CR-1",
    author: "John Doe",
    avatar: avatarAssets.john,
    rating: 4,
    title: "Well done!",
    body: "I bought the 450W Monocrystalline Solar Panel from FortSolar, and it's been amazing. The power output is consistent even on cloudy days, and their team delivered right on time. Great value for money.",
    date: "Posted on Dec 6, 2023",
    status: "Published",
    statusTone: toneFromStatus("Approved"),
    media: [productAssets.panel, productAssets.inverter, productAssets.battery],
    orderId: "#ORD-192002",
    itemLabel: "450W Monocrystalline Solar Pane",
  },
  {
    id: "CR-2",
    author: "John Doe",
    avatar: avatarAssets.john,
    rating: 4,
    title: "Well done!",
    body: "I bought the 450W Monocrystalline Solar Panel from FortSolar, and it's been amazing. The power output is consistent even on cloudy days, and their team delivered right on time. Great value for money.",
    date: "Posted on Dec 6, 2023",
    status: "Published",
    statusTone: toneFromStatus("Approved"),
    media: [productAssets.panel, productAssets.inverter, productAssets.battery],
    orderId: "#ORD-192002",
    itemLabel: "450W Monocrystalline Solar Pane",
  },
];

export const installerSkills = ["Inverter Setup", "Battery Configuration", "Wiring", "Site Inspection"];

export const installerRatingBreakdown: RatingBreakdownRow[] = [
  { label: "5 - Excellent", value: "1000", fill: 58 },
  { label: "4 - Good", value: "800", fill: 45 },
  { label: "3 - Okay", value: "300", fill: 22 },
];

export const installerReviews: ReviewRecord[] = [
  {
    id: "IR-1",
    author: "John Doe",
    avatar: avatarAssets.john,
    rating: 3,
    title: "Well done!",
    body: "Product works fine, but the packaging looked a bit rough. Customer support responded quickly, though, and assured me everything was in order. Average but decent.",
    date: "Today, 13:05pm",
  },
  {
    id: "IR-2",
    author: "Harrison Wells",
    avatar: avatarAssets.charles,
    rating: 3,
    title: "Well done!",
    body: "I ordered a pair of noise-cancelling headphones from Tech Gadgets Inc., and they arrived earlier than expected. Packaging was secure, and the product works perfectly. Will definitely shop again!",
    date: "Today, 13:05pm",
  },
  {
    id: "IR-3",
    author: "Steve Jobs",
    avatar: avatarAssets.james,
    rating: 3,
    title: "Well done!",
    body: "Ordered a blender, received a used one. Tried contacting the vendor but got no response for days. Still waiting for a resolution.",
    date: "Today, 13:05pm",
  },
  {
    id: "IR-4",
    author: "Will Smith",
    avatar: avatarAssets.michael,
    rating: 3,
    title: "Well done!",
    body: "Good communication, clean installation, and the work was completed within schedule. I would use this installer again.",
    date: "Today, 13:05pm",
  },
];

export const adminActivityFeed: ActivityRecord[] = [
  {
    id: "ADM-ACT-1",
    title: "Login",
    description: "Today at 9:24 AM • 192.168.1.1",
    meta: "Success",
    tone: "success",
  },
  {
    id: "ADM-ACT-2",
    title: "Approved Installer Application",
    description: "Approved JD Cliff Solar expert's application",
    meta: "Action",
    tone: "info",
  },
  {
    id: "ADM-ACT-3",
    title: "Updated Systems Settings",
    description: "Changed commission rates for products",
    meta: "Action",
    tone: "info",
  },
  {
    id: "ADM-ACT-4",
    title: "Login",
    description: "Today at 9:24 AM • 192.168.1.1",
    meta: "Success",
    tone: "success",
  },
  {
    id: "ADM-ACT-5",
    title: "Password Change",
    description: "Yesterday at 9:24 AM • 192.168.1.1",
    meta: "Security",
    tone: "purple",
  },
];

export const adminPermissions = [
  { module: "Dashboard", accessLevel: "Full Access", status: "Granted" },
  { module: "User Management", accessLevel: "Full Access", status: "Granted" },
  { module: "Order Management", accessLevel: "Full Access", status: "Granted" },
  { module: "Analytics", accessLevel: "Full Access", status: "Granted" },
  { module: "Product Management", accessLevel: "No Access", status: "Restricted" },
  { module: "Financial Management", accessLevel: "Full Access", status: "Granted" },
];

export const adminPermissionOptions = [
  "User Management",
  "Order Management",
  "Product Listings",
  "Installer Management",
];

export const orderTimeline = [
  {
    id: "TL-1",
    title: "Processing",
    date: "Apr 10, 2023 - 4:30pm",
    description: "Your order is being processed",
  },
  {
    id: "TL-2",
    title: "Order Packed",
    date: "Apr 9, 2023 - 10:23am",
    description: "Order has been packed and is ready for shipping",
  },
  {
    id: "TL-3",
    title: "Shipped",
    date: "Apr 10, 2023 - 9:13am",
    description: "Order has been picked up by GIG Logistics",
  },
  {
    id: "TL-4",
    title: "In Transit",
    date: "Apr 10, 2023 - 4:30pm",
    description: "Order is in transit to the destination",
  },
  {
    id: "TL-5",
    title: "Delivered",
    date: "Estimated: Apr 12, 2023",
    description: "Buyer has received the package",
  },
];

export const orderSummaryItems = [
  { title: "Lithium Batteries", image: productAssets.battery, amount: "₦32,060.00" },
  { title: "Solar Panels", image: productAssets.panel, amount: "₦32,060.00" },
  { title: "Solar Fan", image: productAssets.fan, amount: "₦32,060.00" },
];

export function getCustomer(id: string) {
  return customerDirectory.find((customer) => customer.id === id) ?? customerDirectory[0];
}

export function getInstaller(id: string) {
  return installerDirectory.find((installer) => installer.id === id) ?? installerDirectory[0];
}

export function getAdmin(id: string) {
  return adminDirectory.find((admin) => admin.id === id) ?? adminDirectory[0];
}

export function getOrder(id: string) {
  return orderRows.find((order) => order.id === id) ?? orderRows[0];
}
