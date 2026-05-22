"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DASHBOARD_SESSION_EXPIRED_EVENT, dashboardGet, isDashboardSessionExpiredError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { createSessionSnapshot, createSessionSnapshotFromProfile } from "@/lib/auth/session";
import type { AdminMeApiResponse, AdminUser, SessionSnapshot } from "@/types/api.types";
import { Button } from "@/components/dashboard/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

const SESSION_WARNING_WINDOW_MS = 2 * 60 * 1000;

type RefreshSessionApiResponse = {
  success: true;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  session: SessionSnapshot["session"];
  user: AdminUser;
  permissions?: string[];
};

type AuthContextValue = {
  session: SessionSnapshot | null;
  isRefreshing: boolean;
  refreshSession: () => Promise<SessionSnapshot | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function buildSessionSnapshotFromRefresh(payload: RefreshSessionApiResponse, fallbackPermissions: string[]) {
  const expiresAt = payload.expiresIn > 0 ? new Date(Date.now() + payload.expiresIn * 1000).toISOString() : null;

  return createSessionSnapshot(
    {
      session: payload.session,
      user: payload.user,
      permissions: payload.permissions ?? fallbackPermissions,
    },
    expiresAt,
  );
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function AuthProvider({ children, initialSession }: { children: ReactNode; initialSession: SessionSnapshot }) {
  const router = useRouter();
  const { toast } = useToast();
  const [session, setSession] = useState<SessionSnapshot | null>(initialSession);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isSessionPromptOpen, setIsSessionPromptOpen] = useState(false);
  const [sessionCountdownMs, setSessionCountdownMs] = useState(0);
  const [isExtendingSession, setIsExtendingSession] = useState(false);
  const hasHandledSessionExpiryRef = useRef(false);

  const handleSessionExpired = useCallback(
    async (message?: string) => {
      if (hasHandledSessionExpiryRef.current) {
        return;
      }

      hasHandledSessionExpiryRef.current = true;

      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
        });
      } catch {
        // Ignore cleanup failures and continue forcing local sign-out.
      } finally {
        setIsSessionPromptOpen(false);
        setSessionCountdownMs(0);
        setSession(null);
        toast({
          title: "Session expired",
          description: message ?? "Please sign in again to continue.",
          variant: "error",
        });
        router.replace("/login");
        router.refresh();
      }
    },
    [router, toast],
  );

  const refreshSession = useCallback(async () => {
    try {
      const payload = await dashboardGet<AdminMeApiResponse>("/api/v1/admin/me");
      const nextSession = createSessionSnapshotFromProfile(payload, session?.expiresAt ?? null);
      hasHandledSessionExpiryRef.current = false;
      setSession(nextSession);
      return nextSession;
    } catch (error) {
      setSession(null);

      if (isDashboardSessionExpiredError(error)) {
        await handleSessionExpired(getErrorMessage(error, "Please sign in again to continue."));
      }

      throw error;
    }
  }, [handleSessionExpired, session?.expiresAt]);

  useEffect(() => {
    function onSessionExpired(event: Event) {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      void handleSessionExpired(detail?.message);
    }

    window.addEventListener(DASHBOARD_SESSION_EXPIRED_EVENT, onSessionExpired as EventListener);

    return () => {
      window.removeEventListener(DASHBOARD_SESSION_EXPIRED_EVENT, onSessionExpired as EventListener);
    };
  }, [handleSessionExpired]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const payload = await dashboardGet<AdminMeApiResponse>("/api/v1/admin/me");

        if (cancelled) {
          return;
        }

        hasHandledSessionExpiryRef.current = false;
        setSession(createSessionSnapshotFromProfile(payload, initialSession.expiresAt));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSession(null);

        if (isDashboardSessionExpiredError(error)) {
          await handleSessionExpired(getErrorMessage(error, "Please sign in again to continue."));
          return;
        }

        toast({
          title: "Session refresh failed",
          description: getErrorMessage(error, "Please sign in again to continue."),
          variant: "error",
        });
        router.replace("/login");
        router.refresh();
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handleSessionExpired, initialSession.expiresAt, router, toast]);

  useEffect(() => {
    if (!session?.expiresAt) {
      setIsSessionPromptOpen(false);
      setSessionCountdownMs(0);
      return;
    }

    const expiresAt = new Date(session.expiresAt).getTime();

    if (Number.isNaN(expiresAt)) {
      return;
    }

    function openPromptIfNeeded() {
      const remaining = expiresAt - Date.now();

      if (remaining <= SESSION_WARNING_WINDOW_MS) {
        setSessionCountdownMs(Math.max(remaining, 0));
        setIsSessionPromptOpen(true);
      }
    }

    openPromptIfNeeded();

    if (expiresAt - Date.now() <= SESSION_WARNING_WINDOW_MS) {
      return;
    }

    const timeout = window.setTimeout(openPromptIfNeeded, Math.max(expiresAt - Date.now() - SESSION_WARNING_WINDOW_MS, 0));

    return () => {
      window.clearTimeout(timeout);
    };
  }, [session?.expiresAt]);

  useEffect(() => {
    if (!isSessionPromptOpen || !session?.expiresAt) {
      return;
    }

    const expiresAt = new Date(session.expiresAt).getTime();

    if (Number.isNaN(expiresAt)) {
      return;
    }

    function syncCountdown() {
      const remaining = Math.max(expiresAt - Date.now(), 0);
      setSessionCountdownMs(remaining);

      if (remaining === 0) {
        void handleSessionExpired("Your session timed out before the dashboard could be extended.");
      }
    }

    syncCountdown();

    const interval = window.setInterval(syncCountdown, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [handleSessionExpired, isSessionPromptOpen, session?.expiresAt]);

  const keepSessionAlive = useCallback(async () => {
    setIsExtendingSession(true);

    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => null)) as RefreshSessionApiResponse | { message?: string; error?: string } | null;

      if (!response.ok || !payload || !("session" in payload) || !("user" in payload) || !("expiresIn" in payload)) {
        throw new Error(getErrorMessage(payload, "We couldn't extend your session."));
      }

      hasHandledSessionExpiryRef.current = false;
      setSession(buildSessionSnapshotFromRefresh(payload, session?.permissions ?? []));
      setIsSessionPromptOpen(false);
      setSessionCountdownMs(0);
    } catch (refreshError) {
      await handleSessionExpired(getErrorMessage(refreshError, "We couldn't extend your session."));
    } finally {
      setIsExtendingSession(false);
    }
  }, [handleSessionExpired, session?.permissions]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      hasHandledSessionExpiryRef.current = false;
      setIsSessionPromptOpen(false);
      setSessionCountdownMs(0);
      setSession(null);
      router.replace("/login");
      router.refresh();
    }
  }, [router]);

  const value = useMemo(
    () => ({
      session,
      isRefreshing,
      refreshSession,
      logout,
    }),
    [isRefreshing, logout, refreshSession, session],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <Dialog open={isSessionPromptOpen} onOpenChange={() => undefined}>
        <DialogContent
          className="modal-card session-warning-dialog"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="modal-card__header">
            <DialogTitle>Still there?</DialogTitle>
          </div>
          <div className="modal-card__body session-warning-dialog__body">
            <DialogDescription>
              Your dashboard session is about to expire. Stay signed in to keep working without losing your place.
            </DialogDescription>
            <div className="session-warning-dialog__countdown">
              <span>Automatic sign-out in</span>
              <strong>{formatCountdown(sessionCountdownMs)}</strong>
            </div>
          </div>
          <div className="modal-card__footer session-warning-dialog__footer">
            <Button variant="secondary" onClick={() => void logout()} disabled={isExtendingSession}>
              Log out
            </Button>
            <Button variant="primary" onClick={() => void keepSessionAlive()} disabled={isExtendingSession}>
              {isExtendingSession ? "Extending..." : "Stay signed in"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
