"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/ui/toast";
import { dashboardGet } from "@/lib/api/client";
import { getNotifications, updateNotification } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import type { NotificationRecord, SocketSessionApiResponse } from "@/types/api.types";

type HeaderNotificationItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  tone: "warning" | "success" | "info" | "neutral";
  link: string | null;
  isRead: boolean;
};

type NotificationsContextValue = {
  notifications: NotificationRecord[];
  headerItems: HeaderNotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  feedVersion: number;
  refresh: () => Promise<void>;
  markRead: (id: string, isRead: boolean) => Promise<void>;
};

type OneSignalWindow = Window & {
  OneSignalDeferred?: Array<(oneSignal: { init: (config: Record<string, unknown>) => Promise<void>; Notifications?: { requestPermission?: () => Promise<void> } }) => void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);
const HEADER_LIMIT = 8;
const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const oneSignalAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function asObject(value: unknown) {
  return isRecord(value) ? value : {};
}

function normalizeIncomingNotification(payload: unknown): NotificationRecord | null {
  if (isRecord(payload) && "data" in payload) {
    return normalizeIncomingNotification(payload.data);
  }

  if (!isRecord(payload)) {
    return null;
  }

  const id = asString(payload.id) ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`);
  const title = asString(payload.title);
  const message = asString(payload.message) ?? asString(payload.description);

  if (!title || !message) {
    return null;
  }

  return {
    id,
    user_id: asString(payload.user_id),
    type: asString(payload.type) ?? "system",
    title,
    message,
    link: asString(payload.link),
    is_read: asBoolean(payload.is_read),
    metadata: asObject(payload.metadata),
    created_at: asString(payload.created_at) ?? new Date().toISOString(),
    updated_at: asString(payload.updated_at) ?? new Date().toISOString(),
  };
}

function mergeNotifications(current: NotificationRecord[], incoming: NotificationRecord) {
  const next = [incoming, ...current.filter((item) => item.id !== incoming.id)];
  return next.slice(0, HEADER_LIMIT);
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Just now";
  }

  const diffMs = timestamp - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  if (Math.abs(diffMinutes) < 60) {
    return relativeTimeFormatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (Math.abs(diffHours) < 24) {
    return relativeTimeFormatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return relativeTimeFormatter.format(diffDays, "day");
}

function notificationTone(record: NotificationRecord): HeaderNotificationItem["tone"] {
  if (!record.is_read) {
    return "warning";
  }

  if (record.type.toLowerCase().includes("success")) {
    return "success";
  }

  if (record.type.toLowerCase().includes("system")) {
    return "info";
  }

  return "neutral";
}

function mapHeaderNotification(record: NotificationRecord): HeaderNotificationItem {
  return {
    id: record.id,
    title: record.title,
    description: record.message,
    time: formatRelativeTime(record.created_at),
    tone: notificationTone(record),
    link: record.link,
    isRead: record.is_read,
  };
}

function showDesktopNotification(record: NotificationRecord) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const desktop = new Notification(record.title, {
    body: record.message,
    tag: record.id,
  });

  if (record.link) {
    desktop.onclick = () => {
      window.focus();
      window.location.assign(record.link ?? "/notifications");
    };
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedVersion, setFeedVersion] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const announcedIdsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setError(null);

    try {
      const payload = await getNotifications({ page: 1, limit: HEADER_LIMIT });
      setNotifications(payload.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Notifications could not be loaded."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleIncoming = useCallback(
    (payload: unknown, announce = false) => {
      const nextNotification = normalizeIncomingNotification(payload);

      if (!nextNotification) {
        return;
      }

      setNotifications((current) => mergeNotifications(current, nextNotification));
      setFeedVersion((current) => current + 1);

      if (announce && !announcedIdsRef.current.has(nextNotification.id)) {
        announcedIdsRef.current.add(nextNotification.id);
        toast({
          title: nextNotification.title,
          description: nextNotification.message,
          variant: "info",
        });
        showDesktopNotification(nextNotification);
      }
    },
    [toast],
  );

  const markRead = useCallback(async (id: string, isRead: boolean) => {
    await updateNotification(id, { is_read: isRead });
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, is_read: isRead, updated_at: new Date().toISOString() } : item)),
    );
    setFeedVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!session) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    void refresh();
  }, [refresh, session]);

  useEffect(() => {
    if (typeof window === "undefined" || !oneSignalAppId) {
      return;
    }

    const win = window as OneSignalWindow;

    if (!win.OneSignalDeferred) {
      win.OneSignalDeferred = [];
    }

    if (!document.getElementById("onesignal-sdk")) {
      const script = document.createElement("script");
      script.id = "onesignal-sdk";
      script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      script.async = true;
      document.body.appendChild(script);
    }

    win.OneSignalDeferred.push(async (oneSignal) => {
      try {
        await oneSignal.init({
          appId: oneSignalAppId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
          notifyButton: { enable: false },
        });

        const permissionKey = "fortsolar:onesignal-prompted";

        if (!window.localStorage.getItem(permissionKey)) {
          window.localStorage.setItem(permissionKey, "true");
          await oneSignal.Notifications?.requestPermission?.();
        }
      } catch {
        // Ignore OneSignal init failures and keep in-app notifications active.
      }
    });
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const payload = await dashboardGet<SocketSessionApiResponse>("/api/auth/socket-session");

        if (cancelled) {
          return;
        }

        const socket = io(payload.data.socketUrl, {
          transports: ["websocket", "polling"],
          auth: {
            token: payload.data.accessToken,
          },
          withCredentials: true,
        });

        socketRef.current = socket;
        const subscribedEvents = new Set(payload.data.eventNames);

        payload.data.eventNames.forEach((eventName) => {
          socket.on(eventName, (eventPayload: unknown) => {
            handleIncoming(eventPayload, true);
          });
        });

        socket.onAny((eventName, eventPayload) => {
          if (typeof eventName === "string" && eventName.toLowerCase().includes("notification") && !subscribedEvents.has(eventName)) {
            handleIncoming(eventPayload, true);
          }
        });
      } catch {
        // Keep polling fallback active even if the realtime bridge cannot connect.
      }
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [handleIncoming, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [refresh, session]);

  const value = useMemo(
    () => ({
      notifications,
      headerItems: notifications.map(mapHeaderNotification),
      unreadCount: notifications.filter((item) => !item.is_read).length,
      isLoading,
      error,
      feedVersion,
      refresh,
      markRead,
    }),
    [error, feedVersion, isLoading, markRead, notifications, refresh],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider.");
  }

  return context;
}
