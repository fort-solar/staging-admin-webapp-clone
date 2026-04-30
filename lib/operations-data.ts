import { avatarAssets, productAssets, toneFromStatus, type MetricRecord, type Tone } from "@/lib/dashboard-data";

export type TransactionRecord = {
  id: string;
  buyer: string;
  email: string;
  phone: string;
  address: string;
  product: string;
  image: string;
  date: string;
  amount: string;
  method: string;
  status: "Pending" | "Completed";
  statusTone: Tone;
  items: Array<{ label: string; amount: string; image?: string }>;
};

export type PayoutRecord = {
  id: string;
  installer: string;
  date: string;
  amount: string;
  status: "Pending" | "Sent";
  statusTone: Tone;
  accountNumber: string;
  bank: string;
};

export type ContentStatus = "Published" | "Draft";

export type BlogPostRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  createdAt: string;
  readTime: string;
  views: string;
  updatedAt: string;
  status: ContentStatus;
  statusTone: Tone;
  image: string;
  body: string;
};

export type SitePageRecord = {
  id: string;
  slug: string;
  title: string;
  pageType: string;
  seoTitle: string;
  metaDescription: string;
  updatedAt: string;
  status: ContentStatus;
  statusTone: Tone;
  seoScore: number;
  sections: number;
};

export type InstallationRecord = {
  id: string;
  slug: string;
  title: string;
  overview: string;
  date: string;
  location: string;
  views: number;
  image: string;
  gallery: string[];
  category: string;
};

export type QuoteRequestRecord = {
  id: string;
  customer: string;
  email: string;
  phone: string;
  location: string;
  address: string;
  date: string;
  status: "Pending" | "Quoted" | "Closed";
  statusTone: Tone;
  appliances: string[];
  calculations: Array<{ label: string; value: string }>;
};

export type ApplianceRecord = {
  id: string;
  name: string;
  wattage: string;
};

export type JobStatus = "Open" | "Assigned" | "In Progress" | "Completed" | "Verified";

export type JobRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  address: string;
  budget: string;
  type: string;
  difficulty: string;
  duration: string;
  status: JobStatus;
  assigned: boolean;
  applications: number;
  scope: string[];
  components: string[];
  requirements: string[];
  siteConditions: string[];
};

export type JobApplicantRecord = {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar: string;
  experience: "Beginner" | "Intermediate" | "Expert";
  rating: number;
  location: string;
  finishedJobs: number;
  note: string;
};

export const transactionMetrics: MetricRecord[] = [
  { title: "Total Revenue", value: "₦71.24M", delta: "+10.4%", deltaTone: "success", subtitle: "from last month", icon: "products", spark: [18, 24, 30, 42, 50, 62] },
  { title: "Total Transactions", value: "500", delta: "+10.4%", deltaTone: "warning", subtitle: "from last month", icon: "calendar", spark: [12, 18, 24, 28, 34, 42] },
  { title: "Total Payout", value: "244", subtitle: "To Installers", icon: "verification", spark: [10, 16, 20, 26, 30, 34] },
  { title: "Average Order Value", value: "₦142,000", delta: "+10.4%", deltaTone: "success", subtitle: "from last month", icon: "sales", spark: [16, 20, 26, 34, 44, 54] },
];

export const transactionRecords: TransactionRecord[] = [
  {
    id: "TXN-82739",
    buyer: "Harrison Ford",
    email: "harrison.ford@example.com",
    phone: "+1 000 567 3456",
    address: "Rivers State",
    product: "JWT25 Solar Panel",
    image: productAssets.panel,
    date: "01 Apr | 12:30 pm",
    amount: "₦154,000",
    method: "Paystack",
    status: "Pending",
    statusTone: toneFromStatus("Pending"),
    items: [
      { label: "Battery", amount: "₦60.00", image: productAssets.battery },
      { label: "JWCo Panels", amount: "₦30.00", image: productAssets.panel },
    ],
  },
  {
    id: "TXN-82740",
    buyer: "Emily Snow",
    email: "emily.snow@example.com",
    phone: "+234 901 262 188",
    address: "Lagos",
    product: "23 In Lithium Battery",
    image: productAssets.battery,
    date: "01 Apr | 12:30 pm",
    amount: "₦254,000",
    method: "Opay",
    status: "Pending",
    statusTone: toneFromStatus("Pending"),
    items: [
      { label: "Lithium Battery", amount: "₦160.00", image: productAssets.battery },
      { label: "Install Pack", amount: "₦45.00", image: productAssets.bundle },
    ],
  },
  {
    id: "TXN-82741",
    buyer: "Gerald Smith",
    email: "gerald.smith@example.com",
    phone: "+234 700 111 2222",
    address: "Abuja",
    product: "JWT25 Solar Panel inverter",
    image: productAssets.inverter,
    date: "01 Apr | 12:30 pm",
    amount: "₦54,000",
    method: "Bank Transfer",
    status: "Pending",
    statusTone: toneFromStatus("Pending"),
    items: [
      { label: "Inverter", amount: "₦45.00", image: productAssets.inverter },
      { label: "Cable Pack", amount: "₦9.00", image: productAssets.bundle },
    ],
  },
  {
    id: "TXN-82742",
    buyer: "Ify Somto",
    email: "ify.somto@example.com",
    phone: "+234 802 555 9000",
    address: "Port Harcourt",
    product: "JWT25 Solar Panel",
    image: productAssets.panel,
    date: "01 Apr | 12:30 pm",
    amount: "₦54,000",
    method: "Flutterwave",
    status: "Completed",
    statusTone: toneFromStatus("Completed"),
    items: [
      { label: "Solar Panel", amount: "₦50.00", image: productAssets.panel },
      { label: "Discount", amount: "-₦4.20" },
    ],  
  },
];

