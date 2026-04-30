import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDefaultDashboardPath, normalizeAdminRole } from "@/lib/auth/access-control";
import { getSessionSnapshotFromCookieStore, isAdminSnapshot } from "@/lib/auth/session";

export default async function Home() {
  const snapshot = await getSessionSnapshotFromCookieStore(await cookies());

  if (snapshot && isAdminSnapshot(snapshot)) {
    redirect(getDefaultDashboardPath(normalizeAdminRole(snapshot.session.adminRole), snapshot.permissions));
  }

  redirect("/login");
}
