import type { AdminRole, UserRole } from "@/types/common.types";

export type ApiErrorResponse = {
  success: false;
  error?: string;
  message?: string;
};

export type ApiSuccessResponse = {
  success: true;
  message?: string;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ApiDataResponse<T> = ApiSuccessResponse & {
  data: T;
};

export type ApiCollectionResponse<T> = ApiSuccessResponse & {
  data: T[];
  pagination: PaginationMeta;
};

export type AdminSession = {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  adminRole: AdminRole;
  signedInAt: string;
};

export type ManagedUserRecord = {
  id: string;
  email: string;
  name: string;
  fullName: string;
  phone?: string | null;
  address?: string | null;
  role: UserRole;
  status: string;
  avatar_url: string | null;
  emailVerified: boolean;
  adminRole?: AdminRole | null;
  createdAt?: string;
  created_at?: string;
};

export type AdminUser = ManagedUserRecord & {
  phone: string | null;
  address: string | null;
  adminRole: AdminRole;
};

export type LoginApiResponse = ApiSuccessResponse & {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  session: AdminSession;
  user: AdminUser;
};

export type RefreshTokenApiResponse = ApiSuccessResponse & {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  session: AdminSession;
  user: AdminUser;
};

export type LogoutApiResponse = ApiSuccessResponse;

export type AdminMeApiResponse = ApiSuccessResponse & {
  session: AdminSession;
  user: AdminUser;
  permissions: string[];
};

export type DashboardOverview = {
  users: {
    total: number;
    active: number;
    new: number;
  };
  quotes: {
    total: number;
    pending: number;
    converted: number;
  };
  contacts: {
    total: number;
    unread: number;
  };
  installations: {
    total: number;
    completed: number;
    inProgress: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
  };
  orders: {
    total: number;
    byStatus: {
      pending: number;
      processing: number;
      completed: number;
      cancelled: number;
    };
  };
  bundleRequests: {
    pending: number;
  };
  installerVerifications: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
  jobs: {
    total: number;
    open: number;
  };
  quoteRequests: {
    total: number;
    new: number;
  };
  transactions: {
    total: number;
    pending: number;
    completed: number;
  };
  charts: {
    bucket: string;
    days: number;
    since: string;
    until: string;
    ordersCreated: DashboardChartPoint[];
    quoteRequestsCreated: DashboardChartPoint[];
    bundleRequestsCreated: DashboardChartPoint[];
    revenueCompleted: DashboardChartPoint[];
    newUsers: DashboardChartPoint[];
    newInstallers: DashboardChartPoint[];
    newCustomers: DashboardChartPoint[];
    contactMessages: DashboardChartPoint[];
    verificationsSubmitted: DashboardChartPoint[];
  };
  ui: {
    primaryMetrics: DashboardMetricRecord[];
    secondaryMetrics: DashboardMetricRecord[];
    revenueByPeriod: DashboardRevenueByPeriod;
  };
};

export type DashboardOverviewApiResponse = ApiDataResponse<DashboardOverview>;

export type DashboardChartPoint = {
  date: string;
  value: number;
};

export type DashboardMetricRecord = {
  title: string;
  value: string;
  subtitle?: string;
  period?: string;
  icon: string;
  spark: number[];
};

export type DashboardRevenueChartRecord = {
  labels: string[];
  values: number[];
  tooltipIndex: number;
  tooltipLabel: string;
  tooltipValue: string;
};

export type DashboardRevenueByPeriod = {
  all: DashboardRevenueChartRecord;
  weekly: DashboardRevenueChartRecord;
  monthly: DashboardRevenueChartRecord;
  yearly: DashboardRevenueChartRecord;
};

export type CustomerRecord = ManagedUserRecord;
export type CustomerListApiResponse = ApiCollectionResponse<CustomerRecord>;
export type CustomerDetailApiResponse = ApiDataResponse<CustomerRecord>;
export type CreateCustomerRequest = {
  email: string;
  password: string;
  name: string;
  phone: string;
  address: string;
};
export type UpdateCustomerRequest = {
  name: string;
  phone: string;
  address: string;
  status: string;
};

export type InstallerProfileRecord = {
  id: string;
  companyName: string | null;
  experienceYears: number | null;
  availabilityStatus: string | null;
  rating: number | null;
  totalJobsCompleted: number | null;
  city: string | null;
  state: string | null;
};

export type InstallerRecord = {
  user: ManagedUserRecord;
  installerProfile: InstallerProfileRecord;
};

export type InstallerListApiResponse = ApiCollectionResponse<InstallerRecord>;
export type InstallerDetailApiResponse = ApiDataResponse<InstallerRecord>;
export type UpdateInstallerRequest = {
  name: string;
  phone: string;
  address: string;
  status: string;
};

export type AdminRecord = ManagedUserRecord & {
  adminRole: AdminRole | (string & {});
};

export type AdminListApiResponse = ApiCollectionResponse<AdminRecord>;
export type AdminDetailApiResponse = ApiDataResponse<AdminRecord>;
export type CreateAdminRequest = {
  email: string;
  password: string;
  name: string;
  phone: string;
  address: string;
  adminRole: AdminRole | (string & {});
};

export type UpdateAdminRequest = Partial<{
  email: string;
  password: string;
  name: string;
  phone: string;
  address: string;
  adminRole: AdminRole | (string & {});
  status: string;
}>;

export type ProductPanelRecord = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category_id?: string | null;
  category_name?: string | null;
  wattage: number;
  efficiency: number;
  voltage: number;
  dimensions: string;
  weight_kg: number;
  price: number;
  stock_quantity: number;
  image: string;
  image_url?: string | null;
  datasheet_url?: string | null;
  overview?: string | null;
  section_values?: ProductSectionValueRecord[];
  specifications: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductPanelListApiResponse = ApiCollectionResponse<ProductPanelRecord>;
export type ProductPanelDetailApiResponse = ApiDataResponse<ProductPanelRecord>;
export type CreateProductPanelRequest = {
  name: string;
  brand: string;
  wattage: number;
  efficiency: number;
  voltage: number;
  dimensions: string;
  weight_kg: number;
  price: number;
  stock_quantity: number;
  image: string;
  specifications: Record<string, unknown>;
  is_active: boolean;
};
export type UpdateProductPanelRequest = Partial<CreateProductPanelRequest>;

export type ProductInverterRecord = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category_id?: string | null;
  category_name?: string | null;
  type: string;
  capacity_kva: number;
  efficiency: number;
  voltage_range: string;
  price: number;
  stock_quantity: number;
  image: string;
  image_url?: string | null;
  datasheet_url?: string | null;
  overview?: string | null;
  section_values?: ProductSectionValueRecord[];
  specifications: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductInverterListApiResponse = ApiCollectionResponse<ProductInverterRecord>;
export type ProductInverterDetailApiResponse = ApiDataResponse<ProductInverterRecord>;
export type CreateProductInverterRequest = {
  name: string;
  brand: string;
  type: string;
  capacity_kva: number;
  efficiency: number;
  voltage_range: string;
  price: number;
  stock_quantity: number;
  image: string;
  specifications: Record<string, unknown>;
  is_active: boolean;
};
export type UpdateProductInverterRequest = Partial<CreateProductInverterRequest>;

export type ProductBatteryRecord = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category_id?: string | null;
  category_name?: string | null;
  capacity_ah: number;
  voltage: number;
  type: string;
  cycle_life: number;
  price: number;
  stock_quantity: number;
  image: string;
  image_url?: string | null;
  datasheet_url?: string | null;
  overview?: string | null;
  section_values?: ProductSectionValueRecord[];
  specifications: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductBatteryListApiResponse = ApiCollectionResponse<ProductBatteryRecord>;
export type ProductBatteryDetailApiResponse = ApiDataResponse<ProductBatteryRecord>;
export type CreateProductBatteryRequest = {
  name: string;
  brand: string;
  capacity_ah: number;
  voltage: number;
  type: string;
  cycle_life: number;
  price: number;
  stock_quantity: number;
  image: string;
  specifications: Record<string, unknown>;
  is_active: boolean;
};
export type UpdateProductBatteryRequest = Partial<CreateProductBatteryRequest>;

export type ProductCategoryApiRecord = {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  image_url?: string | null;
  sections?: ProductCategorySectionRecord[];
  requires_datasheet?: boolean;
  requires_product_image?: boolean;
  created_at: string;
  updated_at?: string;
};

export type ProductCategoryListApiResponse = ApiCollectionResponse<ProductCategoryApiRecord>;
export type ProductCategoryDetailApiResponse = ApiDataResponse<ProductCategoryApiRecord>;
export type CreateProductCategoryRequest = {
  name: string;
  description?: string;
  image?: string;
  sections: ProductCategorySectionRecord[];
  requires_datasheet: boolean;
  requires_product_image: boolean;
};
export type UpdateProductCategoryRequest = Partial<CreateProductCategoryRequest>;

export type PackageRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category_id: string | null;
  system_size_kw: number;
  price: number;
  number_of_panels: number;
  panel_type: string;
  inverter_type: string;
  battery_included: boolean;
  warranty_years: number;
  estimated_savings_monthly: number | null;
  payback_period_years: number | null;
  image: string | null;
  image_url: string | null;
  thumbnail_url?: string | null;
  package_image_url?: string | null;
  overview?: string | null;
  discount_percentage?: number | null;
  solar_finance_enabled?: boolean;
  items?: PackageProductItemRecord[];
  what_it_powers?: string[];
  system_details?: PackageSystemDetailsRecord | null;
  datasheets?: ManagedMediaAsset[];
  product_images?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PackageListApiResponse = ApiCollectionResponse<PackageRecord>;
export type CreatePackageRequest = {
  slug?: string;
  name: string;
  description?: string;
  overview?: string;
  category_id?: string | null;
  system_size_kw?: number;
  price: number;
  number_of_panels?: number;
  panel_type?: string;
  inverter_type?: string;
  battery_included?: boolean;
  warranty_years?: number;
  estimated_savings_monthly?: number;
  payback_period_years?: number;
  discount_percentage?: number;
  solar_finance_enabled?: boolean;
  items?: PackageProductItemRecord[];
  what_it_powers?: string[];
  system_details?: PackageSystemDetailsRecord;
  thumbnail?: string;
  image?: string;
  image_url?: string;
  thumbnail_url?: string;
  package_image_url?: string;
  is_active: boolean;
};
export type UpdatePackageRequest = Partial<CreatePackageRequest>;

export type ManagedMediaAsset = {
  id?: string;
  name: string;
  url: string;
  mime_type?: string | null;
  kind?: "image" | "pdf" | "file" | (string & {});
};

export type ProductCategorySectionRecord = {
  id?: string;
  key?: string;
  name: string;
  position?: number;
};

export type ProductSectionValueRecord = {
  id?: string;
  section_id?: string | null;
  key?: string;
  section_name: string;
  value: string;
  unit?: string | null;
};

export type AdminProductRecord = {
  id: string;
  slug: string;
  name: string;
  category_id: string | null;
  category?: ProductCategoryApiRecord | null;
  price: number;
  stock_quantity: number;
  overview?: string | null;
  section_values: ProductSectionValueRecord[];
  product_image_url?: string | null;
  image_url?: string | null;
  image?: string | null;
  datasheet_url?: string | null;
  datasheet?: ManagedMediaAsset | null;
  media?: {
    image_url?: string | null;
    image_urls?: string[];
    datasheets?: ManagedMediaAsset[];
  };
  specifications: Record<string, unknown>;
  is_active: boolean;
  status?: string;
  created_at: string;
  updated_at: string;
};

export type AdminProductListApiResponse = ApiCollectionResponse<AdminProductRecord>;
export type AdminProductDetailApiResponse = ApiDataResponse<AdminProductRecord>;
export type CreateAdminProductRequest = {
  name: string;
  category_id: string | null;
  price: number;
  stock_quantity: number;
  overview?: string;
  section_values: ProductSectionValueRecord[];
  is_active: boolean;
  image?: string;
  datasheet?: string;
};
export type UpdateAdminProductRequest = Partial<CreateAdminProductRequest>;

export type PackageProductItemRecord = {
  id?: string;
  category_id: string;
  category_name?: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  product?: AdminProductRecord | null;
};

export type PackageSystemDetailsRecord = {
  inverter_size: string;
  inverter_label?: string;
  pv_size: string;
  pv_label?: string;
  battery_size: string;
  battery_label?: string;
};

export type InstallationRecord = {
  id: string;
  user_id: string;
  customer_email: string | null;
  customer_name: string | null;
  installer_id: string | null;
  order_id?: string | null;
  status: string;
  address: string;
  city: string;
  state: string;
  country: string;
  system_size_kw: number;
  number_of_panels?: number | null;
  panel_type?: string | null;
  inverter_type?: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  notes?: string | null;
  created_at: string;
};

export type InstallationListApiResponse = ApiCollectionResponse<InstallationRecord>;
export type InstallationDetailApiResponse = ApiDataResponse<InstallationRecord>;
export type CreateInstallationRequest = {
  user_id: string;
  installer_id: string;
  order_id: string;
  status: string;
  address: string;
  city: string;
  state: string;
  country: string;
  system_size_kw: number;
  number_of_panels: number;
  panel_type: string;
  inverter_type: string;
  scheduled_date: string;
  notes: string;
};
export type UpdateInstallationRequest = Partial<{
  status: string;
  notes: string;
  scheduled_date: string;
  installer_id: string;
}>;

export type JobApiRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  status: string;
  budget: string | number;
  deadline: string | null;
  created_at: string;
  required_experience_years: number;
  installation_id?: string | null;
  assigned_to?: string | null;
};