export const payoutRecords: PayoutRecord[] = [
  { id: "REF-82739", installer: "Harrison Ford", date: "01 Apr 2025 | 12:30 pm", amount: "₦154,000", status: "Pending", statusTone: toneFromStatus("Pending"), accountNumber: "5089595019", bank: "FCMB" },
  { id: "REF-82740", installer: "Emily Snow", date: "01 Apr 2025 | 12:30 pm", amount: "₦254,000", status: "Pending", statusTone: toneFromStatus("Pending"), accountNumber: "5089595019", bank: "FCMB" },
  { id: "REF-82741", installer: "Ify Somto", date: "01 Apr 2025 | 12:30 pm", amount: "₦54,000", status: "Sent", statusTone: toneFromStatus("Sent"), accountNumber: "5089595019", bank: "FCMB" },
  { id: "REF-82742", installer: "Gerald Smith", date: "01 Apr 2025 | 12:30 pm", amount: "₦54,000", status: "Pending", statusTone: toneFromStatus("Pending"), accountNumber: "5089595019", bank: "FCMB" },
  { id: "REF-82743", installer: "Ify Somto", date: "01 Apr 2025 | 12:30 pm", amount: "₦54,000", status: "Sent", statusTone: toneFromStatus("Sent"), accountNumber: "5089595019", bank: "FCMB" },
];

export const contentMetrics: MetricRecord[] = [
  { title: "Total Posts", value: "1,500", icon: "products", spark: [14, 18, 22, 28, 32, 36] },
  { title: "Published Posts", value: "100", icon: "verification", spark: [18, 22, 28, 32, 40, 46] },
  { title: "Drafts", value: "244", icon: "verification", spark: [12, 18, 20, 25, 28, 31] },
  { title: "Total Views", value: "80,000", delta: "+10.4%", deltaTone: "success", subtitle: "from last month", icon: "bundles", spark: [22, 24, 28, 36, 44, 52] },
];

export const blogPosts: BlogPostRecord[] = [
  {
    id: "BLOG-101",
    slug: "solar-energy-saves-money",
    title: "How Solar Energy Can Save You Money Every Month",
    summary: "Electricity costs keep rising, but solar power offers a sustainable and cost-effective solution for homes and businesses.",
    category: "Panels",
    createdAt: "11 Nov, 2025",
    readTime: "5 min Read",
    views: "233",
    updatedAt: "2 Nov, 2024",
    status: "Published",
    statusTone: toneFromStatus("Published"),
    image: productAssets.panel,
    body: "(H2) Introduction:\nPower offers a sustainable and cost-effective solution. Discover why there is no better time to invest in solar energy.",
  },
  {
    id: "BLOG-102",
    slug: "choosing-lithium-batteries",
    title: "Choosing the Right Lithium Battery for Backup Power",
    summary: "A practical guide to battery sizing, cycle life, and backup expectations for Nigerian homes.",
    category: "Batteries",
    createdAt: "11 Nov, 2025",
    readTime: "5 min Read",
    views: "--",
    updatedAt: "2 Nov, 2024",
    status: "Draft",
    statusTone: toneFromStatus("Draft"),
    image: productAssets.battery,
    body: "Draft article body for lithium batteries and residential solar backup planning.",
  },
  {
    id: "BLOG-103",
    slug: "hybrid-inverter-guide",
    title: "Hybrid Inverter Basics for First-Time Solar Buyers",
    summary: "Understand what hybrid inverters do, how they switch power sources, and how to choose capacity.",
    category: "Inverters",
    createdAt: "11 Nov, 2025",
    readTime: "5 min Read",
    views: "233",
    updatedAt: "2 Nov, 2024",
    status: "Published",
    statusTone: toneFromStatus("Published"),
    image: productAssets.inverter,
    body: "A beginner-friendly explanation of hybrid inverter sizing, charging, and output planning.",
  },
];

