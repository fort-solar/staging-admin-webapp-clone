import { productAssets, toneFromStatus, type MetricRecord, type Tone } from "@/lib/dashboard-data";

export type ProductStatus = "Active" | "Inactive" | "Pending";

export type ProductRecord = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  price: string;
  discountedPrice: string;
  quantity: number;
  status: ProductStatus;
  statusTone: Tone;
  summary: string;
  description: string;
  sales: number;
  remaining: number;
  image: string;
  gallery: string[];
  datasheet: string;
  highlights: Array<{ label: string; value: string }>;
  submittedAt: string;
};

export type ProductCategoryRecord = {
  id: string;
  title: string;
  productCount: number;
  emphasis?: boolean;
};

export type BundleRecord = {
  id: string;
  slug: string;
  name: string;
  type: string;
  price: string;
  status: "Pending" | "Published" | "Draft";
  statusTone: Tone;
  requests: number;
  financeEnabled: boolean;
  summary: string;
  overview: string;
  image: string;
  gallery: string[];
  datasheet: string;
  includes: Array<{ label: string; qty: string }>;
  systemDetails: Array<{ label: string; value: string }>;
  powers: string[];
  submittedAt: string;
};

export type NotificationManagementTab = "Scheduled" | "Triggered" | "Draft";

export type NotificationManagementRecord = {
  id: string;
  kind: "Scheduled" | "Triggered";
  tab: NotificationManagementTab;
  title: string;
  content: string;
  recipients: string;
  triggerEvent?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  frequency?: string;
  createdAt: string;
  updatedAt: string;
  totalClicks: number;
  status: string;
  statusTone: Tone;
};

export const productsMetrics: MetricRecord[] = [
  {
    title: "Total Products",
    value: "100,000",
    icon: "products",
    spark: [24, 28, 34, 42, 48, 56],
  },
  {
    title: "Pending Review",
    value: "100",
    subtitle: "Products awaiting approvals",
    icon: "verification",
    spark: [28, 24, 21, 18, 16, 14],
  },
  {
    title: "Most Sold Product",
    value: "Panel 244",
    delta: "+10.4%",
    deltaTone: "success",
    subtitle: "from last month",
    icon: "sales",
    spark: [10, 18, 24, 36, 44, 58],
  },
  {
    title: "Published Products",
    value: "80,000",
    subtitle: "Product listings approved",
    icon: "products",
    spark: [14, 20, 26, 38, 44, 52],
  },
];

export const productCategoriesMetrics: MetricRecord[] = [
  {
    title: "Total Categories",
    value: "15",
    subtitle: "Main categories",
    icon: "products",
    spark: [18, 16, 22, 26, 28, 34],
  },
  {
    title: "Most Popular",
    value: "Panels",
    subtitle: "32% of total sales",
    icon: "sales",
    spark: [24, 26, 30, 38, 46, 50],
  },
  {
    title: "Category Requests",
    value: "5",
    subtitle: "Across all users",
    icon: "notifications",
    spark: [10, 16, 18, 16, 14, 12],
  },
];

export const productCategories: ProductCategoryRecord[] = [
  { id: "CAT-1", title: "Battery", productCount: 255 },
  { id: "CAT-2", title: "Solar", productCount: 255, emphasis: true },
  { id: "CAT-3", title: "Panels", productCount: 255 },
  { id: "CAT-4", title: "Accessories", productCount: 255 },
  { id: "CAT-5", title: "Battery", productCount: 255 },
  { id: "CAT-6", title: "Solar", productCount: 255, emphasis: true },
  { id: "CAT-7", title: "Panels", productCount: 255 },
  { id: "CAT-8", title: "Accessories", productCount: 255 },
];

