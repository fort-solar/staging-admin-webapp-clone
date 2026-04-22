import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="auth-page px-4 py-10">
      <div className="auth-card-shell mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[1080px] overflow-hidden rounded-[32px] border border-[var(--border)] shadow-[var(--shadow)]">
        <section className="auth-card-hero hidden flex-1 px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="m-0 text-[15px] font-semibold uppercase tracking-[0.24em] text-white/72">Fortsolar Admin</p>
            <h1 className="m-0 pt-5 text-[52px] font-extrabold leading-[1.02] tracking-[-0.06em]">
              Cleaner admin flows
              <br />
              for every team.
            </h1>
            <p className="m-0 max-w-[420px] pt-5 text-base text-white/82">
              The dashboard shell, tables, cards, and interactions are now aligned so future screens can extend from one design system.
            </p>
          </div>
          <div className="auth-card-hero-note rounded-[24px] border p-6 text-sm text-white/82">
            Search, menus, tabs, status updates, modals, queue approvals, and sidebar collapse are wired and ready to continue.
          </div>
        </section>

        <section className="auth-card-form flex w-full flex-col justify-center px-6 py-10 sm:px-10 lg:w-[440px]">
          <div className="mb-8">
            <p className="m-0 text-[15px] font-semibold uppercase tracking-[0.22em] text-[var(--brand)]">Welcome back</p>
            <h2 className="m-0 pt-3 text-[36px] font-extrabold tracking-[-0.05em]">Sign in to the admin panel</h2>
            <p className="m-0 pt-3 text-sm text-[var(--text-soft)]">Use this temporary auth screen to enter the redesigned dashboard.</p>
          </div>

          <form className="flex flex-col gap-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Email address</label>
              <input className="dashboard-input" defaultValue="admin@fortsolar.com" placeholder="Email address" type="email" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Password</label>
              <input className="dashboard-input" defaultValue="fortsolar-admin" placeholder="Password" type="password" />
            </div>
            <Link href="/dashboard" className="action-button is-primary is-md mt-2 w-full">
              <span>Sign In</span>
            </Link>
          </form>
        </section>
      </div>
    </main>
  );
}
