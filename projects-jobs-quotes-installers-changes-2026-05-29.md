# Fortsolar Projects, Products, Package Lifecycle, Quote and Installer Changes

Date: May 29, 2026

Frontend sources:

- `components/dashboard/products-management.tsx`
- `components/dashboard/installations-management.tsx`
- `components/dashboard/jobs-management.tsx`
- `components/dashboard/energy-audit-management.tsx`
- `app/(dashboard_pages)/orders/bundle-requests/page.tsx`
- `components/features/pages/installer/InstallerOnboardingGate.tsx`
- `lib/admin-api.ts`
- `types/api.types.ts`
- `../fortsolar-store-webapp/lib/store-catalog.ts`
- `../fortsolar-landing-webapp/lib/projects-data.ts`

## Summary

The current round of frontend changes introduces four backend-facing updates:

1. Products now support multiple images.
2. The old installation-content surface is now treated as Projects content, with a reduced project form and auto-generated title/summary/slug fields.
3. Package requests and jobs now represent one connected installation lifecycle.
4. Quote review now has a structured quoted -> reviewed -> closed workflow.

Dashboard-only UX updates such as searchable selects and inline field validation are intentionally not documented below because they do not require backend changes.

## 1. Products

### Purpose

A product no longer has only one image. Products can now carry multiple images from different angles.

The frontend uses:

- the first image as the primary image in cards, listings, and table previews
- the full image list in the store product gallery

### Create/update request body

Logical payload:

```json
{
  "name": "12kVA Hybrid Inverter",
  "overview": "Three-phase hybrid inverter for medium residential loads.",
  "category_id": "cat_inverters",
  "price": 2500000,
  "stock_quantity": 12,
  "section_values": [
    {
      "section_id": "sec_brand",
      "section_name": "Brand",
      "value": "SMA"
    },
    {
      "section_id": "sec_size",
      "section_name": "Size",
      "value": "12",
      "unit": "kVA"
    }
  ],
  "is_active": true
}
```

Actual multipart fields:

- `name`
- `overview`
- `category_id`
- `price`
- `stock_quantity`
- `section_values` as a JSON string
- `is_active`
- optional repeated `images` file fields
- optional legacy fallback `image` file field
- optional `datasheet` file

Example:

```bash
curl -X POST /api/v1/admin/products \
  -F 'name=12kVA Hybrid Inverter' \
  -F 'overview=Three-phase hybrid inverter for medium residential loads.' \
  -F 'category_id=cat_inverters' \
  -F 'price=2500000' \
  -F 'stock_quantity=12' \
  -F 'section_values=[{"section_id":"sec_brand","section_name":"Brand","value":"SMA"},{"section_id":"sec_size","section_name":"Size","value":"12","unit":"kVA"}]' \
  -F 'is_active=true' \
  -F 'images=@front.jpg' \
  -F 'images=@side.jpg' \
  -F 'images=@rear.jpg' \
  -F 'image=@front.jpg' \
  -F 'datasheet=@datasheet.pdf'
```

### Validation and behavior

- `name` is required.
- `category_id` is required.
- `price` is required.
- `stock_quantity` is required.
- If the selected category has `requires_product_image = true`, at least one image is required on create unless an existing image set already exists on update.
- The backend should persist image order. The first persisted image is the primary image.
- `product_image_url` should remain available for compatibility and should resolve to the first image.
- `product_image_urls` should contain the ordered full image set.
- `is_active = false` is the draft state.
- `is_active = true` is the published state.

### Canonical response shape