export type JobListApiResponse = ApiCollectionResponse<JobApiRecord>;
export type JobDetailApiResponse = ApiDataResponse<JobApiRecord>;
export type CreateJobRequest = {
  slug: string;
  title: string;
  description: string;
  location: string;
  status: string;
  required_experience_years: number;
  budget: number;
  deadline: string;
  installation_id: string;
  assigned_to: string;
};
export type UpdateJobRequest = Partial<CreateJobRequest>;

export type JobApplicantRecord = {
  id: string;
  job_id: string;
  installer_id: string;
  status: string;
  proposal: string;
  proposed_budget: string | number | null;
  admin_notes: string | null;
  created_at: string;
  installer_user_id: string;
  installer_email: string;
  installer_name: string;
};

export type JobApplicantListApiResponse = ApiDataResponse<JobApplicantRecord[]>;
export type UpdateJobApplicantRequest = {
  status: string;
  admin_notes: string;
};

export type QuoteRequestRecord = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string;
  location: string;
  address: string | null;
  total_load_kw: number | null;
  total_watt_hours_per_day: number | null;
  monthly_usage_kwh: number | null;
  monthly_bill: number | null;
  daily_usage_kwh: number | null;
  roof_size: string | null;
  roof_orientation: string | null;
  shading: string | null;
  recommended_system_size: number | null;
  estimated_cost: number | null;
  estimated_savings: number | null;
  payback_period_years: number | null;
  status: string;
  admin_notes: string | null;
  responded_at: string | null;
  form_extras: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type QuoteRequestApplianceRecord = Record<string, unknown> & {
  id: string;
  name: string;
  wattage: number;
  quantity: number;
  hoursPerDay: number;
};

