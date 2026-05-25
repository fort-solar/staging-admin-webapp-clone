# Fortsolar Product-category,Product and Packages Changes

Date: May 25, 2026

Frontend sources:

- `components/dashboard/products-management.tsx`
- `components/dashboard/bundles-management.tsx`
- `lib/admin-api.ts`
- `types/api.types.ts`

## Summary

The recent flow change introduced three backend-facing changes:

1. Product categories are now dynamic schemas.
2. Products now have a unified admin CRUD flow that is category-driven.
3. Packages are now assembled from existing products and carry separate thumbnail and package images.



## 1. Product Categories

### Purpose

The Updated Product Categories now define:

- the category name
- the ordered list of dynamic sections a product in that category should expose
- whether a datasheet is required
- whether a product image is required

### Create/update request body

The new sample request is shown below;

```json
{
  "name": "Inverters",
  "sections": [
    { "name": "Brand", "position": 1 },
    { "name": "Size", "position": 2 },
    { "name": "Efficiency", "position": 3 }
  ],
  "requires_datasheet": true,
  "requires_product_image": true
}
```

For updates `id`, we have similar structure, the sections can be any number and it is used to generate different fields when creating products :

```json
{
  "name": "Inverters",
  "sections": [
    { "id": "sec_1", "name": "Brand", "position": 1 },
    { "id": "sec_2", "name": "Size", "position": 2 },
    { "name": "Voltage Range", "position": 3 }
  ],
  "requires_datasheet": true,
  "requires_product_image": true
}
```

### Validation and behavior

- `name` is required.
- At least one section is required.
- Section order matters. Persist `position` and return sections in order.
- Section IDs should be stable once created.
- On category update, sections omitted from the submitted `sections` array should be treated as removed.
- `requires_datasheet` and `requires_product_image` should be enforced server-side when products are created or updated against this category.

### Canonical response shape

```json
{
  "id": "cat_123",
  "name": "Inverters",
  "description": null,
  "image": null,
  "image_url": null,
  "sections": [
    {
      "id": "sec_1",
      "key": "brand",
      "name": "Brand",
      "position": 1
    },
    {
      "id": "sec_2",
      "key": "size",
      "name": "Size",
      "position": 2
    }
  ],
  "requires_datasheet": true,
  "requires_product_image": true,
  "created_at": "2026-05-25T09:00:00.000Z",
  "updated_at": "2026-05-25T09:30:00.000Z"
}
```

### Frontend usage note

The category form currently manages only:

- `name`
- `sections`
- `requires_datasheet`
- `requires_product_image`

`description` and category image fields are tolerated in responses but are not currently edited in the UI.

## 2. Products

### Purpose

Products are no longer created through separate panel/inverter/battery forms in the new UI. The primary flow is now a generic product form that is driven by category definitions.

Each product has:

- core fields: name, category, price, stock, overview, status
- dynamic section values from the selected category
- optional/required media depending on category settings


### Create/update request body

The new sample request is shown below;

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
- optional `image` file
- optional `datasheet` file

Example:

```bash
curl -X POST /api/v1/admin/products/ \
  -F 'name=12kVA Hybrid Inverter' \
  -F 'overview=Three-phase hybrid inverter for medium residential loads.' \
  -F 'category_id=cat_inverters' \
  -F 'price=2500000' \
  -F 'stock_quantity=12' \
  -F 'section_values=[{"section_id":"sec_brand","section_name":"Brand","value":"SMA"},{"section_id":"sec_size","section_name":"Size","value":"12","unit":"kVA"}]' \
  -F 'is_active=true' \
  -F 'image=@product.jpg' \
  -F 'datasheet=@datasheet.pdf'
```

### Validation and behavior

