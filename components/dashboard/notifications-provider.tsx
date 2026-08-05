"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Modal } from "@/components/dashboard/modals";
import { Button } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { dashboardGet } from "@/lib/api/client";
import { getNotifications, updateNotification } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import { ONE_SIGNAL_PAGE_SCRIPT_SRC, ONE_SIGNAL_UPDATER_WORKER_PATH, ONE_SIGNAL_WORKER_PATH, type OneSignalConfig } from "@/lib/onesignal";
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
  browserNotificationStatus: BrowserNotificationStatus;
  isPermissionSubmitting: boolean;
  refresh: () => Promise<void>;
  refreshBrowserNotificationStatus: () => Promise<void>;
  openBrowserNotificationsPrompt: () => void;
  requestBrowserNotifications: () => Promise<void>;
  markRead: (id: string, isRead: boolean) => Promise<void>;
};

type BrowserNotificationPermission = NotificationPermission | "unsupported" | "unknown";
type BrowserNotificationInitState = "idle" | "ready" | "failed";

type BrowserNotificationStatus = {
  isConfigured: boolean;
  isSupported: boolean;
  permission: BrowserNotificationPermission;
  isOptedIn: boolean;
  subscriptionId: string | null;
  initState: BrowserNotificationInitState;
  notifyButtonEnabled: boolean;
};

type OneSignalPushSubscriptionState = {
  id: string | null;
  token: string | null;
  optedIn: boolean;
};

type OneSignalPushSubscriptionChangeEvent = {
  previous: OneSignalPushSubscriptionState;
  current: OneSignalPushSubscriptionState;
};

type OneSignalPushSubscriptionChangeHandler = (event: OneSignalPushSubscriptionChangeEvent) => void;
type OneSignalPermissionChangeHandler = () => void;

type OneSignalClient = {
  init: (config: Record<string, unknown>) => Promise<void>;
  Notifications?: {
    requestPermission?: (fallbackToSettings?: boolean) => Promise<void>;
    isPushSupported?: () => boolean | Promise<boolean>;
    permission?: boolean;
    addEventListener?: (eventName: "permissionChange", handler: OneSignalPermissionChangeHandler) => void;
    removeEventListener?: (eventName: "permissionChange", handler: OneSignalPermissionChangeHandler) => void;
  };
  User?: {
    PushSubscription?: {
      id?: string | null;
      optedIn?: boolean;
      addEventListener?: (eventName: "change", handler: OneSignalPushSubscriptionChangeHandler) => void;
      removeEventListener?: (eventName: "change", handler: OneSignalPushSubscriptionChangeHandler) => void;
    };
  };
};

type OneSignalWindow = Window & {
  OneSignalDeferred?: Array<(oneSignal: OneSignalClient) => void>;
};

type NotificationMutation =
  | {
      kind: "delete";
      id: string;
    }
  | {
      kind: "upsert";
      notification: NotificationRecord;
    };

const NotificationsContext = createContext<NotificationsContextValue | null>(null);
const HEADER_LIMIT = 8;
const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const notificationPermissionStorageKey = "fortsolar:onesignal-permission-choice";

