import type { ApiErrorResponse } from "@/types/api.types";

export function extractApiMessage(payload: unknown, fallback = "Something went wrong. Please try again.") {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const candidate = payload as Partial<ApiErrorResponse> & { message?: string };
  return candidate.message || candidate.error || fallback;
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