```json
{
  "id": "prod_123",
  "slug": "12kva-hybrid-inverter",
  "name": "12kVA Hybrid Inverter",
  "category_id": "cat_inverters",
  "category": {
    "id": "cat_inverters",
    "name": "Inverters"
  },
  "price": 2500000,
  "stock_quantity": 12,
  "overview": "Three-phase hybrid inverter for medium residential loads.",
  "section_values": [
    {
      "id": "psv_1",
      "section_id": "sec_brand",
      "section_name": "Brand",
      "value": "SMA"
    }
  ],
  "product_image_url": "https://cdn.example.com/products/prod_123/front.jpg",
  "product_image_urls": [
    "https://cdn.example.com/products/prod_123/front.jpg",
    "https://cdn.example.com/products/prod_123/side.jpg",
    "https://cdn.example.com/products/prod_123/rear.jpg"
  ],
  "datasheet_url": "https://cdn.example.com/products/prod_123/datasheet.pdf",
  "is_active": true,
  "status": "published",
  "created_at": "2026-05-29T09:00:00.000Z",
  "updated_at": "2026-05-29T09:30:00.000Z"
}
```

### Temporary compatibility

The frontend still sends both:

- repeated `images`
- legacy single `image` using the first selected file

The old single-image fallback is temporary and should be removed after the backend fully adopts `product_image_urls`.

## 2. Projects

### Purpose

The old installation-content area is now Projects content.

This surface is used to populate:

- the admin Projects page
- the public Projects page
- the homepage project cards

This is portfolio/content data and should not be treated as the installer job lifecycle record anymore.

### Endpoint direction

The intended endpoint direction is:

- `GET /api/v1/admin/projects/`
- `POST /api/v1/admin/projects/`
- `GET /api/v1/admin/projects/:id`
- `PATCH /api/v1/admin/projects/:id`
- `DELETE /api/v1/admin/projects/:id`

The frontend currently falls back to the legacy installation endpoints:

- `/api/v1/admin/installations/`
- `/api/v1/admin/installations/:id`

### Create/update request body

Admin-captured fields:

```json
{
  "package_id": "pkg_123",
  "overview": "This commercial deployment was tailored for stable daytime operations and battery-supported backup.",
  "address": "Ikeja business district",
  "city": "Lagos",
  "state": "Lagos",
  "country": "Nigeria",
  "installation_time_label": "48 hrs",
  "highlights": [
    "Reduced diesel generator usage by over 70%",
    "Optimized solar production for daytime office load"
  ],
  "system_details": {
    "inverter_size": "10",
    "inverter_label": "10kVA",
    "pv_size": "8",
    "pv_label": "8kWp",
    "battery_size": "10",
    "battery_label": "10kWh"
  },
  "what_it_powers": [
    "Office lighting",
    "Desktop computers",
    "Routers and networking devices"
  ]
}
```

Derived fields still appended by the frontend before submit:

```json
{
  "slug": "business-solar-package-installation-lagos",
  "title": "Business Solar Package Installation - Lagos",
  "summary": "This commercial deployment was tailored for stable daytime operations and battery-supported backup.",
  "status": "published",
  "scheduled_date": "2026-05-29T20:40:00.000Z"
}
```

Actual multipart fields:

- scalar fields as normal form-data values
- derived `slug`, `title`, `summary`, and hidden compatibility `status` / `scheduled_date`
- `highlights` as a JSON string
- `system_details` as a JSON string
- `what_it_powers` as a JSON string
- optional repeated `media` file fields
- optional repeated `images` file fields for the image subset
- optional legacy single `image` file field using the first image

Supported media types:

- images
- videos

### Validation and behavior

- `overview` is required for detail pages.
- The admin form only exposes:
  - package select
  - project overview
  - location
  - installation time
  - highlights
  - system details
  - what it powers
  - project media
- `package_id` is nullable and should accept `"none"` from the UI as null.
- The frontend auto-generates `title`, `summary`, and `slug` from the selected package, location, and overview.
- Datasheet upload was removed from the project form and is no longer submitted.
- Multiple media files are allowed.
- The frontend image slider uses only image media.
- The frontend slider uses at most the first 4 image media items.
- Videos should be stored and returned, but should not be included in the homepage/admin image slider.
- The frontend expects ordered media.
- The frontend currently uses `published`, `draft`, and `archived` as the project-content statuses.
- The frontend still sends compatibility fields such as `scheduled_date`, `status`, `system_size_kw`, `number_of_panels`, `panel_type`, and `inverter_type` so older handlers do not break while the new project content endpoint is being finalized.
- `system_details`, `highlights`, and `what_it_powers` should be returned in structured form.

