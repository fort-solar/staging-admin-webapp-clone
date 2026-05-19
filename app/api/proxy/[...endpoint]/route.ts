import { NextRequest, NextResponse } from "next/server";
import { buildErrorResponse, fetchFortsolar, getPayloadMessage, getRequestBody, makeProxyHeaders, parseServerPayload, refreshAccessToken, syncSessionCookieFromProfile } from "@/lib/api/server";
import { clearAuthCookies, getAuthTokens, getSessionSnapshotFromCookieStore, setAuthCookies } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ endpoint: string[] }>;
};

async function forwardRequest(request: NextRequest, path: string, accessToken: string) {
  const body = await getRequestBody(request);

  return fetchFortsolar(path, {
    method: request.method,
    headers: makeProxyHeaders(request, accessToken),
    body,
  });
}

async function proxyHandler(request: NextRequest, context: RouteContext) {
  const { endpoint } = await context.params;
  const path = `/${endpoint.join("/")}${request.nextUrl.search}`;
  const previousSnapshot = await getSessionSnapshotFromCookieStore(request.cookies);
  const { accessToken, refreshToken } = getAuthTokens(request.cookies);
  const response = new NextResponse();
  let activeAccessToken = accessToken;

  if (!activeAccessToken && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken, previousSnapshot);

    if (!refreshed) {
      const unauthorized = buildErrorResponse("Your session has expired. Please sign in again.", 401);
      clearAuthCookies(unauthorized.cookies);
      return unauthorized;
    }

    await setAuthCookies(response.cookies, refreshed.payload, refreshed.permissions);
    activeAccessToken = refreshed.payload.accessToken;
  }

  if (!activeAccessToken) {
    const unauthorized = buildErrorResponse("Please sign in to continue.", 401);
    clearAuthCookies(unauthorized.cookies);
    return unauthorized;
  }

  let upstream = await forwardRequest(request, path, activeAccessToken);

  if (upstream.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken, previousSnapshot);

    if (!refreshed) {
      const unauthorized = buildErrorResponse("Your session has expired. Please sign in again.", 401);
      clearAuthCookies(unauthorized.cookies);
      return unauthorized;
    }

    await setAuthCookies(response.cookies, refreshed.payload, refreshed.permissions);
    upstream = await forwardRequest(request, path, refreshed.payload.accessToken);
  }

  const payload = await parseServerPayload(upstream);

  if (upstream.ok && path === "/api/v1/admin/me" && payload && typeof payload === "object" && "success" in payload && payload.success === true) {
    await syncSessionCookieFromProfile(response, payload as import("@/types/api.types").AdminMeApiResponse, previousSnapshot);
  }

  if (!upstream.ok) {
    const errorResponse = buildErrorResponse(getPayloadMessage(payload, "The request could not be completed."), upstream.status || 400);
    response.cookies.getAll().forEach((cookie) => {
      errorResponse.cookies.set(cookie);
    });
    return errorResponse;
  }

  const proxied = NextResponse.json(payload ?? { success: true }, { status: upstream.status });
  response.cookies.getAll().forEach((cookie) => {
    proxied.cookies.set(cookie);
  });
  return proxied;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyHandler(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyHandler(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyHandler(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyHandler(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyHandler(request, context);
}
