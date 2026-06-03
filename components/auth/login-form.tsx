"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useFormSubmission } from "@/components/dashboard/form-submitter";
import { Button } from "@/components/dashboard/ui";
import { getDefaultDashboardPath, normalizeAdminRole } from "@/lib/auth/access-control";
import type { LoginApiResponse } from "@/types/api.types";

type LoginResponse = LoginApiResponse & {
  permissions?: string[];
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { isSubmitting, submit } = useFormSubmission<{ email: string; password: string }, LoginResponse>({
    endpoint: "/api/auth/login",
    successTitle: "Signed in",
    successMessage: (payload) => `Welcome back, ${payload.user.fullName}.`,
    errorTitle: "Sign-in failed",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const payload = await submit({ email, password });
      router.replace(getDefaultDashboardPath(normalizeAdminRole(payload.session.adminRole), payload.permissions ?? []));
      router.refresh();
    } catch {
      return;
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Email address</label>
        <input
          className="dashboard-input"
          placeholder="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Password</label>
        <input
          className="dashboard-input"
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <Button type="submit" variant="primary" className="mt-2 w-full" disabled={isSubmitting}>
        {isSubmitting ? "Signing In..." : "Sign In"}
      </Button>
    </form>
  );
}
