import { NextRequest, NextResponse } from "next/server";
import { fetchFortsolar } from "@/lib/api/server";
import { AUTH_COOKIE_NAMES, clearAuthCookies, getAuthTokens } from "@/lib/auth/session";
import type { ApiErrorResponse, LogoutApiResponse } from "@/types/api.types";

type LogoutRequestBody = {
  refreshToken?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as LogoutRequestBody | null;
  const { refreshToken } = getAuthTokens(request.cookies);
  const tokenToInvalidate = body?.refreshToken || refreshToken;

  if (tokenToInvalidate) {
    await fetchFortsolar("/api/v1/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken: tokenToInvalidate }),
    }).catch(() => null);
  }

  const response = NextResponse.json<LogoutApiResponse | ApiErrorResponse>({
    success: true,
    message: "Signed out successfully.",
  });

  clearAuthCookies(response.cookies);
  response.cookies.delete(AUTH_COOKIE_NAMES.accessToken);
  return response;
}
