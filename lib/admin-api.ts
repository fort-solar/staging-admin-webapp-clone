import { DashboardRequestError, dashboardGet, submitDashboardForm, type DashboardRequestConfirmation } from "@/lib/api/client";
import type {
  AdminDetailApiResponse,
  AdminListApiResponse,
  ApiDataResponse,
  ApiSuccessResponse,
  ApplianceDetailApiResponse,
  ApplianceListApiResponse,
  AdminActivityListApiResponse,
  AdminProductDetailApiResponse,
  AdminProductListApiResponse,
  BundleRequestListApiResponse,
  CreateApplianceRequest,
  CreateAdminProductRequest,
  CreatePackageRequest,
  CreateProductBatteryRequest,
  CreateProductCategoryRequest,
  CreateProductInverterRequest,
  CreateProductPanelRequest,
  CreateAdminRequest,
  CreateBlogPostRequest,
  CreateCustomerRequest,
  CreateOrderRequest,
  CreateNotificationRequest,
  CustomerDetailApiResponse,
  CustomerListApiResponse,
  DashboardOverviewApiResponse,
  BlogDetailApiResponse,
  BlogListApiResponse,
  CreateInstallationRequest,
  CreateJobRequest,
  PackageListApiResponse,
  PackageRecord,
  ProductBatteryDetailApiResponse,
  ProductBatteryListApiResponse,
  ProductCategoryDetailApiResponse,
  ProductCategoryListApiResponse,
  ProductInverterDetailApiResponse,
  ProductInverterListApiResponse,
  ProductPanelListApiResponse,
  ProductPanelDetailApiResponse,
  OrderDetailApiResponse,
  OrderListApiResponse,
  InstallationDetailApiResponse,
  InstallationListApiResponse,
  JobApplicantListApiResponse,
  JobDetailApiResponse,
  JobListApiResponse,
  QuoteRequestDetailApiResponse,
  QuoteRequestListApiResponse,
  ReviewVerificationRequest,
  SitePageDetailApiResponse,
  SitePageListApiResponse,
  CreateSitePageRequest,
  TransactionDetailApiResponse,
  TransactionListApiResponse,
  CreateTransactionRequest,
  UpdateBlogPostRequest,
  UpdateBundleRequestRequest,
  UpdateAdminRequest,
  UpdateApplianceRequest,
  UpdateNotificationRequest,
  UpdatePackageRequest,
  UpdateInstallationRequest,
  UpdateJobApplicantRequest,
  UpdateJobRequest,
  UpdateAdminProductRequest,
  UpdateProductBatteryRequest,
  UpdateCustomerRequest,
  UpdateInstallerRequest,
  UpdateOrderRequest,
  UpdateQuoteRequestRequest,
  UpdateSitePageRequest,
  UpdateTransactionRequest,
  UpdateProductCategoryRequest,
  UpdateProductInverterRequest,
  UpdateProductPanelRequest,
  VerificationDetailApiResponse,
  VerificationListApiResponse,
  AddVerificationDocumentRequest,
  InstallerDetailApiResponse,
  InstallerListApiResponse,
  NotificationDetailApiResponse,
  NotificationListApiResponse,
} from "@/types/api.types";

export const DEFAULT_PAGE_SIZE = 20;

type ListParams = {
  page?: number;
  limit?: number;
  category?: string;
  category_id?: string;
  search?: string;
  q?: string;
  scope?: string;
  fields?: string | string[];
  is_active?: boolean | "true" | "false";
};

type MultipartCapable<TBody> = TBody | FormData;
type MutationRequestOptions = {
  confirmation?: DashboardRequestConfirmation;
};

function withQuery(path: string, params: Record<string, string | number | boolean | string[] | null | undefined>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }

    search.set(key, Array.isArray(value) ? value.join(",") : String(value));
  });

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function appendFormDataValue(formData: FormData, key: string, value: unknown) {
  if (value === null || value === undefined) {
    return;
  }

  if (value instanceof Blob) {
    formData.append(key, value);
    return;
  }

  if (value instanceof Date) {
    formData.append(key, value.toISOString());
    return;
  }

  if (Array.isArray(value) || (typeof value === "object" && value)) {
    formData.append(key, JSON.stringify(value));
    return;
  }

  formData.append(key, String(value));
}

export function buildMultipartFormData(payload: Record<string, unknown>) {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    appendFormDataValue(formData, key, value);
  });

  return formData;
}