### Canonical response shape

```json
{
  "id": "proj_123",
  "slug": "10kva-commercial-solar-installation-lagos-office",
  "package_id": "pkg_123",
  "package_name": "Business Solar Package",
  "title": "10kVA Commercial Solar Installation - Lagos Office",
  "summary": "A mid-size corporate office in Ikeja now runs 24/7 on solar, reducing diesel costs by over 70%.",
  "overview": "This commercial deployment was tailored for stable daytime operations and battery-supported backup.",
  "address": "Ikeja business district",
  "city": "Lagos",
  "state": "Lagos",
  "country": "Nigeria",
  "installation_time_label": "48 hrs",
  "scheduled_date": "2026-05-29T09:00:00.000Z",
  "highlights": [
    "Reduced diesel generator usage by over 70%",
    "Optimized solar production for daytime office load"
  ],
  "system_details": {
    "inverter_size": "10",
    "inverter_label": "10kVA",
    "pv_size": "8",
    "pv_label": "8kWp",
    "battery_size": "10",
    "battery_label": "10kWh"
  },
  "what_it_powers": [
    "Office lighting",
    "Desktop computers",
    "Routers and networking devices"
  ],
  "media": [
    {
      "id": "media_1",
      "name": "Front angle",
      "url": "https://cdn.example.com/projects/proj_123/front.jpg",
      "mime_type": "image/jpeg",
      "kind": "image"
    },
    {
      "id": "media_2",
      "name": "Walkthrough video",
      "url": "https://cdn.example.com/projects/proj_123/walkthrough.mp4",
      "mime_type": "video/mp4",
      "kind": "video"
    }
  ],
  "image_urls": [
    "https://cdn.example.com/projects/proj_123/front.jpg",
    "https://cdn.example.com/projects/proj_123/roof.jpg"
  ],
  "video_urls": [
    "https://cdn.example.com/projects/proj_123/walkthrough.mp4"
  ],
  "status": "published",
  "created_at": "2026-05-29T09:00:00.000Z",
  "updated_at": "2026-05-29T09:30:00.000Z"
}
```

### Temporary compatibility

The frontend currently sends all of the following during project create/update:

- repeated `media`
- repeated `images` for only image uploads
- legacy single `image` using the first uploaded image
- derived `slug`, `title`, and `summary`
- hidden compatibility `scheduled_date` and `status`

The legacy single-image fallback should be removed once the backend fully adopts ordered project media.

## 3. Package Requests and Job Lifecycle

### Purpose

Package requests now drive the real installation lifecycle.

Jobs are now operational delivery records linked to package requests, not generic installation posts.

Orders remain separate and should not inherit this lifecycle automatically.

### Package request statuses

The package request flow should support the following statuses:

- `processing`
- `packed`
- `installer_assigned`
- `installer_in_transit`
- `system_installed`
- `installation_verified`
- `closed`
- `cancelled`

### Job statuses

The job flow should support the following statuses:

- `open`
- `assigned`
- `in_progress`
- `completed`
- `verified`
- `closed`
- `cancelled`

### Job create/update request body

Logical payload:

```json
{
  "slug": "business-solar-package-lagos-installation",
  "title": "Business Solar Package Installation",
  "description": "Installation delivery for the linked package request.",
  "package_request_id": "pkg_req_123",
  "package_request_name": "Business Solar Package",
  "package_request_status": "packed",
  "assigned_to": "installer_user_123",
  "status": "assigned",
  "scheduled_date": "2026-06-02T09:30:00.000Z",
  "customer_user_id": "customer_user_123",
  "client_name": "Amina Yusuf Ventures",
  "customer_name": "Amina Yusuf",
  "customer_email": "amina@example.com",
  "customer_phone": "+2348012345678",
  "address": "Lekki Phase 1",
  "city": "Lagos",
  "state": "Lagos",
  "country": "Nigeria",
  "system_size_kw": 10,
  "required_experience_years": 3,
  "budget": 250000,
  "notes": "Coordinate installer arrival with estate access desk."
}
```