export const productRecords: ProductRecord[] = [
  {
    id: "PRD78956",
    slug: "solar-fan",
    name: "Solar Fan",
    brand: "Fortsolar Home",
    category: "Appliances",
    price: "₦110,400",
    discountedPrice: "₦98,000",
    quantity: 24,
    status: "Inactive",
    statusTone: toneFromStatus("Inactive"),
    summary: "Compact solar-ready fan built for low-power home cooling.",
    description:
      "The Solar Fan delivers reliable airflow for compact rooms, shop kiosks, and weekend cabins. It is tuned for low power draw and pairs cleanly with entry-level solar kits.",
    sales: 24,
    remaining: 7,
    image: productAssets.fan,
    gallery: [productAssets.fan, productAssets.panel, productAssets.inverter],
    datasheet: "Solar-Fan-Datasheet.pdf",
    highlights: [
      { label: "Power Output", value: "65W" },
      { label: "Voltage", value: "24V DC" },
      { label: "Efficiency", value: "93%" },
      { label: "Warranty", value: "2 Years" },
      { label: "Brand", value: "Fortsolar Home" },
      { label: "Weight", value: "8.5kg" },
    ],
    submittedAt: "Submitted on Apr 15, 2025",
  },
  {
    id: "PRD78957",
    slug: "jwt-inverter",
    name: "JWT Inverter",
    brand: "JWT Power",
    category: "Inverters",
    price: "₦110,400",
    discountedPrice: "₦102,300",
    quantity: 18,
    status: "Active",
    statusTone: toneFromStatus("Active"),
    summary: "Hybrid inverter with optimized charging and seamless switchover.",
    description:
      "JWT Inverter balances residential loads with efficient switching and stable battery management. It is configured for off-grid and hybrid use cases where clean conversion matters.",
    sales: 24,
    remaining: 1269,
    image: productAssets.inverter,
    gallery: [productAssets.inverter, productAssets.panel, productAssets.battery],
    datasheet: "JWT-Inverter-Datasheet.pdf",
    highlights: [
      { label: "Power Output", value: "5kVA" },
      { label: "Battery Support", value: "48V" },
      { label: "Efficiency", value: "96%" },
      { label: "Warranty", value: "3 Years" },
      { label: "Brand", value: "JWT Power" },
      { label: "Weight", value: "28kg" },
    ],
    submittedAt: "Submitted on Apr 11, 2025",
  },
  {
    id: "PRD78958",
    slug: "jinko-550w-panel",
    name: "Jinko 550W Panel",
    brand: "Jinko Solar",
    category: "Panels",
    price: "₦260,000",
    discountedPrice: "₦245,000",
    quantity: 36,
    status: "Pending",
    statusTone: toneFromStatus("Pending"),
    summary: "High-output monocrystalline panel for residential and light commercial setups.",
    description:
      "Jinko 550W panels are built for dependable daily generation with improved low-light performance and a durable frame suited for rooftop and ground-mounted systems.",
    sales: 24,
    remaining: 1269,
    image: productAssets.panel,
    gallery: [productAssets.panel, productAssets.battery, productAssets.inverter],
    datasheet: "Jinko-550W-Datasheet.pdf",
    highlights: [
      { label: "Power Output", value: "550W" },
      { label: "Type", value: "Monocrystalline" },
      { label: "Efficiency", value: "21.3%" },
      { label: "Warranty", value: "25 Years" },
      { label: "Brand", value: "Jinko Solar" },
      { label: "Weight", value: "28.5kg" },
    ],
    submittedAt: "Submitted on Apr 15, 2025",
  },
  {
    id: "PRD78959",
    slug: "lithium-battery-15kwh",
    name: "15kWh Lithium Battery",
    brand: "Fortsolar Storage",
    category: "Batteries",
    price: "₦1,480,000",
    discountedPrice: "₦1,420,000",
    quantity: 8,
    status: "Active",
    statusTone: toneFromStatus("Active"),
    summary: "Long-cycle lithium storage bank for solar backup and energy shifting.",
    description:
      "Fortsolar Storage batteries are tuned for daily cycling, efficient power release, and rack-friendly deployment for residential and SME backup systems.",
    sales: 18,
    remaining: 42,
    image: productAssets.battery,
    gallery: [productAssets.battery, productAssets.inverter, productAssets.panel],
    datasheet: "15kWh-Lithium-Datasheet.pdf",
    highlights: [
      { label: "Capacity", value: "15kWh" },
      { label: "Chemistry", value: "LiFePO4" },
      { label: "Cycle Life", value: "6000+" },
      { label: "Warranty", value: "5 Years" },
      { label: "Brand", value: "Fortsolar Storage" },
      { label: "Weight", value: "82kg" },
    ],
    submittedAt: "Submitted on Apr 13, 2025",
  },
  {
    id: "PRD78960",
    slug: "hybrid-package-rack",
    name: "Hybrid Package Rack",
    brand: "Fortsolar Install",
    category: "Accessories",
    price: "₦74,000",
    discountedPrice: "₦68,900",
    quantity: 42,
    status: "Pending",
    statusTone: toneFromStatus("Pending"),
    summary: "Pre-fabricated mounting rack for compact hybrid system builds.",
    description:
      "The Hybrid Package Rack speeds up deployment with pre-aligned supports designed to reduce install time and simplify panel placement on small rooftops.",
    sales: 12,
    remaining: 84,
    image: productAssets.furniture,
    gallery: [productAssets.furniture, productAssets.panel, productAssets.fan],
    datasheet: "Hybrid-Package-Rack.pdf",
    highlights: [
      { label: "Material", value: "Powder Coated Steel" },
      { label: "Panel Capacity", value: "4 Panels" },
      { label: "Finish", value: "Outdoor Grade" },
      { label: "Warranty", value: "1 Year" },
      { label: "Brand", value: "Fortsolar Install" },
      { label: "Weight", value: "12kg" },
    ],
    submittedAt: "Submitted on Apr 9, 2025",
  },
  {
    id: "PRD78961",
    slug: "campus-lite-fan-kit",
    name: "Campus Lite Fan Kit",
    brand: "Fortsolar Lite",
    category: "Packages",
    price: "₦188,000",
    discountedPrice: "₦174,500",
    quantity: 13,
    status: "Active",
    statusTone: toneFromStatus("Active"),
    summary: "Starter fan kit for hostels, kiosks, and compact one-room spaces.",
    description:
      "Campus Lite Fan Kit combines a lightweight panel, entry battery, and compact fan package into a starter setup that works well for student and retail use.",
    sales: 31,
    remaining: 18,
    image: productAssets.bundle,
    gallery: [productAssets.bundle, productAssets.fan, productAssets.panel],
    datasheet: "Campus-Lite-Fan-Kit.pdf",
    highlights: [
      { label: "Power Output", value: "300W" },
      { label: "Battery", value: "2kWh" },
      { label: "Included Fan", value: "1 Unit" },
      { label: "Warranty", value: "2 Years" },
      { label: "Brand", value: "Fortsolar Lite" },
      { label: "Weight", value: "22kg" },
    ],
    submittedAt: "Submitted on Apr 8, 2025",
  },
];