async function requestWithEndpointFallback<TResponse>(
  primaryPath: string,
  fallbackPath: string,
  request: (path: string) => Promise<TResponse>,
) {
  try {
    return await request(primaryPath);
  } catch (error) {
    if (error instanceof DashboardRequestError && (error.status === 404 || error.status === 405)) {
      return request(fallbackPath);
    }

    throw error;
  }
}

function safeNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) {
    return 0;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

export function formatEnumLabel(value: string | null | undefined, fallback = "Unknown") {
  if (!value) {
    return fallback;
  }

  return value
    .split("_")
    .join(" ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeManagedUserStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase() ?? "";

  if (normalized === "inactive" || normalized === "deactivated" || normalized === "disactivated") {
    return "inactive";
  }

  return normalized;
}

export function formatManagedUserStatusLabel(status: string | null | undefined, fallback = "Unknown") {
  const normalized = normalizeManagedUserStatus(status);
  if (normalized === "inactive") {
    return "Deactivated";
  }

  return normalized ? formatEnumLabel(normalized, fallback) : fallback;
}

export function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatCurrencyLabel(amount: string | number | null | undefined, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(safeNumber(amount));
}

export function getDashboardOverview() {
  return dashboardGet<DashboardOverviewApiResponse>("/api/v1/admin/dashboard/overview");
}

export function getCustomers(params: ListParams = {}) {
  return dashboardGet<CustomerListApiResponse>(
    withQuery("/api/v1/admin/customers/", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getCustomer(id: string) {
  return dashboardGet<CustomerDetailApiResponse>(`/api/v1/admin/customers/${id}`);
}

export function createCustomer(body: CreateCustomerRequest) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/customers/", body, { method: "POST" });
}

export function updateCustomer(id: string, body: Partial<UpdateCustomerRequest>) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/customers/${id}`, body, { method: "PATCH" });
}

export function getInstallers(params: ListParams = {}) {
  return dashboardGet<InstallerListApiResponse>(
    withQuery("/api/v1/admin/installers/", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getInstaller(id: string) {
  return dashboardGet<InstallerDetailApiResponse>(`/api/v1/admin/installers/${id}`);
}

export function updateInstaller(id: string, body: Partial<UpdateInstallerRequest>) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/installers/${id}`, body, { method: "PATCH" });
}

export function deleteInstaller(id: string) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/installers/${id}`, null, { method: "DELETE" });
}

export function getAdmins(params: ListParams = {}) {
  return dashboardGet<AdminListApiResponse>(
    withQuery("/api/v1/admin/admins/", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getProductPanels(params: ListParams = {}) {
  return dashboardGet<ProductPanelListApiResponse>(
    withQuery("/api/v1/admin/products/panels", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getProductPanel(id: string) {
  return dashboardGet<ProductPanelDetailApiResponse>(`/api/v1/admin/products/panels/${id}`);
}

export function createProductPanel(body: MultipartCapable<CreateProductPanelRequest>) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/products/panels", body, { method: "POST" });
}

export function updateProductPanel(id: string, body: UpdateProductPanelRequest) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/products/panels/${id}`, body, { method: "PATCH" });
}

export function deleteProductPanel(id: string) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/products/panels/${id}`, null, { method: "DELETE" });
}

export function getProductInverters(params: ListParams = {}) {
  return dashboardGet<ProductInverterListApiResponse>(
    withQuery("/api/v1/admin/products/inverters", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getProductInverter(id: string) {
  return dashboardGet<ProductInverterDetailApiResponse>(`/api/v1/admin/products/inverters/${id}`);
}

export function getProductInverterBySlug(slug: string) {
  return dashboardGet<ProductInverterDetailApiResponse>(`/api/v1/admin/products/inverters/slug/${slug}`);
}

export function createProductInverter(body: MultipartCapable<CreateProductInverterRequest>) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/products/inverters", body, { method: "POST" });
}

export function updateProductInverter(id: string, body: UpdateProductInverterRequest) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/products/inverters/${id}`, body, { method: "PATCH" });
}

export function deleteProductInverter(id: string) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/products/inverters/${id}`, null, { method: "DELETE" });
}

export function getProductBatteries(params: ListParams = {}) {
  return dashboardGet<ProductBatteryListApiResponse>(
    withQuery("/api/v1/admin/products/batteries", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getProductBattery(id: string) {
  return dashboardGet<ProductBatteryDetailApiResponse>(`/api/v1/admin/products/batteries/${id}`);
}

export function getProductBatteryBySlug(slug: string) {
  return dashboardGet<ProductBatteryDetailApiResponse>(`/api/v1/admin/products/batteries/slug/${slug}`);
}

export function createProductBattery(body: MultipartCapable<CreateProductBatteryRequest>) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/products/batteries", body, { method: "POST" });
}

export function updateProductBattery(id: string, body: UpdateProductBatteryRequest) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/products/batteries/${id}`, body, { method: "PATCH" });
}