The dashboard no longer exposes a manual slug input for jobs. The frontend generates `slug` from the final title using a trimmed lowercase hyphenated format before submit and on edit.

The job form now also captures `client_name` as the business, site, or client label shown above the location fields. It is optional, but the frontend sends it whenever present.

Compatibility fields still tolerated:

- `deadline`
- `location`
- legacy installation link fields if they still exist temporarily

### Package request response additions used by the frontend

The job board and package-request dashboard now benefit from the package request response including:

```json
{
  "id": "pkg_req_123",
  "bundle_name": "Business Solar Package",
  "status": "packed",
  "customer_user_id": "customer_user_123",
  "client_name": "Amina Yusuf Ventures",
  "customer_name": "Amina Yusuf",
  "customer_email": "amina@example.com",
  "customer_phone": "+2348012345678",
  "address": "Lekki Phase 1",
  "city": "Lagos",
  "state": "Lagos",
  "country": "Nigeria",
  "system_size_kw": 10,
  "job_id": "job_123",
  "job_slug": "business-solar-package-lagos-installation",
  "job_status": "assigned"
}
```

### Sync behavior

The backend should keep package request status and job status synchronized using the rules below:

1. New package requests start at `processing`.
2. When admin confirms payment, package request becomes `packed`.
3. Only `packed` package requests should appear in the job package-request selector.
4. When a job is created or updated to `assigned` and has either an installer selected or is explicitly assigned, the linked package request becomes `installer_assigned`.
5. On the scheduled installation date, or when admin/installer moves the job to `in_progress`, the linked package request becomes `installer_in_transit`.
6. When installer marks the job complete, job becomes `completed` and package request becomes `system_installed`.
7. When final inspection is approved, job becomes `verified` and package request becomes `installation_verified`.
8. Closing either side should close both:
   - job `closed`
   - package request `closed`
9. Cancelling either side should cancel both:
   - job `cancelled`
   - package request `cancelled`

### Backend notes

- The sync should be bidirectional.
- The sync should be idempotent.
- Cron/scheduler support is needed for scheduled transitions such as moving an assigned record into in-progress on the installation date.
- Orders should continue to have their own independent status flow and should only notify the user based on direct order status changes from admin.
- Until that backend sync is ready, the frontend temporarily mirrors statuses in both directions:
  - updating a job also pushes the mapped package request status
  - updating a package request also pushes the mapped job status if a linked `job_id` is present

## 4. Quote Review Workflow

### Purpose

Quote requests now have a structured admin review flow:

- `new`
- `quoted`
- `reviewed`
- `closed`

`reviewed` should appear before `closed` in the frontend and in status ordering.

### Update request body

When status becomes `quoted`, the backend should accept:

```json
{
  "status": "quoted",
  "adminNotes": "Initial proposal sent to customer."
}
```

Multipart additions for `quoted`:

- `quote_asset` file
- `quote_asset_kind` of `image` or `pdf`

When status becomes `reviewed`, the backend should accept a generated package-request payload created from the quote:

```json
{
  "status": "reviewed",
  "adminNotes": "Customer approved the quote.",
  "package_request_payload": {
    "source_quote_id": "quote_123",
    "customer_name": "Amina Yusuf",
    "customer_email": "amina@example.com",
    "customer_phone": "+2348012345678",
    "address": "Lekki Phase 1, Lagos",
    "recommended_system_size": 10,
    "estimated_cost": 4500000
  }
}
```

### Validation and behavior

- `quoted` requires a quote asset upload of either image or pdf.
- `reviewed` should create a package request from the quote payload.
- The created package request should be linked back to the quote.
- `closed` should require explicit confirmation in the frontend and should make the quote read-only afterward.

### Canonical response additions

```json
{
  "id": "quote_123",
  "status": "reviewed",
  "admin_notes": "Customer approved the quote.",
  "quote_asset_url": "https://cdn.example.com/quotes/quote_123/proposal.pdf",
  "quote_asset_kind": "pdf",
  "converted_package_request_id": "pkg_req_123",
  "is_closed": false
}
```
