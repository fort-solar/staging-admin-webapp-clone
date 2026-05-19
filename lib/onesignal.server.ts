import "server-only";

import type { OneSignalConfig } from "@/lib/onesignal";

function isTruthy(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function readOneSignalValue(serverKey: "ONESIGNAL_APP_ID" | "ONESIGNAL_SAFARI_WEB_ID", publicKey: "NEXT_PUBLIC_ONESIGNAL_APP_ID" | "NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID") {
  const value = process.env.NODE_ENV === "production" ? process.env[publicKey] : process.env[serverKey];
  return value?.trim() ?? "";
}

export function getOneSignalConfig(): OneSignalConfig {
  const notifyButtonValue =
    (process.env.NODE_ENV === "production"
      ? process.env.NEXT_PUBLIC_ONESIGNAL_NOTIFY_BUTTON
      : process.env.ONESIGNAL_NOTIFY_BUTTON ?? process.env.NEXT_PUBLIC_ONESIGNAL_NOTIFY_BUTTON) ?? "";

  return {
    appId: readOneSignalValue("ONESIGNAL_APP_ID", "NEXT_PUBLIC_ONESIGNAL_APP_ID"),
    safariWebId: readOneSignalValue("ONESIGNAL_SAFARI_WEB_ID", "NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID"),
    notifyButtonEnabled: isTruthy(notifyButtonValue),
  };
}
