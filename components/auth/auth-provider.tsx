"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { dashboardGet } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { createSessionSnapshotFromProfile } from "@/lib/auth/session";
import type { AdminMeApiResponse, SessionSnapshot } from "@/types/api.types";
import { useToast } from "@/components/ui/toast";

type AuthContextValue = {
  session: SessionSnapshot | null;
  isRefreshing: boolean;
  refreshSession: () => Promise<SessionSnapshot | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, initialSession }: { children: ReactNode; initialSession: SessionSnapshot }) {
  const router = useRouter();
  const { toast } = useToast();
  const [session, setSession] = useState<SessionSnapshot | null>(initialSession);
  const [isRefreshing, setIsRefreshing] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const payload = await dashboardGet<AdminMeApiResponse>("/api/v1/admin/me");
      const nextSession = createSessionSnapshotFromProfile(payload, session?.expiresAt ?? null);
      setSession(nextSession);
      return nextSession;
    } catch (error) {
      setSession(null);
      throw error;
    }
  }, [session?.expiresAt]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const payload = await dashboardGet<AdminMeApiResponse>("/api/v1/admin/me");

        if (cancelled) {
          return;
        }

        setSession(createSessionSnapshotFromProfile(payload, initialSession.expiresAt));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSession(null);
        toast({
          title: "Session expired",
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
  }, [initialSession.expiresAt, router, toast]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