export const bundleMetrics: MetricRecord[] = [
  {
    title: "Total Bundles",
    value: "100,000",
    icon: "bundles",
    spark: [18, 20, 24, 32, 40, 48],
  },
  {
    title: "Pending Review",
    value: "100",
    subtitle: "Bundles awaiting approvals",
    icon: "verification",
    spark: [28, 24, 21, 18, 16, 14],
  },
  {
    title: "Most Sold Bundle",
    value: "Campus 244",
    delta: "+10.4%",
    deltaTone: "success",
    subtitle: "from last month",
    icon: "sales",
    spark: [12, 18, 22, 34, 46, 54],
  },
  {
    title: "Published Bundle",
    value: "15",
    subtitle: "Bundle listings approved",
    icon: "bundles",
    spark: [10, 14, 16, 22, 28, 32],
  },
];

export const bundleRecords: BundleRecord[] = [
  {
    id: "BUN78956",
    slug: "campus-lite-bundle",
    name: "Campus Lite Bundle",
    type: "Lite",
    price: "₦1,234,902",
    status: "Pending",
    statusTone: toneFromStatus("Pending"),
    requests: 52,
    financeEnabled: true,
    summary: "Affordable and efficient solutions tailored to your next compact power setup.",
    overview:
      "This bundle combines dependable power output with durable storage and a balanced inverter profile for apartments, hostels, and small offices with predictable daily demand.",
    image: productAssets.bundle,
    gallery: [productAssets.bundle, productAssets.battery, productAssets.panel],
    datasheet: "Campus-Lite-Bundle.pdf",
    includes: [
      { label: "600W Bifacial Mono Solar Panels", qty: "x4" },
      { label: "12kVA Hybrid Inverter", qty: "x1" },
      { label: "15kWh Lithium Battery", qty: "x4" },
      { label: "Accessories", qty: "Lot" },
    ],
    systemDetails: [
      { label: "Inverter Size", value: "12kVA" },
      { label: "PV Size", value: "12kWp" },
      { label: "Battery Size", value: "15kWh" },
    ],
    powers: ["Laptops", "Table Size Fridge", "TVs", "Standing Fan", "LED Bulbs", "Phones"],
    submittedAt: "Submitted on Apr 15, 2025",
  },
  {
    id: "BUN78957",
    slug: "campus-bundle",
    name: "Campus Bundle",
    type: "Standard",
    price: "₦2,840,000",
    status: "Published",
    statusTone: toneFromStatus("Published"),
    requests: 244,
    financeEnabled: true,
    summary: "Higher-capacity package for student hostels, cafes, and compact office spaces.",
    overview:
      "Campus Bundle is tuned for longer backup hours with a bigger storage bank and stronger panel coverage, making it a good fit for mixed entertainment and work loads.",
    image: productAssets.battery,
    gallery: [productAssets.battery, productAssets.panel, productAssets.inverter],
    datasheet: "Campus-Bundle.pdf",
    includes: [
      { label: "450W Mono Solar Panel", qty: "x8" },
      { label: "200Ah Lithium Battery", qty: "x1" },
      { label: "5kVA Hybrid Inverter", qty: "x2" },
      { label: "Install Pack", qty: "Lot" },
    ],
    systemDetails: [
      { label: "Inverter Size", value: "5kVA" },
      { label: "PV Size", value: "3.6kWp" },
      { label: "Battery Size", value: "10kWh" },
    ],
    powers: ["Lights", "Fans", "Router", "TV", "Laptops", "Phones"],
    submittedAt: "Submitted on Apr 10, 2025",
  },
  {
    id: "BUN78958",
    slug: "home-bundle",
    name: "Home Bundle",
    type: "Premium",
    price: "₦3,980,000",
    status: "Draft",
    statusTone: toneFromStatus("Draft"),
    requests: 18,
    financeEnabled: false,
    summary: "Mid-capacity solar bundle for family homes and uninterrupted evening use.",
    overview:
      "Home Bundle prioritizes home comfort loads with improved battery reserve, stronger inverter overhead, and enough panel headroom for consistent daily charging.",
    image: productAssets.panel,
    gallery: [productAssets.panel, productAssets.bundle, productAssets.battery],
    datasheet: "Home-Bundle.pdf",
    includes: [
      { label: "550W Mono Panel", qty: "x6" },
      { label: "10kWh Lithium Battery", qty: "x2" },
      { label: "8kVA Hybrid Inverter", qty: "x1" },
      { label: "Balance of System", qty: "Lot" },
    ],
    systemDetails: [
      { label: "Inverter Size", value: "8kVA" },
      { label: "PV Size", value: "3.3kWp" },
      { label: "Battery Size", value: "20kWh" },
    ],
    powers: ["Lights", "TV", "Fans", "Freezer", "Laptops", "Washing Machine"],
    submittedAt: "Submitted on Apr 8, 2025",
  },
  {
    id: "BUN78959",
    slug: "starter-bundle",
    name: "Starter Bundle",
    type: "Lite",
    price: "₦880,000",
    status: "Published",
    statusTone: toneFromStatus("Published"),
    requests: 63,
    financeEnabled: false,
    summary: "Small system for kiosks, gatehouses, and first-time solar buyers.",
    overview:
      "Starter Bundle is an efficient entry package for compact daytime loads, ideal when budget, mobility, and simple deployment are the main constraints.",
    image: productAssets.fan,
    gallery: [productAssets.fan, productAssets.panel, productAssets.bundle],
    datasheet: "Starter-Bundle.pdf",
    includes: [
      { label: "300W Panel", qty: "x2" },
      { label: "2kWh Battery", qty: "x1" },
      { label: "1.5kVA Inverter", qty: "x1" },
      { label: "Install Pack", qty: "Lot" },
    ],
    systemDetails: [
      { label: "Inverter Size", value: "1.5kVA" },
      { label: "PV Size", value: "600Wp" },
      { label: "Battery Size", value: "2kWh" },
    ],
    powers: ["Lights", "Router", "Fan", "Phone Charging"],
    submittedAt: "Submitted on Apr 2, 2025",
  },
];