export function deleteProductBattery(id: string) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/products/batteries/${id}`, null, { method: "DELETE" });
}

export function getProductCategories(params: ListParams = {}) {
  return dashboardGet<ProductCategoryListApiResponse>(
    withQuery("/api/v1/admin/product-categories", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getProducts(params: ListParams = {}) {
  return dashboardGet<AdminProductListApiResponse>(
    withQuery("/api/v1/admin/products", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category_id: params.category_id ?? params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
      is_active: params.is_active,
    }),
  );
}

export function getProduct(id: string) {
  return dashboardGet<AdminProductDetailApiResponse>(`/api/v1/admin/products/${id}`);
}

export function createProduct(body: MultipartCapable<CreateAdminProductRequest>) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/products", body, { method: "POST" });
}

export function updateProduct(id: string, body: MultipartCapable<UpdateAdminProductRequest>) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/products/${id}`, body, { method: "PATCH" });
}

export function deleteProduct(id: string) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/products/${id}`, null, { method: "DELETE" });
}

export function getProductCategory(id: string) {
  return dashboardGet<ProductCategoryDetailApiResponse>(`/api/v1/admin/product-categories/${id}`);
}

export function createProductCategory(body: MultipartCapable<CreateProductCategoryRequest>) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/product-categories", body, { method: "POST" });
}

export function updateProductCategory(id: string, body: MultipartCapable<UpdateProductCategoryRequest>) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/product-categories/${id}`, body, { method: "PATCH" });
}

export function deleteProductCategory(id: string) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/product-categories/${id}`, null, { method: "DELETE" });
}

export function getPackages(params: ListParams = {}) {
  return dashboardGet<PackageListApiResponse>(
    withQuery("/api/v1/admin/packages", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getInstallations(params: ListParams = {}) {
  const primaryPath = withQuery("/api/v1/admin/projects/", {
    page: params.page ?? 1,
    limit: params.limit ?? DEFAULT_PAGE_SIZE,
    category: params.category,
    search: params.search,
    q: params.q,
    fields: params.fields,
  });
  const fallbackPath = withQuery("/api/v1/admin/installations/", {
    page: params.page ?? 1,
    limit: params.limit ?? DEFAULT_PAGE_SIZE,
    category: params.category,
    search: params.search,
    q: params.q,
    fields: params.fields,
  });

  return requestWithEndpointFallback(primaryPath, fallbackPath, (path) => dashboardGet<InstallationListApiResponse>(path));
}

export function getInstallation(id: string) {
  return requestWithEndpointFallback(
    `/api/v1/admin/projects/${id}`,
    `/api/v1/admin/installations/${id}`,
    (path) => dashboardGet<InstallationDetailApiResponse>(path),
  );
}

export function createInstallation(body: MultipartCapable<CreateInstallationRequest>) {
  return requestWithEndpointFallback(
    "/api/v1/admin/projects/",
    "/api/v1/admin/installations/",
    (path) => submitDashboardForm<ApiSuccessResponse>(path, body, { method: "POST" }),
  );
}

export function updateInstallation(id: string, body: MultipartCapable<UpdateInstallationRequest>) {
  return requestWithEndpointFallback(
    `/api/v1/admin/projects/${id}`,
    `/api/v1/admin/installations/${id}`,
    (path) => submitDashboardForm<ApiSuccessResponse>(path, body, { method: "PATCH" }),
  );
}

export function deleteInstallation(id: string) {
  return requestWithEndpointFallback(
    `/api/v1/admin/projects/${id}`,
    `/api/v1/admin/installations/${id}`,
    (path) => submitDashboardForm<ApiSuccessResponse>(path, null, { method: "DELETE" }),
  );
}

export async function getPackageBySlug(slug: string) {
  const payload = await getPackages({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    search: slug,
    q: slug,
    fields: [
      "id",
      "slug",
      "name",
      "description",
      "category_id",
      "system_size_kw",
      "price",
      "number_of_panels",
      "panel_type",
      "inverter_type",
      "battery_included",
      "warranty_years",
      "estimated_savings_monthly",
      "payback_period_years",
      "image_url",
      "is_active",
      "created_at",
      "updated_at",
    ],
  });

  const normalizedSlug = slug.trim().toLowerCase();
  return payload.data.find((pkg) => pkg.slug.trim().toLowerCase() === normalizedSlug) ?? null;
}

export function getPackage(id: string) {
  return dashboardGet<ApiDataResponse<PackageRecord>>(`/api/v1/admin/packages/${id}`);
}

export function createPackage(body: MultipartCapable<CreatePackageRequest>) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/packages", body, { method: "POST" });
}

export function updatePackage(id: string, body: MultipartCapable<UpdatePackageRequest>) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/packages/${id}`, body, { method: "PATCH" });
}