export type QuoteRequestDetailRecord = QuoteRequestRecord & {
  appliances: QuoteRequestApplianceRecord[];
};

export type QuoteRequestListApiResponse = ApiCollectionResponse<QuoteRequestRecord>;
export type QuoteRequestDetailApiResponse = ApiDataResponse<QuoteRequestDetailRecord>;
export type UpdateQuoteRequestRequest = {
  status: string;
  adminNotes: string;
};

export type VerificationSubmissionRecord = {
  id: string;
  installer_id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by_admin_id: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  user_email: string;
  user_name: string;
  documents_count: number;
};

export type VerificationDocumentUploadRecord = {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size: string;
  file_path: string;
  stored_filename: string;
  is_public: boolean;
  created_at: string;
};

export type VerificationDocumentRecord = {
  id: string;
  verification_id: string;
  upload_id: string;
  label: string;
  category: string;
  pages: number;
  created_at: string;
  upload: VerificationDocumentUploadRecord;
};

export type VerificationSubmissionDetail = {
  submission: VerificationSubmissionRecord;
  documents: VerificationDocumentRecord[];
};

export type VerificationListApiResponse = ApiCollectionResponse<VerificationSubmissionRecord>;
export type VerificationDetailApiResponse = ApiDataResponse<VerificationSubmissionDetail>;
export type AddVerificationDocumentRequest = {
  upload_id: string;
  label: string;
  category: string;
  pages: number;
};
export type ReviewVerificationRequest = {
  admin_note: string;
};