export const notificationMetrics: MetricRecord[] = [
  {
    title: "Total Sent",
    value: "1,262",
    delta: "+10.4%",
    deltaTone: "success",
    subtitle: "from last month",
    icon: "notifications",
    spark: [12, 16, 22, 34, 40, 52],
  },
  {
    title: "Open Rate",
    value: "68.5%",
    delta: "+10.4%",
    deltaTone: "success",
    subtitle: "from last month",
    icon: "retention",
    spark: [16, 18, 24, 30, 36, 44],
  },
  {
    title: "Scheduled",
    value: "12",
    subtitle: "Upcoming notifications",
    icon: "calendar",
    spark: [10, 14, 16, 18, 22, 26],
  },
];

export const notificationRecipients = [
  "All Users",
  "All Buyers",
  "All Installers",
  "All Admins",
  "Selected Installers (45)",
  "Selected Buyers (1,210)",
] as const;

export const notificationTriggerEvents = [
  "New User",
  "New Order Placed",
  "Payout Released",
  "Installation Complete",
  "Listing Approved",
  "App Anniversary",
] as const;

export const notificationTypeOptions = ["Scheduled", "Triggered"] as const;

export const notificationDrafts: NotificationManagementRecord[] = [
  {
    id: "NDF-101",
    kind: "Scheduled",
    tab: "Draft",
    title: "Upcoming Feature Preview",
    content: "Preview the new installer dashboard update before it goes live.",
    recipients: "All Installers",
    scheduledDate: "Jan 12, 2025",
    scheduledTime: "9:00 AM",
    createdAt: "Jan 12, 2025",
    updatedAt: "Jan 12, 2025",
    totalClicks: 0,
    status: "Draft",
    statusTone: toneFromStatus("Draft"),
  },
  {
    id: "NDF-102",
    kind: "Triggered",
    tab: "Draft",
    title: "Upcoming Feature Preview",
    content: "Send a quick note whenever new installers complete setup.",
    recipients: "All Installers",
    triggerEvent: "New User",
    createdAt: "Jan 12, 2025",
    updatedAt: "Jan 12, 2025",
    totalClicks: 0,
    status: "Draft",
    statusTone: toneFromStatus("Draft"),
  },
  {
    id: "NDF-103",
    kind: "Scheduled",
    tab: "Draft",
    title: "Customer Satisfaction Survey",
    content: "Help us improve by taking this quick satisfaction survey.",
    recipients: "All Buyers",
    scheduledDate: "Jan 12, 2025",
    scheduledTime: "9:00 AM",
    createdAt: "Jan 12, 2025",
    updatedAt: "Jan 12, 2025",
    totalClicks: 0,
    status: "Draft",
    statusTone: toneFromStatus("Draft"),
  },
];