export function deletePackage(id: string) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/packages/${id}`, null, { method: "DELETE" });
}

export function getAdmin(id: string) {
  return dashboardGet<AdminDetailApiResponse>(`/api/v1/admin/admins/${id}`);
}

export function createAdmin(body: CreateAdminRequest) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/admins/", body, { method: "POST" });
}

export function updateAdmin(id: string, body: UpdateAdminRequest) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/admins/${id}`, body, { method: "PATCH" });
}

export function deleteAdmin(id: string) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/admins/${id}`, null, { method: "DELETE" });
}

export function getVerificationSubmissions(params: ListParams = {}) {
  return dashboardGet<VerificationListApiResponse>(
    withQuery("/api/v1/admin/verification/submissions", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getVerificationSubmission(id: string) {
  return dashboardGet<VerificationDetailApiResponse>(`/api/v1/admin/verification/submissions/${id}`);
}

export function addVerificationDocument(id: string, body: AddVerificationDocumentRequest) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/verification/submissions/${id}/documents`, body, { method: "POST" });
}

export function approveVerification(id: string, body: ReviewVerificationRequest) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/verification/submissions/${id}/approve`, body, { method: "POST" });
}

export function rejectVerification(id: string, body: ReviewVerificationRequest) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/verification/submissions/${id}/reject`, body, { method: "POST" });
}

export function getOrders(params: ListParams = {}) {
  return dashboardGet<OrderListApiResponse>(
    withQuery("/api/v1/admin/orders/", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getOrder(id: string) {
  return dashboardGet<OrderDetailApiResponse>(`/api/v1/admin/orders/${id}`);
}

export function createOrder(body: CreateOrderRequest) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/orders/", body, { method: "POST" });
}

export function updateOrder(id: string, body: UpdateOrderRequest) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/orders/${id}`, body, { method: "PATCH" });
}

export function deleteOrder(id: string) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/orders/${id}`, null, { method: "DELETE" });
}

export function getTransactions(params: ListParams = {}) {
  return dashboardGet<TransactionListApiResponse>(
    withQuery("/api/v1/admin/transactions/", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getTransaction(id: string) {
  return dashboardGet<TransactionDetailApiResponse>(`/api/v1/admin/transactions/${id}`);
}

export function createTransaction(body: CreateTransactionRequest) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/transactions/", body, { method: "POST" });
}

export function updateTransaction(id: string, body: UpdateTransactionRequest) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/transactions/${id}`, body, { method: "PATCH" });
}

export function getNotifications(params: ListParams = {}) {
  return dashboardGet<NotificationListApiResponse>(
    withQuery("/api/v1/admin/notifications/", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getNotification(id: string) {
  return dashboardGet<NotificationDetailApiResponse>(`/api/v1/admin/notifications/${id}`);
}

export function createNotification(body: CreateNotificationRequest) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/notifications/", body, { method: "POST" });
}

export function updateNotification(id: string, body: UpdateNotificationRequest, options: MutationRequestOptions = {}) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/notifications/${id}`, body, {
    method: "PATCH",
    confirmation: options.confirmation,
  });
}

export function deleteNotification(id: string) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/notifications/${id}`, null, { method: "DELETE" });
}

export function getAdminActivity(params: ListParams & { scope?: "all" | "me" } = {}) {
  return dashboardGet<AdminActivityListApiResponse>(
    withQuery("/api/v1/admin/activity/", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      scope: params.scope ?? "all",
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getAppliances() {
  return dashboardGet<ApplianceListApiResponse>("/api/v1/admin/appliances/");
}

export function getAppliance(id: string) {
  return dashboardGet<ApplianceDetailApiResponse>(`/api/v1/admin/appliances/${id}`);
}

export function createAppliance(body: CreateApplianceRequest) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/appliances/", body, { method: "POST" });
}

export function updateAppliance(id: string, body: UpdateApplianceRequest) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/appliances/${id}`, body, { method: "PATCH" });
}