function getBrowserPermissionState(): BrowserNotificationPermission {
  if (typeof window === "undefined") {
    return "unknown";
  }

  if (!("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

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

function normalizeIncomingMutation(payload: unknown): NotificationMutation | null {
  if (isRecord(payload) && "data" in payload) {
    return normalizeIncomingMutation(payload.data);
  }

  if (!isRecord(payload)) {
    return null;
  }

  const deleted = asBoolean(payload.deleted);
  const id = asString(payload.id);

  if (deleted && id) {
    return { kind: "delete", id };
  }

  const title = asString(payload.title);
  const message = asString(payload.message) ?? asString(payload.description);

  if (!title || !message) {
    return null;
  }

  return {
    kind: "upsert",
    notification: {
      id: id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`),
      user_id: asString(payload.user_id),
      type: asString(payload.type) ?? "system",
      title,
      message,
      link: asString(payload.link),
      is_read: asBoolean(payload.is_read),
      metadata: asObject(payload.metadata),
      created_at: asString(payload.created_at) ?? new Date().toISOString(),
      updated_at: asString(payload.updated_at) ?? new Date().toISOString(),
    },
  };
}

function mergeNotifications(current: NotificationRecord[], incoming: NotificationRecord) {
  const next = [incoming, ...current.filter((item) => item.id !== incoming.id)];
  return next.slice(0, HEADER_LIMIT);
}

function removeNotification(current: NotificationRecord[], id: string) {
  return current.filter((item) => item.id !== id);
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

function showSubscriptionConfirmationNotification() {
  showDesktopNotification({
    id: "fortsolar-notification-subscription-success",
    user_id: null,
    type: "system",
    title: "Fortsolar Admin Notifications Enabled",
    message: "Thank you for subscribing to notifications from the Fortsolar Admin Panel.",
    link: "/notifications",
    is_read: false,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export function NotificationsProvider({ children, oneSignalConfig }: { children: ReactNode; oneSignalConfig: OneSignalConfig }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const oneSignalAppId = oneSignalConfig.appId;
  const oneSignalSafariWebId = oneSignalConfig.safariWebId;
  const oneSignalNotifyButtonEnabled = oneSignalConfig.notifyButtonEnabled;
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedVersion, setFeedVersion] = useState(0);
  const [permissionPromptOpen, setPermissionPromptOpen] = useState(false);
  const [isPermissionSubmitting, setIsPermissionSubmitting] = useState(false);
  const [browserNotificationStatus, setBrowserNotificationStatus] = useState<BrowserNotificationStatus>(() => ({
    isConfigured: Boolean(oneSignalAppId),
    isSupported: typeof window !== "undefined" && "Notification" in window,
    permission: getBrowserPermissionState(),
    isOptedIn: false,
    subscriptionId: null,
    initState: "idle",
    notifyButtonEnabled: oneSignalNotifyButtonEnabled,
  }));
  const socketRef = useRef<Socket | null>(null);
  const announcedIdsRef = useRef<Set<string>>(new Set());
  const oneSignalRef = useRef<OneSignalClient | null>(null);
  const oneSignalInitPromiseRef = useRef<Promise<boolean> | null>(null);

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

  const ensureOneSignalReady = useCallback(async () => {
    if (typeof window === "undefined" || !oneSignalAppId) {
      return false;
    }

    if (oneSignalRef.current) {
      return true;
    }

    if (oneSignalInitPromiseRef.current) {
      return oneSignalInitPromiseRef.current;
    }

    oneSignalInitPromiseRef.current = new Promise<boolean>((resolve) => {
      const win = window as OneSignalWindow;

      if (!win.OneSignalDeferred) {
        win.OneSignalDeferred = [];
      }

      let settled = false;

      const finish = (value: boolean) => {
        if (settled) {
          return;
        }

        settled = true;

        if (!value) {
          oneSignalRef.current = null;
          oneSignalInitPromiseRef.current = null;
        }

        resolve(value);
      };

      win.OneSignalDeferred.push(async (oneSignal) => {
        try {
          const initConfig: Record<string, unknown> = {
            appId: oneSignalAppId,
            allowLocalhostAsSecureOrigin: process.env.NODE_ENV === "development",
            serviceWorkerPath: ONE_SIGNAL_WORKER_PATH,
            serviceWorkerUpdaterPath: ONE_SIGNAL_UPDATER_WORKER_PATH,
            notifyButton: { enable: oneSignalNotifyButtonEnabled },
          };

          if (oneSignalSafariWebId) {
            initConfig.safari_web_id = oneSignalSafariWebId;
          }

          oneSignalRef.current = oneSignal;
          await oneSignal.init(initConfig);
          finish(true);
        } catch {
          finish(false);
        }
      });

      const existingScript = document.getElementById("onesignal-sdk") as HTMLScriptElement | null;

      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "onesignal-sdk";
        script.src = ONE_SIGNAL_PAGE_SCRIPT_SRC;
        script.defer = true;
        script.onerror = () => finish(false);
        document.body.appendChild(script);
      }
    });

    return oneSignalInitPromiseRef.current;
  }, [oneSignalAppId, oneSignalNotifyButtonEnabled, oneSignalSafariWebId]);

  const syncBrowserNotificationStatus = useCallback(
    async (oneSignal: OneSignalClient | null = oneSignalRef.current, initState?: BrowserNotificationInitState) => {
      const permission = getBrowserPermissionState();
      const baseStatus: BrowserNotificationStatus = {
        isConfigured: Boolean(oneSignalAppId),
        isSupported: permission !== "unsupported",
        permission,
        isOptedIn: false,
        subscriptionId: null,
        initState: initState ?? (oneSignal ? "ready" : "idle"),
        notifyButtonEnabled: oneSignalNotifyButtonEnabled,
      };

      if (!oneSignal) {
        setBrowserNotificationStatus(baseStatus);
        return;
      }

      try {
        const isSupported = await Promise.resolve(oneSignal.Notifications?.isPushSupported?.() ?? baseStatus.isSupported);

        setBrowserNotificationStatus({
          ...baseStatus,
          isSupported: Boolean(isSupported),
          isOptedIn: Boolean(oneSignal.User?.PushSubscription?.optedIn),
          subscriptionId: oneSignal.User?.PushSubscription?.id ?? null,
          initState: initState ?? "ready",
        });
      } catch {
        setBrowserNotificationStatus({
          ...baseStatus,
          initState: initState ?? "failed",
        });
      }
    },
    [oneSignalAppId, oneSignalNotifyButtonEnabled],
  );

  const refreshBrowserNotificationStatus = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    if (!oneSignalAppId || !("Notification" in window)) {
      await syncBrowserNotificationStatus(null, "idle");
      return;
    }

    const ready = await ensureOneSignalReady();
    await syncBrowserNotificationStatus(ready ? oneSignalRef.current : null, ready ? "ready" : "failed");
  }, [ensureOneSignalReady, oneSignalAppId, syncBrowserNotificationStatus]);

  const openBrowserNotificationsPrompt = useCallback(() => {
    setPermissionPromptOpen(true);
  }, []);

  const requestBrowserNotifications = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    setIsPermissionSubmitting(true);

    try {
      const ready = await ensureOneSignalReady();

      if (!ready) {
        throw new Error("OneSignal could not be initialized.");
      }

      await oneSignalRef.current?.Notifications?.requestPermission?.(true);
      await syncBrowserNotificationStatus(oneSignalRef.current, "ready");

      if (Notification.permission === "granted") {
        window.localStorage.setItem(notificationPermissionStorageKey, "accepted");
        showSubscriptionConfirmationNotification();
        toast({
          title: "Browser notifications enabled",
          description: "Real-time admin notifications will now be delivered to this browser.",
          variant: "success",
        });
      } else if (Notification.permission === "denied") {
        window.localStorage.setItem(notificationPermissionStorageKey, "declined");
        toast({
          title: "Permission blocked",
          description: "Browser notifications are blocked for this site. Update your browser site settings to test the prompt again.",
          variant: "info",
        });
      } else {
        window.localStorage.removeItem(notificationPermissionStorageKey);
        toast({
          title: "Permission not granted",
          description: "Browser notification settings were opened so you can enable notifications manually.",
          variant: "info",
        });
      }
    } catch {
      window.localStorage.removeItem(notificationPermissionStorageKey);
      await syncBrowserNotificationStatus(null, "failed");
      toast({
        title: "Notification setup failed",
        description: "OneSignal could not be initialized for this browser session.",
        variant: "error",
      });
    } finally {
      setPermissionPromptOpen(false);
      setIsPermissionSubmitting(false);
    }
  }, [ensureOneSignalReady, syncBrowserNotificationStatus, toast]);

  const handleIncoming = useCallback(
    (payload: unknown, announce = false) => {
      const mutation = normalizeIncomingMutation(payload);

      if (!mutation) {
        return;
      }

      setNotifications((current) =>
        mutation.kind === "delete"
          ? removeNotification(current, mutation.id)
          : mergeNotifications(current, mutation.notification),
      );
      setFeedVersion((current) => current + 1);
      void refresh();

      if (mutation.kind === "upsert" && announce && !announcedIdsRef.current.has(mutation.notification.id)) {
        announcedIdsRef.current.add(mutation.notification.id);
        toast({
          title: mutation.notification.title,
          description: mutation.notification.message,
          variant: "info",
        });
        showDesktopNotification(mutation.notification);
      }
    },
    [refresh, toast],
  );

  const markRead = useCallback(async (id: string, isRead: boolean) => {
    await updateNotification(id, { is_read: isRead }, { confirmation: false });
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
    if (typeof window === "undefined" || !session || !oneSignalAppId || !("Notification" in window)) {
      void syncBrowserNotificationStatus(null, "idle");
      return;
    }

    if (Notification.permission === "granted") {
      window.localStorage.setItem(notificationPermissionStorageKey, "accepted");
      void ensureOneSignalReady();
      void syncBrowserNotificationStatus(oneSignalRef.current, oneSignalRef.current ? "ready" : "idle");
      return;
    }

    if (Notification.permission === "denied") {
      window.localStorage.setItem(notificationPermissionStorageKey, "declined");
      void syncBrowserNotificationStatus(oneSignalRef.current, oneSignalRef.current ? "ready" : "idle");
      return;
    }

    void syncBrowserNotificationStatus(oneSignalRef.current, oneSignalRef.current ? "ready" : "idle");

    if (!window.localStorage.getItem(notificationPermissionStorageKey)) {
      setPermissionPromptOpen(true);
    }
  }, [ensureOneSignalReady, oneSignalAppId, session, syncBrowserNotificationStatus]);

  useEffect(() => {
    if (typeof window === "undefined" || !session || !oneSignalAppId || !("Notification" in window)) {
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const ready = await ensureOneSignalReady();

      if (cancelled) {
        return;
      }

      const oneSignal = ready ? oneSignalRef.current : null;
      await syncBrowserNotificationStatus(oneSignal, ready ? "ready" : "failed");

      if (!oneSignal) {
        return;
      }

      const handlePermissionChange: OneSignalPermissionChangeHandler = () => {
        void syncBrowserNotificationStatus(oneSignal, "ready");
      };
      const handlePushSubscriptionChange: OneSignalPushSubscriptionChangeHandler = () => {
        void syncBrowserNotificationStatus(oneSignal, "ready");
      };

      oneSignal.Notifications?.addEventListener?.("permissionChange", handlePermissionChange);
      oneSignal.User?.PushSubscription?.addEventListener?.("change", handlePushSubscriptionChange);

      const handleWindowFocus = () => {
        void syncBrowserNotificationStatus(oneSignalRef.current, oneSignalRef.current ? "ready" : "idle");
      };

      window.addEventListener("focus", handleWindowFocus);

      cleanup = () => {
        oneSignal.Notifications?.removeEventListener?.("permissionChange", handlePermissionChange);
        oneSignal.User?.PushSubscription?.removeEventListener?.("change", handlePushSubscriptionChange);
        window.removeEventListener("focus", handleWindowFocus);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [ensureOneSignalReady, oneSignalAppId, session, syncBrowserNotificationStatus]);

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
          path: payload.data.socketPath,
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

  function handleDismissBrowserNotifications() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(notificationPermissionStorageKey, "declined");
    }

    void syncBrowserNotificationStatus(oneSignalRef.current, oneSignalRef.current ? "ready" : "idle");
    setPermissionPromptOpen(false);
  }

  const value = useMemo(
    () => ({
      notifications,
      headerItems: notifications.map(mapHeaderNotification),
      unreadCount: notifications.filter((item) => !item.is_read).length,
      isLoading,
      error,
      feedVersion,
      browserNotificationStatus,
      isPermissionSubmitting,
      refresh,
      refreshBrowserNotificationStatus,
      openBrowserNotificationsPrompt,
      requestBrowserNotifications,
      markRead,
    }),
    [
      browserNotificationStatus,
      error,
      feedVersion,
      isLoading,
      isPermissionSubmitting,
      markRead,
      notifications,
      openBrowserNotificationsPrompt,
      refresh,
      refreshBrowserNotificationStatus,
      requestBrowserNotifications,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}

      <Modal
        open={permissionPromptOpen}
        onClose={handleDismissBrowserNotifications}
        title="Enable Browser Notifications"
        footer={
          <>
            <Button variant="secondary" onClick={handleDismissBrowserNotifications} disabled={isPermissionSubmitting}>
              Not Now
            </Button>
            <Button variant="primary" onClick={() => void requestBrowserNotifications()} disabled={isPermissionSubmitting}>
              {isPermissionSubmitting ? "Enabling..." : "Allow Notifications"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm text-[var(--text-soft)]">
          <p className="m-0">
            Allow Fortsolar to send real-time browser notifications for new admin alerts and account activity.
          </p>
          <p className="m-0">
            In-app notifications will still appear on your profile and inside the dashboard even if you skip this step.
          </p>
        </div>
      </Modal>
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider.");
  }

  return context;
}
