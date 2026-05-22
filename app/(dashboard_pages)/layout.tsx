import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/dashboard/app-shell";
import { MutationConfirmationProvider } from "@/components/dashboard/mutation-confirmation-provider";
import { NotificationsProvider } from "@/components/dashboard/notifications-provider";
import { getSessionSnapshotFromCookieStore, isAdminSnapshot } from "@/lib/auth/session";
import { getOneSignalConfig } from "@/lib/onesignal.server";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const snapshot = await getSessionSnapshotFromCookieStore(await cookies());
  const oneSignalConfig = getOneSignalConfig();

  if (!snapshot || !isAdminSnapshot(snapshot)) {
    redirect("/login");
  }

  return (
    <AuthProvider initialSession={snapshot}>
      <MutationConfirmationProvider>
        <NotificationsProvider oneSignalConfig={oneSignalConfig}>
          <AppShell>{children}</AppShell>
        </NotificationsProvider>
      </MutationConfirmationProvider>
    </AuthProvider>
  );
}
