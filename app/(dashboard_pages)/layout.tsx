import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/dashboard/app-shell";
import { getSessionSnapshotFromCookieStore, isAdminSnapshot } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const snapshot = await getSessionSnapshotFromCookieStore(await cookies());

  if (!snapshot || !isAdminSnapshot(snapshot)) {
    redirect("/login");
  }

  return (
    <AuthProvider initialSession={snapshot}>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
