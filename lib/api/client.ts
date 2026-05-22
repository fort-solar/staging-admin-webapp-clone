import { extractApiMessage } from "@/lib/api/errors";
import type { ApiMethod } from "@/types/common.types";

type DashboardRequestOptions = {
  method?: ApiMethod;
  body?: BodyInit | FormData | Record<string, unknown> | null;
  headers?: HeadersInit;
  signal?: AbortSignal;
  cache?: RequestCache;
  confirmation?: DashboardRequestConfirmation;
};

type DashboardConfirmationTone = "default" | "danger";

export type DashboardRequestConfirmation =
  | false
  | {
      title?: string;
      description?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      tone?: DashboardConfirmationTone;
    };

export type ResolvedDashboardRequestConfirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: DashboardConfirmationTone;
};

type DashboardConfirmationHandler = (options: ResolvedDashboardRequestConfirmation) => Promise<boolean>;

const dashboardRequestTargetLabels: Record<string, string> = {
  admins: "admin",
  applicants: "job applicant",
  appliances: "appliance",
  batteries: "battery product",
  blog: "blog post",
  "bundle-requests": "bundle request",
  customers: "customer",
  installers: "installer",
  installations: "installation",
  inverters: "inverter product",
  jobs: "job",
  notifications: "notification",
  orders: "order",
  packages: "package",
  panels: "panel product",
  "product-categories": "product category",
  "quote-requests": "quote request",
  "site-pages": "site page",
  submissions: "verification submission",
  transactions: "transaction",
  verification: "verification submission",
};

let dashboardConfirmationHandler: DashboardConfirmationHandler | null = null;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof FormData) && !(value instanceof URLSearchParams) && !(value instanceof Blob);
}

function toRequestPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  if (normalized.startsWith("/api/auth/") || normalized.startsWith("/api/proxy/")) {
    return normalized;
  }

  return `/api/proxy${normalized}`;
}

export const DASHBOARD_SESSION_EXPIRED_EVENT = "fortsolar:session-expired";

export class DashboardRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "DashboardRequestError";
    this.status = status;
    this.payload = payload;
  }
}

export class DashboardActionCancelledError extends Error {
  constructor() {
    super("The action was cancelled.");
    this.name = "DashboardActionCancelledError";
  }
}

export function isDashboardSessionExpiredError(error: unknown) {
  return error instanceof DashboardRequestError && error.status === 401;
}

export function isDashboardActionCancelledError(error: unknown) {
  return error instanceof DashboardActionCancelledError;
}

export function registerDashboardConfirmationHandler(handler: DashboardConfirmationHandler | null) {
  dashboardConfirmationHandler = handler;

  return () => {
    if (dashboardConfirmationHandler === handler) {
      dashboardConfirmationHandler = null;
    }
  };
}

function describeDashboardRequestTarget(path: string) {
  const normalizedPath = path.replace(/^\/api\/proxy/, "").split("?")[0];
  const segments = normalizedPath.split("/").filter(Boolean);
  const adminIndex = segments.findIndex((segment) => segment === "admin");
  const relevantSegments = adminIndex >= 0 ? segments.slice(adminIndex + 1) : segments;
  const mappedSegments = relevantSegments.filter((segment) => dashboardRequestTargetLabels[segment]);
  const lastSegment = mappedSegments[mappedSegments.length - 1];

  return dashboardRequestTargetLabels[lastSegment] ?? "record";
}

function buildDefaultRequestConfirmation(path: string, method: string): ResolvedDashboardRequestConfirmation | null {
  if (path.startsWith("/api/auth/")) {
    return null;
  }

  const resourceLabel = describeDashboardRequestTarget(path);
  const normalizedMethod = method.toUpperCase();

  if (normalizedMethod === "DELETE") {
    return {
      title: `Delete this ${resourceLabel}?`,
      description: "This action cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      tone: "danger",
    };
  }

  if (normalizedMethod === "PATCH" || normalizedMethod === "PUT") {
    return {
      title: `Save changes to this ${resourceLabel}?`,
      description: "Your updates will be applied immediately after you confirm.",
      confirmLabel: "Save changes",
      cancelLabel: "Cancel",
      tone: "default",
    };
  }

  return null;
}

function resolveRequestConfirmation(path: string, method: string, confirmation?: DashboardRequestConfirmation) {
  if (confirmation === false) {
    return null;
  }

  const fallback = buildDefaultRequestConfirmation(path, method);

  if (!fallback && !confirmation) {
    return null;
  }

  return {
    title: confirmation?.title ?? fallback?.title ?? "Confirm this action?",
    description: confirmation?.description ?? fallback?.description ?? "This change will be applied immediately after you confirm.",
    confirmLabel: confirmation?.confirmLabel ?? fallback?.confirmLabel ?? "Continue",
    cancelLabel: confirmation?.cancelLabel ?? fallback?.cancelLabel ?? "Cancel",
    tone: confirmation?.tone ?? fallback?.tone ?? "default",
  } satisfies ResolvedDashboardRequestConfirmation;
}

async function confirmDashboardRequest(path: string, method: string, confirmation?: DashboardRequestConfirmation) {
  if (typeof window === "undefined") {
    return;
  }

  const resolvedConfirmation = resolveRequestConfirmation(path, method, confirmation);

  if (!resolvedConfirmation) {
    return;
  }

  const approved = dashboardConfirmationHandler
    ? await dashboardConfirmationHandler(resolvedConfirmation)
    : window.confirm(`${resolvedConfirmation.title}\n\n${resolvedConfirmation.description}`);

  if (!approved) {
    throw new DashboardActionCancelledError();
  }
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  return response.text().catch(() => null);
}

export async function dashboardRequest<TResponse>(path: string, options: DashboardRequestOptions = {}) {
  const headers = new Headers(options.headers);
  const requestPath = toRequestPath(path);
  const requestInit: RequestInit = {
    method: options.method ?? "GET",
    headers,
    signal: options.signal,
    cache: options.cache ?? "no-store",
    credentials: "same-origin",
  };

  if (options.body instanceof FormData || typeof options.body === "string" || options.body instanceof URLSearchParams || options.body instanceof Blob) {
    requestInit.body = options.body;
  } else if (isPlainObject(options.body)) {
    headers.set("Content-Type", "application/json");
    requestInit.body = JSON.stringify(options.body);
  }

  await confirmDashboardRequest(requestPath, requestInit.method ?? "GET", options.confirmation);

  const response = await fetch(requestPath, requestInit);
  const payload = await parseResponseBody(response);

  if (!response.ok || (payload && typeof payload === "object" && "success" in payload && payload.success === false)) {
    const message = extractApiMessage(payload);

    if (
      typeof window !== "undefined" &&
      response.status === 401 &&
      !requestPath.startsWith("/api/auth/")
    ) {
      window.dispatchEvent(
        new CustomEvent(DASHBOARD_SESSION_EXPIRED_EVENT, {
          detail: {
            message,
            path: requestPath,
            status: response.status,
          },
        }),
      );
    }

    throw new DashboardRequestError(message, response.status, payload);
  }

  return payload as TResponse;
}

export function dashboardGet<TResponse>(path: string, options: Omit<DashboardRequestOptions, "method" | "body"> = {}) {
  return dashboardRequest<TResponse>(path, { ...options, method: "GET" });
}

export function submitDashboardForm<TResponse>(path: string, body: DashboardRequestOptions["body"], options: Omit<DashboardRequestOptions, "method" | "body"> & { method?: Exclude<ApiMethod, "GET"> } = {}) {
  return dashboardRequest<TResponse>(path, { ...options, method: options.method ?? "POST", body });
}
