import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getDefaultDashboardPath, normalizeAdminRole } from "@/lib/auth/access-control";
import { getSessionSnapshotFromCookieStore, isAdminSnapshot } from "@/lib/auth/session";

export default async function LoginPage() {
  const snapshot = await getSessionSnapshotFromCookieStore(await cookies());

  if (snapshot && isAdminSnapshot(snapshot)) {
    redirect(getDefaultDashboardPath(normalizeAdminRole(snapshot.session.adminRole), snapshot.permissions));
  }

  return (
    <main className="auth-page px-4 py-10">
      <div className="auth-card-shell mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[1080px] overflow-hidden rounded-[32px] border border-[var(--border)] shadow-[var(--shadow)]">
        <section className="auth-card-hero hidden flex-1 px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="m-0 text-sm font-semibold uppercase sm:text-[15px] text-white/72">Fortsolar Admin</p>


            <h1 className="m-0 pt-5 text-4xl font-extrabold leading-[1.02] sm:text-[42px] lg:text-[52px]">
              Powering solar
              <br />
              operations at scale.
            </h1>
            <p className="m-0 max-w-[420px] pt-5 text-base text-white/82">
              Oversee customer requests, product inventory, package sales, payments, and installer delivery from a secure Fortsolar workspace.
            </p>
          </div>
          <div className="auth-card-hero-note rounded-[24px] border p-6 text-sm text-white/82">
            Track daily operations, approve requests, and keep the Fortsolar catalogue organized.
          </div>
        </section>

        <section className="auth-card-form flex w-full flex-col justify-center px-6 py-10 sm:px-10 lg:w-[440px]">
          <div className="mb-8">
            <p className="brand-mark" aria-label="Fortsolar">
              <span className="brand-mark__icon" aria-hidden="true">
                <Image src="/favicon.ico" alt="" fill sizes="40px" />
              </span>
            </p>
            <p className="m-0 text-sm font-semibold uppercase sm:text-[15px] text-[var(--brand)]">Welcome back</p>
            <h2 className="m-0 pt-3 text-3xl font-extrabold sm:text-[36px]">Sign in to the admin panel</h2>
            <p className="m-0 pt-3 text-sm text-[var(--text-soft)]">Enter your admin credentials to continue.</p>
          </div>

          <LoginForm />
        </section>
      </div>
    </main>
  );
}
