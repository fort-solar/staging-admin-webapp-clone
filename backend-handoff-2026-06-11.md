# Fortsolar Backend Handoff

Date: 2026-06-11

This note captures the backend follow-up items from the June 11 audit, plus the frontend compensations already applied so the backend team can line up the server-side work cleanly.

## Frontend compensations already shipped

- Admin verification document previews now switch to `/api/v1/uploads/:id/download` when the stored file path uses an opaque storage URI such as `r2://...`.
- Admin appliance editing now calculates `monthly_kwh` client-side when the API returns `null`, so the UI no longer renders blank monthly usage values.
- Admin blog, site page, and project edit flows now preserve the existing slug by omitting slug mutation from update payloads.
- Store verify-email now exposes a sandbox bypass in non-production, or when `NEXT_PUBLIC_EMAIL_VERIFICATION_BYPASS` is enabled, so test users are not blocked when email delivery is intentionally disabled.

## Backend action items

### 1. Installer job start status sync

Problem:
When an installer starts a job, the job status moves to `in-progress`, but the linked bundle request remains at `installer_assigned`.

Backend change:
- Update the installer job start flow in `installerPortal.ts`.
- When a job transitions to `in-progress`, also update the linked bundle request status to `installer_in_transit`.
- Treat this as the source of truth so admin and customer portals stay in sync without frontend polling hacks.

### 2. Baseline schema sync

Problem:
`schema.sql` is behind the latest migrations and breaks clean bootstrap flows.

Backend change:
- Merge the missing structures from migrations `020` and `021` into the baseline schema.
- Reorder table creation so foreign keys resolve correctly on clean database creation.
- Ensure the baseline includes the newer project, quote asset, job link, and product price changes referenced in those migrations.

### 3. Appliance monthly usage calculation

Problem:
`appliances.monthly_kwh` is present in the database but is not consistently computed on create/update.

Backend change:
- Compute `monthly_kwh` in the appliance create and update path using:
  `(power_rating_watts * daily_hours_usage * 30) / 1000`
- Prefer server-side computation over frontend fallback so API responses remain complete for every consumer.

### 4. Optional improvement for email verification environments

Recommended backend improvement:
- Expose a clear capability flag for email delivery status, for example `email_delivery_enabled`, so the frontend can show or hide the bypass based on server truth instead of environment inference.