- `name` is required.
- `category_id` is required.
- `price` is required.
- `stock_quantity` is required.
- If the selected category has `requires_product_image = true`, `image` must be present on create unless an existing image already exists on update.
- If the selected category has `requires_datasheet = true`, `datasheet` must be present on create unless an existing datasheet already exists on update.
- `section_values` should accept dynamic values and should not be hard-coded to panel/inverter/battery schemas.
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
    },
    {
      "id": "psv_2",
      "section_id": "sec_size",
      "section_name": "Size",
      "value": "12",
      "unit": "kVA"
    }
  ],
  "product_image_url": "https://cdn.example.com/products/prod_123/image.jpg",
  "datasheet_url": "https://cdn.example.com/products/prod_123/datasheet.pdf",
  "specifications": {},
  "is_active": true,
  "status": "published",
  "created_at": "2026-05-25T09:00:00.000Z",
  "updated_at": "2026-05-25T09:30:00.000Z"
}
```

### Backend notes

- Some sections require additional options like size requires unit.
- The frontend prefers `product_image_url` and `datasheet_url` in product responses.
- Returning embedded `category` is helpful but not strictly required if `category_id` is present and categories can be fetched separately.
- Keep `section_values` on both list and detail responses. The list cards show a short summary generated from those values.


### Temporary compatibility

The frontend still has a fallback for legacy endpoints if the generic product endpoint is not ready:

- `GET /api/v1/admin/products/panels`
- `GET /api/v1/admin/products/inverters`
- `GET /api/v1/admin/products/batteries`
- `GET /api/v1/admin/products/panels/:id`
- `GET /api/v1/admin/products/inverters/:id`
- `GET /api/v1/admin/products/batteries/:id`
- delete on those same legacy detail endpoints

Those fallbacks are temporary. The generic `/api/v1/admin/products` contract is the intended direction.

## 3. Packages

### Purpose

Packages are now bundles of existing products, not standalone static records.

Each package includes:

- package name and overview
- price and discount percentage
- draft/published status
- solar finance toggle
- selected products with category/product/quantity
- system details
- “what it powers” tags
- two package-level images:
  - `thumbnail`
  - `image`

The UI also derives product gallery and datasheet previews from the selected products.



### Create/update request body

The new sample request is shown below;

Logical payload:

```json
{
  "name": "Starter Solar Package",
  "overview": "Entry package for compact daytime loads.",
  "description": "Entry package for compact daytime loads.",
  "price": 1750000,
  "discount_percentage": 5,
  "solar_finance_enabled": true,
  "category_id": null,
  "items": [
    {
      "category_id": "cat_panels",
      "product_id": "prod_panel_1",
      "quantity": 4
    },
    {
      "category_id": "cat_inverters",
      "product_id": "prod_inverter_1",
      "quantity": 1
    }
  ],
  "what_it_powers": ["Laptops", "Phones", "TVs"],
  "system_details": {
    "inverter_size": "3",
    "inverter_label": "3kVA",
    "pv_size": "2.4",
    "pv_label": "2.4kWp",
    "battery_size": "5",
    "battery_label": "5kWh"
  },
  "system_size_kw": 2.4,
  "number_of_panels": 1,
  "panel_type": "550W Mono Panel",
  "inverter_type": "3kVA Hybrid Inverter",
  "battery_included": true,
  "warranty_years": 0,
  "estimated_savings_monthly": 0,
  "payback_period_years": 0,
  "is_active": true
}
```

Actual multipart fields:

- scalar fields as normal form-data values
- `items` as a JSON string
- `what_it_powers` as a JSON string
- `system_details` as a JSON string
- `thumbnail` as image file
- `image` as image file

### Validation and behavior

- `name` is required.
- `price` is required.
- At least one valid item is required.
- `thumbnail` is required on create unless an existing thumbnail already exists on update.
- `image` is required on create unless an existing package image already exists on update.
- `is_active = false` is the draft state.
- `is_active = true` is the published state.
- Persist `discount_percentage`, `solar_finance_enabled`, `what_it_powers`, and `system_details`.
- `category_id` is currently sent as `null` by the UI. The backend can store it as nullable or ignore it if unused.
- `system_size_kw`, `number_of_panels`, `panel_type`, `inverter_type`, and `battery_included` are currently sent as UI-derived helper fields from the selected items. The backend can validate or recompute them from `items` if server-side truth is preferred.
- `warranty_years`, `estimated_savings_monthly`, and `payback_period_years` are currently sent as `0` placeholders because the current package form does not expose those inputs yet.

### Canonical response shape

```json
{
  "id": "pkg_123",
  "slug": "starter-solar-package",
  "name": "Starter Solar Package",
  "description": "Entry package for compact daytime loads.",
  "overview": "Entry package for compact daytime loads.",
  "category_id": null,
  "system_size_kw": 2.4,
  "price": 1750000,
  "number_of_panels": 1,
  "panel_type": "550W Mono Panel",
  "inverter_type": "3kVA Hybrid Inverter",
  "battery_included": true,
  "warranty_years": 0,
  "estimated_savings_monthly": 0,
  "payback_period_years": 0,
  "discount_percentage": 5,
  "solar_finance_enabled": true,
  "thumbnail_url": "https://cdn.example.com/packages/pkg_123/thumbnail.jpg",
  "package_image_url": "https://cdn.example.com/packages/pkg_123/image.jpg",
  "image_url": "https://cdn.example.com/packages/pkg_123/image.jpg",
  "items": [
    {
      "id": "pkg_item_1",
      "category_id": "cat_panels",
      "category_name": "Panels",
      "product_id": "prod_panel_1",
      "product_name": "550W Mono Panel",
      "quantity": 4,
      "product": {
        "id": "prod_panel_1",
        "name": "550W Mono Panel",
        "product_image_url": "https://cdn.example.com/products/prod_panel_1/image.jpg",
        "datasheet_url": "https://cdn.example.com/products/prod_panel_1/datasheet.pdf"
      }
    }
  ],
  "what_it_powers": ["Laptops", "Phones", "TVs"],
  "system_details": {
    "inverter_size": "3",
    "inverter_label": "3kVA",
    "pv_size": "2.4",
    "pv_label": "2.4kWp",
    "battery_size": "5",
    "battery_label": "5kWh"
  },
  "datasheets": [
    {
      "name": "550W Mono Panel Datasheet",
      "url": "https://cdn.example.com/products/prod_panel_1/datasheet.pdf",
      "mime_type": "application/pdf",
      "kind": "pdf"
    }
  ],
  "product_images": [
    "https://cdn.example.com/products/prod_panel_1/image.jpg"
  ],
  "is_active": true,
  "created_at": "2026-05-25T09:00:00.000Z",
  "updated_at": "2026-05-25T09:30:00.000Z"
}
```

### Backend notes

- `thumbnail_url` and `package_image_url` are distinct fields and should remain distinct.
- The package detail UI can derive gallery and datasheets from `items[*].product`, but returning `product_images` and `datasheets` directly is also supported and preferred.
- The list screen uses:
  - `name`
  - `thumbnail_url` or `package_image_url`
  - `price`
  - `discount_percentage`
  - `solar_finance_enabled`
  - `items`
  - `is_active`

The frontend currently normalizes a few alias fields for compatibility, but the backend should standardize on the canonical names above to reduce ambiguity.