export const sitePages: SitePageRecord[] = [
  { id: "PAGE-101", slug: "home", title: "Homepage", pageType: "Marketing", seoTitle: "Fortsolar - Clean Solar Power for Homes and Businesses", metaDescription: "Explore solar bundles, installation support, and energy audit tools from Fortsolar.", updatedAt: "2 Nov, 2024", status: "Published", statusTone: toneFromStatus("Published"), seoScore: 92, sections: 8 },
  { id: "PAGE-102", slug: "about-us", title: "About Us", pageType: "Main Page", seoTitle: "About Fortsolar", metaDescription: "Learn about Fortsolar's mission to make reliable solar power easier to access.", updatedAt: "2 Nov, 2024", status: "Draft", statusTone: toneFromStatus("Draft"), seoScore: 76, sections: 5 },
  { id: "PAGE-103", slug: "installer-signup", title: "Installer Signup", pageType: "Landing Page", seoTitle: "Join Fortsolar as a Verified Installer", metaDescription: "Apply to become a verified Fortsolar installation partner.", updatedAt: "2 Nov, 2024", status: "Published", statusTone: toneFromStatus("Published"), seoScore: 88, sections: 6 },
];

export const installationMetrics: MetricRecord[] = [
  { title: "Total Installations", value: "1,500", icon: "products", spark: [14, 18, 22, 28, 36, 42] },
  { title: "Most Installed", value: "Campus Bundle", icon: "verification", spark: [18, 24, 30, 38, 46, 54] },
  { title: "Total Views", value: "80,000", delta: "+10.4%", deltaTone: "success", subtitle: "from last month", icon: "bundles", spark: [18, 22, 30, 38, 44, 52] },
];

export const installations: InstallationRecord[] = [
  { id: "INS-101", slug: "10kva-commercial-solar-installation", title: "10kVA Commercial Solar Installation", overview: "A mid-size corporate office in Ikeja now runs 24/7 on solar, cutting diesel costs by over 70%.", date: "Jan 2024", location: "Port Harcourt", views: 3200, image: productAssets.panel, gallery: [productAssets.panel, productAssets.inverter, productAssets.battery], category: "Commercial" },
  { id: "INS-102", slug: "5kva-hybrid-port-harcourt", title: "5kVA Hybrid Solar System - Port Harcourt", overview: "Installed for a family home in Port Harcourt, this hybrid system ensures steady day and night power.", date: "Jan 2024", location: "Port Harcourt", views: 2800, image: productAssets.bundle, gallery: [productAssets.bundle, productAssets.panel, productAssets.battery], category: "Residential" },
  { id: "INS-103", slug: "campus-bundle-hostel", title: "Campus Bundle Hostel Installation", overview: "A student housing block now supports core appliances with a compact solar bundle.", date: "Jan 2024", location: "Port Harcourt", views: 2200, image: productAssets.inverter, gallery: [productAssets.inverter, productAssets.panel, productAssets.battery], category: "Education" },
];

export const quoteRequests: QuoteRequestRecord[] = [
  { id: "QTE-101", customer: "Cameron Williamson", email: "bill.sanders@example.com", phone: "+234 901 262 188", location: "West African Time", address: "4517 Washington Ave. Manchester, Kentucky 39495", date: "01 Apr 2025 | 12:30 pm", status: "Pending", statusTone: toneFromStatus("Pending"), appliances: ["Laptop", "Phones", "Freezer", "Freezer", "wedfghjk"], calculations: [{ label: "Total Load", value: "2.3kW" }, { label: "Total Watt Hours/day", value: "200Wh" }, { label: "Daily Usage", value: "4.77 kWh/day" }, { label: "Monthly Usage", value: "143.1 kWh" }] },
  { id: "QTE-102", customer: "Guy Hawkins", email: "deanna.curtis@example.com", phone: "+234 901 262 188", location: "Lagos", address: "18 Providence Street, Lagos", date: "01 Apr 2025 | 12:30 pm", status: "Quoted", statusTone: toneFromStatus("Quoted"), appliances: ["Laptop", "Phones", "Freezer"], calculations: [{ label: "Total Load", value: "2.3kW" }, { label: "Total Watt Hours/day", value: "200Wh" }, { label: "Daily Usage", value: "4.77 kWh/day" }, { label: "Monthly Usage", value: "143.1 kWh" }] },
  { id: "QTE-103", customer: "Dianne Russell", email: "nathan.roberts@example.com", phone: "+234 901 262 188", location: "Abuja", address: "24 Ring Road, Abuja", date: "01 Apr 2025 | 12:30 pm", status: "Closed", statusTone: toneFromStatus("Closed"), appliances: ["Laptop", "Phones", "Freezer"], calculations: [{ label: "Total Load", value: "2.3kW" }, { label: "Total Watt Hours/day", value: "200Wh" }, { label: "Daily Usage", value: "4.77 kWh/day" }, { label: "Monthly Usage", value: "143.1 kWh" }] },
];

