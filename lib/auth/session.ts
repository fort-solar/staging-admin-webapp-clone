import type { AdminMeApiResponse, LoginApiResponse, RefreshTokenApiResponse, SessionSnapshot } from "@/types/api.types";

const SESSION_SECRET = process.env.FORTSOLAR_SESSION_SECRET ?? process.env.NEXT_PUBLIC_FORTSOLAR_SESSION_SECRET;
const ACCESS_MAX_AGE_FALLBACK = 60 * 15;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

export const AUTH_COOKIE_NAMES = {
  accessToken: "fortsolar.access_token",
  refreshToken: "fortsolar.refresh_token",
  session: "fortsolar.session",
} as const;

type CookieReader = {
  get: (name: string) => { value: string } | string | undefined;
};

type CookieWriter = {
  set: (name: string, value: string, options?: Record<string, unknown>) => unknown;
  delete: (name: string) => unknown;
};

let signingKeyPromise: Promise<CryptoKey> | null = null;

function secureCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  } as const;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function readCookieValue(store: CookieReader, name: string) {
  const cookie = store.get(name);

  if (typeof cookie === "string") {
    return cookie;
  }

  return cookie?.value;
}

async function getSigningKey() {
  if (!signingKeyPromise) {
    signingKeyPromise = crypto.subtle.importKey("raw", new TextEncoder().encode(SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  }

  return signingKeyPromise;
}

async function signValue(value: string) {
  const signature = await crypto.subtle.sign("HMAC", await getSigningKey(), new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export function createSessionSnapshot(payload: Pick<LoginApiResponse, "session" | "user"> & { permissions?: string[] }, expiresAt: string | null = null): SessionSnapshot {
  return {
    session: payload.session,
    user: {
      id: payload.user.id,
      email: payload.user.email,
      name: payload.user.name,
      fullName: payload.user.fullName,
      adminRole: payload.user.adminRole,
      role: payload.user.role,
      avatar_url: payload.user.avatar_url,
      status: payload.user.status,
    },
    permissions: Array.from(new Set(payload.permissions ?? [])).sort(),
    expiresAt,
  };
}

export function createSessionSnapshotFromProfile(payload: AdminMeApiResponse, previousExpiresAt: string | null = null) {
  return createSessionSnapshot(payload, previousExpiresAt);
}

export async function serializeSessionSnapshot(snapshot: SessionSnapshot) {
  const encoded = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(snapshot)));
  const signature = await signValue(encoded);
  return `${encoded}.${signature}`;
}

export async function deserializeSessionSnapshot(rawValue: string | null | undefined) {
  if (!rawValue) {
    return null;
  }

  const [payload, signature] = rawValue.split(".");

  if (!payload || !signature) {
    return null;
  }

  const valid = await crypto.subtle.verify(
    "HMAC",
    await getSigningKey(),
    base64UrlToBytes(signature),
    new TextEncoder().encode(payload),
  );

  if (!valid) {
    return null;
  }

  try {
    const decoded = new TextDecoder().decode(base64UrlToBytes(payload));
    return JSON.parse(decoded) as SessionSnapshot;
  } catch {
    return null;
  }
}

export async function getSessionSnapshotFromCookieStore(store: CookieReader) {
  return deserializeSessionSnapshot(readCookieValue(store, AUTH_COOKIE_NAMES.session));
}

export function getAuthTokens(store: CookieReader) {
  return {
    accessToken: readCookieValue(store, AUTH_COOKIE_NAMES.accessToken) ?? null,
    refreshToken: readCookieValue(store, AUTH_COOKIE_NAMES.refreshToken) ?? null,
  };
}

export function isAdminSnapshot(snapshot: SessionSnapshot | null) {
  return snapshot?.session.role === "admin" && snapshot.user.role === "admin";
}

export async function setSessionSnapshotCookie(store: CookieWriter, snapshot: SessionSnapshot) {
  store.set(AUTH_COOKIE_NAMES.session, await serializeSessionSnapshot(snapshot), secureCookieOptions(REFRESH_MAX_AGE));
}

export async function setAuthCookies(
  store: CookieWriter,
  payload: Pick<LoginApiResponse | RefreshTokenApiResponse, "accessToken" | "refreshToken" | "expiresIn" | "session" | "user"> & { permissions?: string[] },
  permissions: string[] = [],
) {
  const expiresAt = payload.expiresIn > 0 ? new Date(Date.now() + payload.expiresIn * 1000).toISOString() : null;
  const snapshot = createSessionSnapshot({ ...payload, permissions }, expiresAt);

  store.set(AUTH_COOKIE_NAMES.accessToken, payload.accessToken, secureCookieOptions(Math.max(payload.expiresIn, ACCESS_MAX_AGE_FALLBACK)));
  store.set(AUTH_COOKIE_NAMES.refreshToken, payload.refreshToken, secureCookieOptions(REFRESH_MAX_AGE));
  await setSessionSnapshotCookie(store, snapshot);

  return snapshot;
}

export function clearAuthCookies(store: CookieWriter) {
  store.delete(AUTH_COOKIE_NAMES.accessToken);
  store.delete(AUTH_COOKIE_NAMES.refreshToken);
  store.delete(AUTH_COOKIE_NAMES.session);
}
