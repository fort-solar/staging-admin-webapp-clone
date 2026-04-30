import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDefaultDashboardPath, getUsersLandingPath, normalizeAdminRole } from "@/lib/auth/access-control";
import { getSessionSnapshotFromCookieStore } from "@/lib/auth/session";

export default async function UsersPage() {
  const snapshot = await getSessionSnapshotFromCookieStore(await cookies());
  const role = normalizeAdminRole(snapshot?.session.adminRole);
  const destination = getUsersLandingPath(role, snapshot?.permissions ?? []) ?? getDefaultDashboardPath(role, snapshot?.permissions ?? []);

  redirect(destination);
}
