import type { ApiErrorResponse } from "@/types/api.types";

const SESSION_ERROR_MESSAGES = [
  "your session has expired. please sign in again.",
  "please sign in to continue.",
] as const;

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

export function isSessionErrorMessage(message: string | null | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.trim().toLowerCase();
  return SESSION_ERROR_MESSAGES.some((candidate) => candidate === normalized);
}