export type OrderRecord = {
  id: string;
  customer_user_id: string;
  status: string;
  total_amount: string;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer_email: string;
  customer_name: string;
};

export type OrderItemRecord = {
  id: string;
  order_id: string;
  item_type: string;
  item_id: string;
  name: string;
  quantity: number;
  unit_price: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type OrderEventRecord = {
  id: string;
  order_id: string;
  kind: string;
  message: string;
  created_by: string | null;
  created_at: string;
};

export type BundleRequestRecord = {
  id: string;
  order_id: string;
  bundle_id: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  bundle_name: string;
  order_status: string;
};

export type BundleRequestListApiResponse = ApiCollectionResponse<BundleRequestRecord>;
export type UpdateBundleRequestRequest = {
  status: string;
  admin_note: string;
};

export type OrderDetail = {
  order: OrderRecord;
  items: OrderItemRecord[];
  events: OrderEventRecord[];
  bundleRequests: BundleRequestRecord[];
};

export type OrderListApiResponse = ApiCollectionResponse<OrderRecord>;
export type OrderDetailApiResponse = ApiDataResponse<OrderDetail>;
export type CreateOrderRequest = {
  customer_user_id: string;
  status: string;
  currency: string;
  total_amount: number;
  notes: string;
  items: Array<{
    item_type: string;
    item_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    metadata: Record<string, unknown>;
  }>;
};

export type UpdateOrderRequest = {
  status: string;
  currency: string;
  total_amount: number;
  notes: string;
};

export type TransactionRecord = {
  id: string;
  user_id: string;
  installation_id: string | null;
  type: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  payment_reference: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TransactionListApiResponse = ApiCollectionResponse<TransactionRecord>;
export type TransactionDetailApiResponse = ApiDataResponse<TransactionRecord>;
export type CreateTransactionRequest = {
  user_id: string;
  installation_id?: string | null;
  type: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  payment_reference?: string | null;
  description?: string;
  metadata: Record<string, unknown>;
};
export type UpdateTransactionRequest = Partial<Omit<CreateTransactionRequest, "user_id">>;

export type NotificationRecord = {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type NotificationListApiResponse = ApiCollectionResponse<NotificationRecord>;
export type NotificationDetailApiResponse = ApiDataResponse<NotificationRecord>;
export type CreateNotificationRequest = {
  user_id?: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata: Record<string, unknown>;
};
export type UpdateNotificationRequest = Partial<{
  type: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
}>;

export type AdminActivityRecord = Record<string, unknown> & {
  id?: string;
  action?: string;
  event?: string;
  activity?: string;
  type?: string;
  kind?: string;
  title?: string;
  message?: string;
  description?: string;
  summary?: string;
  status?: string;
  result?: string;
  outcome?: string;
  created_at?: string;
  updated_at?: string;
  timestamp?: string;
  occurred_at?: string;
  admin_name?: string;
  admin_email?: string;
  user_name?: string;
  user_email?: string;
  actor_name?: string;
  actor_email?: string;
  target_name?: string;
  target_id?: string;
  entity?: string;
  entity_type?: string;
  resource?: string;
  module?: string;
};

export type AdminActivityListApiResponse = ApiCollectionResponse<AdminActivityRecord>;

export type ApplianceCatalogRecord = {
  id: string;
  name: string;
  category: string;
  power_rating_watts: number;
  daily_hours_usage: number;
  monthly_kwh: number;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  catalog_key: string | null;
  surge_multiplier: number;
  is_inductive: boolean;
  search_aliases: string[];
  created_at: string;
  updated_at: string;
};

export type ApplianceListApiResponse = ApiSuccessResponse & {
  data: ApplianceCatalogRecord[];
};

export type ApplianceDetailApiResponse = ApiDataResponse<ApplianceCatalogRecord>;

export type CreateApplianceRequest = {
  name: string;
  category: string;
  power_rating_watts: number;
  daily_hours_usage: number;
  description: string;
  icon: string;
  catalog_key: string;
  surge_multiplier: number;
  is_inductive: boolean;
  search_aliases: string[];
  is_active: boolean;
};

export type UpdateApplianceRequest = Partial<CreateApplianceRequest>;

export type BlogPostRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  status: string;
  image: string;
  image_url: string;
  seo_title: string;
  meta_description: string;
  read_time_minutes: number;
  views: number;
  created_at: string;
  updated_at: string;
};

export type BlogListApiResponse = ApiCollectionResponse<BlogPostRecord>;
export type BlogDetailApiResponse = ApiDataResponse<BlogPostRecord>;
export type CreateBlogPostRequest = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  status: string;
  image?: string;
  image_url?: string;
  seo_title: string;
  meta_description: string;
  read_time_minutes: number;
};
export type UpdateBlogPostRequest = Partial<CreateBlogPostRequest & { views: number }>;

export type SitePageSectionCard = {
  title?: string;
  subtitle?: string;
  content?: string;
  [key: string]: unknown;
};

export type SitePageSection = {
  type: string;
  title?: string;
  subtitle?: string;
  content?: string;
  cards?: SitePageSectionCard[];
  [key: string]: unknown;
};

export type SitePageRecord = {
  id: string;
  slug: string;
  title: string;
  page_type: string;
  seo_title: string;
  meta_description: string;
  keywords: string;
  sections: SitePageSection[] | Record<string, unknown>;
  seo_score: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SitePageListApiResponse = ApiCollectionResponse<SitePageRecord>;
export type SitePageDetailApiResponse = ApiDataResponse<SitePageRecord>;
export type CreateSitePageRequest = {
  slug: string;
  title: string;
  page_type: string;
  seo_title: string;
  meta_description: string;
  keywords: string;
  sections: SitePageSection[];
  seo_score: number;
  status: string;
};
export type UpdateSitePageRequest = Partial<CreateSitePageRequest>;

export type SocketSessionApiResponse = ApiDataResponse<{
  accessToken: string;
  socketUrl: string;
  socketPath: string;
  eventNames: string[];
}>;

export type SessionSnapshot = {
  session: AdminSession;
  user: Pick<AdminUser, "id" | "email" | "name" | "fullName" | "adminRole" | "role" | "avatar_url" | "status">;
  permissions: string[];
  expiresAt: string | null;
};