export const appliances: ApplianceRecord[] = [
  { id: "APL-101", name: "Laptops", wattage: "90.0" },
  { id: "APL-102", name: "Phones", wattage: "25.0" },
  { id: "APL-103", name: "Freezer", wattage: "350.0" },
  { id: "APL-104", name: "Television", wattage: "120.0" },
  { id: "APL-105", name: "Microwave", wattage: "900.0" },
];

export const jobMetrics: MetricRecord[] = [
  { title: "Total Jobs Posted", value: "244", icon: "products", spark: [12, 16, 22, 30, 34, 40] },
  { title: "Total Jobs Assigned", value: "244", icon: "calendar", spark: [18, 20, 24, 26, 34, 38] },
  { title: "Pending Applications", value: "244", icon: "verification", spark: [10, 14, 18, 22, 26, 30] },
  { title: "Completed Installations", value: "188", icon: "sales", spark: [16, 18, 24, 32, 42, 48] },
];

export const jobs: JobRecord[] = [
  { id: "JOB-101", slug: "3kva-solar-inverter-aa1-installation", title: "3kVA Solar/ Inverter AA1 Installation", description: "Mattis et ut condimentum ac. Nunc in tristique tempor mi auctor etiam maecenas iaculis.", location: "Port Harcourt", address: "4517 Washington Ave. Manchester, Kentucky 39495", budget: "₦271,000", type: "New Installation", difficulty: "Standard", duration: "6 - 8 Hrs", status: "Open", assigned: false, applications: 188, scope: ["Inverter Installation of 1x 5kVA Hybrid Inverter (Wall-mounted)."], components: ["600W Jwinco Solar Panels (4 units)."], requirements: ["Must possess valid FortSolar Installer ID."], siteConditions: ["Building Type: 2-Storey Duplex."] },
  { id: "JOB-102", slug: "campus-bundle-installation", title: "Campus Bundle Installation", description: "Compact bundle install for a student housing facility with structured handover.", location: "Lagos", address: "24 Odum Street, Lagos", budget: "₦71.24M", type: "New Installation", difficulty: "Standard", duration: "6 - 8 Hrs", status: "Assigned", assigned: true, applications: 22, scope: ["Install campus bundle and validate inverter output."], components: ["Campus bundle kit", "Lithium battery bank"], requirements: ["Installer must have residential bundle experience."], siteConditions: ["Roof access available."] },
  { id: "JOB-103", slug: "commercial-panel-upgrade", title: "Commercial Panel Upgrade", description: "Panel upgrade for a business site with existing battery bank.", location: "Abuja", address: "15 Central Business District, Abuja", budget: "₦1.24M", type: "Upgrade", difficulty: "Intermediate", duration: "1 Day", status: "In Progress", assigned: true, applications: 15, scope: ["Replace panels and test generation output."], components: ["550W Solar Panels", "Mounting rails"], requirements: ["Commercial installation history required."], siteConditions: ["Flat roof with secure access."] },
];

export const jobApplicants: JobApplicantRecord[] = [
  { id: "APP-101", name: "Cameron Williamson", phone: "+234 901 262 188", email: "bill.sanders@example.com", avatar: avatarAssets.john, experience: "Beginner", rating: 4, location: "Port Harcourt\n4517 Washington Ave. Manchester, Kentucky 39495", finishedJobs: 15, note: "These are the responsibilities that can be carried out by this user role." },
  { id: "APP-102", name: "Wade Warren", phone: "+234 809 062 0576", email: "jackson.graham@example.com", avatar: avatarAssets.wade, experience: "Intermediate", rating: 4, location: "Port Harcourt\n4517 Washington Ave. Manchester, Kentucky 39495", finishedJobs: 15, note: "Available this week and familiar with hybrid inverter installs." },
  { id: "APP-103", name: "Sarah Johnson", phone: "+234 700 222 0000", email: "sarah@example.com", avatar: avatarAssets.sarah, experience: "Expert", rating: 5, location: "Port Harcourt\n4517 Washington Ave. Manchester, Kentucky 39495", finishedJobs: 42, note: "Can handle audit, install, and post-install testing." },
];

export function getBlogPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug) ?? null;
}

export function getSitePageBySlug(slug: string) {
  return sitePages.find((page) => page.slug === slug) ?? null;
}

export function getQuoteRequestById(id: string) {
  return quoteRequests.find((request) => request.id.toLowerCase() === id.toLowerCase()) ?? null;
}

export function getJobBySlug(slug: string) {
  return jobs.find((job) => job.slug === slug) ?? null;
}