export const notificationRecords: NotificationManagementRecord[] = [
  {
    id: "NSC-101",
    kind: "Scheduled",
    tab: "Scheduled",
    title: "New Feature Announcement",
    content: "A new feature is now live across the Fortsolar marketplace.",
    recipients: "All Installers",
    scheduledDate: "Jan 12, 2025",
    scheduledTime: "9:00 AM",
    frequency: "No Repeat",
    createdAt: "Jan 12, 2025",
    updatedAt: "Jan 12, 2025",
    totalClicks: 22,
    status: "Sent",
    statusTone: toneFromStatus("Sent"),
  },
  {
    id: "NSC-102",
    kind: "Scheduled",
    tab: "Scheduled",
    title: "Spring Sale Promotion",
    content: "Seasonal discounts are available for selected solar products.",
    recipients: "All Buyers",
    scheduledDate: "Jan 12, 2025",
    scheduledTime: "9:00 AM",
    frequency: "No Repeat",
    createdAt: "Jan 12, 2025",
    updatedAt: "Jan 12, 2025",
    totalClicks: 862,
    status: "Pending",
    statusTone: toneFromStatus("Pending"),
  },
  {
    id: "NSC-103",
    kind: "Scheduled",
    tab: "Scheduled",
    title: "Shipping Policy Update",
    content: "We have refreshed our delivery and handling timelines.",
    recipients: "Selected Installers (45)",
    scheduledDate: "Jan 12, 2025",
    scheduledTime: "9:00 AM",
    frequency: "No Repeat",
    createdAt: "Jan 12, 2025",
    updatedAt: "Jan 12, 2025",
    totalClicks: 862,
    status: "Paused",
    statusTone: toneFromStatus("Paused"),
  },
  {
    id: "NSC-104",
    kind: "Scheduled",
    tab: "Scheduled",
    title: "Platform Maintenance Notice",
    content: "The platform will go on maintenance in the next few days.",
    recipients: "All Installers & Buyers",
    scheduledDate: "May 10, 2025",
    scheduledTime: "9:00 AM",
    frequency: "No Repeat",
    createdAt: "Jan 12, 2025",
    updatedAt: "Jan 12, 2025",
    totalClicks: 862,
    status: "Sent",
    statusTone: toneFromStatus("Sent"),
  },
  {
    id: "NSC-105",
    kind: "Scheduled",
    tab: "Scheduled",
    title: "Summer Collection Preview",
    content: "Take an early look at the next collection and best-selling kits.",
    recipients: "Selected Buyers (1,210)",
    scheduledDate: "Jan 12, 2025",
    scheduledTime: "9:00 AM",
    frequency: "Weekly",
    createdAt: "Jan 12, 2025",
    updatedAt: "Jan 12, 2025",
    totalClicks: 862,
    status: "Pending",
    statusTone: toneFromStatus("Pending"),
  },
  {
    id: "NTR-201",
    kind: "Triggered",
    tab: "Triggered",
    title: "Welcome to Fortsolar",
    content: "Thanks for joining Fortsolar. Here is what you can do next.",
    recipients: "All Users",
    triggerEvent: "New User",
    createdAt: "Jan 12, 2025",
    updatedAt: "Jan 12, 2025",
    totalClicks: 100,
    status: "Pending",
    statusTone: toneFromStatus("Pending"),
  },
  {
    id: "NTR-202",
    kind: "Triggered",
    tab: "Triggered",
    title: "Payout Released",
    content: "Your payout has been processed and is on the way.",
    recipients: "All Installers",
    triggerEvent: "Payout Released",
    createdAt: "Jan 12, 2025",
    updatedAt: "Jan 12, 2025",
    totalClicks: 100,
    status: "Sent",
    statusTone: toneFromStatus("Sent"),
  },
  {
    id: "NTR-203",
    kind: "Triggered",
    tab: "Triggered",
    title: "New Job Alert",
    content: "A new installation job is now available for assignment.",
    recipients: "Selected Installers (45)",
    triggerEvent: "Installation Complete",
    createdAt: "Jan 12, 2025",
    updatedAt: "Jan 12, 2025",
    totalClicks: 0,
    status: "Draft",
    statusTone: toneFromStatus("Draft"),
  },
  {
    id: "NTR-204",
    kind: "Triggered",
    tab: "Triggered",
    title: "Product Approved",
    content: "Your product listing has passed moderation and is now live.",
    recipients: "All Users",
    triggerEvent: "Listing Approved",
    createdAt: "Jan 12, 2025",
    updatedAt: "Jan 12, 2025",
    totalClicks: 100,
    status: "Sent",
    statusTone: toneFromStatus("Sent"),
  },
  {
    id: "NTR-205",
    kind: "Triggered",
    tab: "Triggered",
    title: "Installation Complete",
    content: "Your installation has been completed. Share feedback with us.",
    recipients: "All Buyers",
    triggerEvent: "Installation Complete",
    createdAt: "Jan 12, 2025",
    updatedAt: "Jan 12, 2025",
    totalClicks: 100,
    status: "Paused",
    statusTone: toneFromStatus("Paused"),
  },
];

export function getProductBySlug(slug: string) {
  return productRecords.find((product) => product.slug === slug) ?? null;
}

export function getBundleBySlug(slug: string) {
  return bundleRecords.find((bundle) => bundle.slug === slug) ?? null;
}

export function formatNotificationSchedule(record: NotificationManagementRecord) {
  if (record.kind === "Scheduled") {
    return `${record.scheduledDate ?? "TBD"} · ${record.scheduledTime ?? "TBD"}`;
  }

  return record.triggerEvent ?? "Event not configured";
}
