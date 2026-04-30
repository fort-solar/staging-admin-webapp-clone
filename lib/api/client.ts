import { extractApiMessage } from "@/lib/api/errors";
import type { ApiMethod } from "@/types/common.types";

type DashboardRequestOptions = {
  method?: ApiMethod;
  body?: BodyInit | FormData | Record<string, unknown> | null;
  headers?: HeadersInit;
  signal?: AbortSignal;
  cache?: RequestCache;
};

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

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  return response.text().catch(() => null);
}

export async function dashboardRequest<TResponse>(path: string, options: DashboardRequestOptions = {}) {
  const headers = new Headers(options.headers);
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

  const response = await fetch(toRequestPath(path), requestInit);
  const payload = await parseResponseBody(response);

  if (!response.ok || (payload && typeof payload === "object" && "success" in payload && payload.success === false)) {
    throw new DashboardRequestError(extractApiMessage(payload), response.status, payload);
  }

  return payload as TResponse;
}

export function dashboardGet<TResponse>(path: string, options: Omit<DashboardRequestOptions, "method" | "body"> = {}) {
  return dashboardRequest<TResponse>(path, { ...options, method: "GET" });
}

export function submitDashboardForm<TResponse>(path: string, body: DashboardRequestOptions["body"], options: Omit<DashboardRequestOptions, "method" | "body"> & { method?: Exclude<ApiMethod, "GET"> } = {}) {
  return dashboardRequest<TResponse>(path, { ...options, method: options.method ?? "POST", body });
}
