# Fortsolar backend API handover

Status: frontend integration contract for soft-launch UAT (1 August 2026).

## Shared conventions

- Base URL comes from each app's public/server API environment setting.
- JSON responses use `{ "success": true, "data": ... }`; failures use a stable HTTP status plus `{ "success": false, "message": "...", "errors"?: ... }`.
- Protected calls use `Authorization: Bearer <access-token>`. Refresh/session behavior must be consistent across Store, Installer and Admin.
- IDs are opaque strings. Dates are ISO-8601 UTC. Money is integer NGN (or minor units where explicitly named `amount_kobo`).
- Uploads use `multipart/form-data`. The API returns metadata and a short-lived download URL, never an R2 secret or permanent private-object URL.
- List endpoints accept `page`, `limit`, `search`, `status`, `sort`, and relevant filters, and return `items`, `page`, `limit`, `total`, `total_pages`.
- Mutations should accept `Idempotency-Key`, especially registration, checkout initialization, payment verification and status changes.

## Release-blocking flows

### Customer registration and email verification

`POST /api/v1/auth/customers/register`

```json
{ "name": "Ada Customer", "email": "ada@example.com", "phone": "+2348000000000", "password": "..." }
```

Return `201` without exposing whether a pre-existing account is active. Send a one-use, expiring email link to the configured Store origin: `/verify-email?token=...`. `POST /api/v1/auth/verify-email` accepts `{ "token": "..." }`, marks the account verified, and returns the safe post-verification redirect `/login?verified=1`. Reuse returns a deterministic `409`; expiry returns `410` and supports `POST /api/v1/auth/resend-verification`.

### Installer registration, onboarding and verification

`POST /api/v1/auth/installers/register` accepts name, email, phone, password and optional business name. Email verification follows the same contract with the Installer origin.

`POST /api/v1/installers/onboarding` is multipart and accepts:

- `id_file` (required government-issued ID)
- `certificate_file` (optional; maximum one)
- bank account name, number and bank name
- service areas (multiple state/city pairs)
- installation types (multi-select)
- address/profile fields

Return a submission ID, `pending` status and document metadata. The submission must appear in `GET /api/v1/admin/verification/submissions?status=pending`. Admin decisions use `PATCH /api/v1/admin/verification/submissions/{id}` with `{ "status": "approved|rejected", "reason": "..." }`. Rejection reason is required. Rejected identity objects must be deleted from R2 after any required audit retention step; the customer-facing API must no longer return a download URL.

### Secure R2 upload contract

Uploads may be proxied or presigned. Store private KYC objects under a non-public prefix such as `kyc/{installer_id}/{submission_id}/...`; validate MIME type, extension and size server-side; record checksum, object key, uploader, and timestamp. `GET /api/v1/admin/verification/submissions/{id}/documents/{document_id}/download` returns a short-lived signed URL or streams the object after authorization. Product/project/blog images are public CDN assets and must return absolute HTTPS URLs. Never return R2 credentials.

### Calculator

- `GET /calculator/catalog?q=fan` returns `matches` with `key`, `name`, `category`, `watts`, `surgeMultiplier`, `inductive`, and `search_aliases`.
- `POST /calculator/calculate` accepts `appliances[]` with `name`, `quantity`, `wattage`, `hoursPerDay`, `nightBackup`, and `inductive`.
- Return `totalLoadW`, `totalLoadKw`, daily Wh/kWh, `recommendedInverterKw`, `recommendedBatteryKwh`, `recommendedPvKwp`, and optional rounded `display` values.

The backend is authoritative. Publish the agreed formula/version in the response (for example `formulaVersion`) and add golden-vector tests. Night-backup energy must affect battery sizing; inductive surge must affect inverter sizing. Current frontend fallback values are only display fallbacks and must not be treated as the specification.

### Checkout and Paystack

`POST /api/v1/customer/orders/checkout` validates server-side prices, delivery and inventory, creates one pending order, and returns `order_id`, `reference`, `amount_kobo`, `email`, `public_key`, and optional `authorization_url`.