export function deleteAppliance(id: string) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/appliances/${id}`, null, { method: "DELETE" });
}

export function getBlogPosts(params: ListParams = {}) {
  return dashboardGet<BlogListApiResponse>(
    withQuery("/api/v1/admin/blog/", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getBlogPost(id: string) {
  return dashboardGet<BlogDetailApiResponse>(`/api/v1/admin/blog/${id}`);
}

export async function getBlogPostBySlug(slug: string) {
  const payload = await getBlogPosts({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    search: slug,
    q: slug,
    fields: [
      "id",
      "slug",
      "title",
      "summary",
      "body",
      "category",
      "status",
      "image_url",
      "seo_title",
      "meta_description",
      "read_time_minutes",
      "views",
      "created_at",
      "updated_at",
    ],
  });

  const normalizedSlug = slug.trim().toLowerCase();
  return payload.data.find((post) => post.slug.trim().toLowerCase() === normalizedSlug) ?? null;
}

export function createBlogPost(body: MultipartCapable<CreateBlogPostRequest>) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/blog/", body, { method: "POST" });
}

export function updateBlogPost(id: string, body: MultipartCapable<UpdateBlogPostRequest>) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/blog/${id}`, body, { method: "PATCH" });
}

export function deleteBlogPost(id: string) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/blog/${id}`, null, { method: "DELETE" });
}

export function getSitePages(params: ListParams = {}) {
  return dashboardGet<SitePageListApiResponse>(
    withQuery("/api/v1/admin/site-pages/", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getSitePage(id: string) {
  return dashboardGet<SitePageDetailApiResponse>(`/api/v1/admin/site-pages/${id}`);
}

export async function getSitePageBySlug(slug: string) {
  const payload = await getSitePages({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    search: slug,
    q: slug,
    fields: [
      "id",
      "slug",
      "title",
      "page_type",
      "seo_title",
      "meta_description",
      "keywords",
      "sections",
      "seo_score",
      "status",
      "created_at",
      "updated_at",
    ],
  });

  const normalizedSlug = slug.trim().toLowerCase();
  return payload.data.find((pageRecord) => pageRecord.slug.trim().toLowerCase() === normalizedSlug) ?? null;
}

export function createSitePage(body: CreateSitePageRequest) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/site-pages/", body, { method: "POST" });
}

export function updateSitePage(id: string, body: UpdateSitePageRequest) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/site-pages/${id}`, body, { method: "PATCH" });
}

export function deleteSitePage(id: string) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/site-pages/${id}`, null, { method: "DELETE" });
}

export function getBundleRequests(params: ListParams = {}) {
  return dashboardGet<BundleRequestListApiResponse>(
    withQuery("/api/v1/admin/orders/bundle-requests", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function updateBundleRequest(id: string, body: UpdateBundleRequestRequest) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/orders/bundle-requests/${id}`, body, { method: "PATCH" });
}

export function getJobs(params: ListParams = {}) {
  return dashboardGet<JobListApiResponse>(
    withQuery("/api/v1/admin/jobs/", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getJob(id: string) {
  return dashboardGet<JobDetailApiResponse>(`/api/v1/admin/jobs/${id}`);
}

export function getJobBySlug(slug: string) {
  return dashboardGet<JobDetailApiResponse>(`/api/v1/admin/jobs/slug/${slug}`);
}

export function createJob(body: CreateJobRequest) {
  return submitDashboardForm<ApiSuccessResponse>("/api/v1/admin/jobs/", body, { method: "POST" });
}

export function updateJob(id: string, body: UpdateJobRequest) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/jobs/${id}`, body, { method: "PATCH" });
}

export function deleteJob(id: string) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/jobs/${id}`, null, { method: "DELETE" });
}

export function getJobApplicants(id: string) {
  return dashboardGet<JobApplicantListApiResponse>(`/api/v1/admin/jobs/${id}/applicants`);
}

export function updateJobApplicant(id: string, applicantId: string, body: UpdateJobApplicantRequest) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/jobs/${id}/applicants/${applicantId}`, body, { method: "PATCH" });
}

export function getQuoteRequests(params: ListParams = {}) {
  return dashboardGet<QuoteRequestListApiResponse>(
    withQuery("/api/v1/admin/quote-requests/", {
      page: params.page ?? 1,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      category: params.category,
      search: params.search,
      q: params.q,
      fields: params.fields,
    }),
  );
}

export function getQuoteRequest(id: string) {
  return dashboardGet<QuoteRequestDetailApiResponse>(`/api/v1/admin/quote-requests/${id}`);
}

export function updateQuoteRequest(id: string, body: MultipartCapable<UpdateQuoteRequestRequest>) {
  return submitDashboardForm<ApiSuccessResponse>(`/api/v1/admin/quote-requests/${id}`, body, { method: "PATCH" });
}