`POST /api/v1/customer/payments/verify` accepts `{ "reference": "..." }`. The backend verifies directly with Paystack, checks reference, amount, currency and customer/order ownership, then atomically marks the transaction successful and order `awaiting_approval`. It must be idempotent. A signed Paystack webhook performs the same reconciliation if the browser callback is lost. Admin reads the result through `/api/v1/admin/orders/{id}` and `/api/v1/admin/transactions/`.

Do not accept a paid status from the browser. Live UAT should use the smallest valid product agreed by the business; do not run a live charge without explicit credentials and authorization.

## Financing

`GET/PATCH /api/v1/admin/settings/financing` manages a versioned configuration for:

```json
{
  "individual": { "minimum_down_payment_percent": 0, "interest_method": "flat", "annual_interest_rate_percent": 0, "tenures_months": [] },
  "salary_earner": { "minimum_down_payment_percent": 0, "interest_method": "reducing_balance", "annual_interest_rate_percent": 0, "tenures_months": [] },
  "business": { "minimum_down_payment_percent": 0, "interest_method": "reducing_balance", "annual_interest_rate_percent": 0, "tenures_months": [] }
}
```

Required documents:

- Individual: government ID, utility bill, 6–12 month recent bank statement.
- Salary earner: government ID, utility bill, 6–12 month salary-account statement; employment letter optional.
- Business/corporate: directors' government IDs, utility bill, 6–12 month business bank statement, CAC registration document.

`POST /api/v1/customer/financing/applications` accepts the order/package, applicant type, down-payment percent, tenure, and document IDs. Validate requirements and minimum down payment from the active configuration. Initial order status is `financing_in_progress`. Admin submission to a partner changes it to `awaiting_approval`. Store the exact settings version and computed estimate with the application.

## Orders and installations

Canonical order states are `pending`, `financing_in_progress`, `awaiting_approval`, `processing`, `installer_assigned`, `in_progress`, `done`, and `completed`. Expose role-specific labels in the frontend, not separate backend states. Every transition requires an append-only event with actor, timestamp, previous/new status and optional note. Reject invalid transitions with `409`.

Admin management uses `/api/v1/admin/orders/`; installer job-board and workflow endpoints live under `/api/v1/installers/jobs`; customer tracking lives under `/api/v1/customer/orders`. Completion proof changes a job/order to `done`; only authorized customer/admin acceptance changes it to `completed`.

## Content, catalog, delivery and exports

Existing frontend route families expect admin resources for `/products`, `/packages`, `/projects/`, `/blog/`, `/site-pages/`, `/jobs/`, `/appliances/`, `/quote-requests/`, `/transactions/`, `/customers/`, `/installers/`, `/admins/`, and `/installations/` under `/api/v1/admin`.

Public Landing endpoints must return published projects, blog posts with SEO fields/canonical slug, site pages and top products/packages. Admin delivery settings must support free-delivery state/city rules plus a global fallback charge. Export endpoints should return CSV with the same active filters as the corresponding table and enforce admin permissions.

## UAT evidence checklist

Record timestamp, environment, test account/order/submission IDs, request correlation ID, screenshots, expected result and actual result for each flow:

1. Customer register → email received → one-use verification → safe Store redirect.
2. Installer register → email verification → upload two test documents → Admin queue → secure download → reject/re-upload/approve.
3. Calculator golden vectors, including night-only and inductive loads, checked against the signed-off mathematical specification.
4. Product with multiple images uploaded in Admin → absolute CDN URLs render on mobile and from a second region/network.
5. Authorized small live Paystack checkout → popup → callback → direct backend verification → webhook reconciliation → Admin order and transaction status.
6. Financing application for all three applicant types, including missing-document and below-minimum-down-payment rejection cases.

## Current verification boundary

The repositories contain the frontend calls and screens, but a source review cannot prove email delivery, R2 persistence, global CDN rendering, a live Paystack settlement, or Admin visibility against a deployed backend. Those require deployed URLs, seeded catalog data, role accounts, inbox access, R2/Cloudflare observability, Paystack authorization and the signed-off calculator formula vectors.
