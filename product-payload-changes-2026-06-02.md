# Product Payload Changes

Date: June 2, 2026

This document captures the new product fields required by the updated admin form and store product experience.

## Summary

The product payload now needs three additional fields:

- `discounted_price`
- `free_delivery`
- `delivery_warranty_info`

These fields should be accepted on create and update, and returned in product list/detail responses.

## Create / Update Request

The admin product form now submits the following payload fields in addition to the existing product fields:

```json
{
  "name": "12kVA Hybrid Inverter",
  "category_id": "cat_inverters",
  "price": 2500000,
  "discounted_price": 2250000,
  "stock_quantity": 12,
  "overview": "Three-phase hybrid inverter built for residential and commercial solar projects.",
  "free_delivery": true,
  "delivery_warranty_info": "Free delivery is available within eligible locations. This product includes a 5-year manufacturer warranty.",
  "section_values": [
    {
      "section_id": "sec_power",
      "section_name": "Power",
      "value": "12",
      "unit": "kVA"
    }
  ],
  "is_active": true
}
```

## Field Rules

- `price`
  The regular product price.

- `discounted_price`
  Optional.
  When present and lower than `price`, the store treats it as the active selling price and displays `price` as the struck-through original price.

- `free_delivery`
  Boolean.
  Controls the delivery badge/copy shown on the store product detail page.

- `delivery_warranty_info`
  Optional string.
  Rendered directly on the store product detail page in the delivery and warranty section.

## Product Response

The admin and store frontends now expect the product response to include the new fields:

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
  "discounted_price": 2250000,
  "stock_quantity": 12,
  "overview": "Three-phase hybrid inverter built for residential and commercial solar projects.",
  "free_delivery": true,
  "delivery_warranty_info": "Free delivery is available within eligible locations. This product includes a 5-year manufacturer warranty.",
  "section_values": [
    {
      "id": "psv_1",
      "section_id": "sec_power",
      "section_name": "Power",
      "value": "12",
      "unit": "kVA"
    }
  ],
  "product_image_url": "https://cdn.example.com/products/prod_123/front.jpg",
  "product_image_urls": [
    "https://cdn.example.com/products/prod_123/front.jpg",
    "https://cdn.example.com/products/prod_123/side.jpg"
  ],
  "datasheet_url": "https://cdn.example.com/products/prod_123/datasheet.pdf",
  "is_active": true,
  "created_at": "2026-06-02T10:00:00.000Z",
  "updated_at": "2026-06-02T10:00:00.000Z"
}
```

## Frontend Expectations

- The store product listing and detail page now use the real product category name returned by the backend instead of a hardcoded product category label.
- Product descriptions shown in cards and beside the main product title are shortened in the frontend to 50 words with an ellipsis.
- Quote requests are no longer blocked behind authentication. Signed-in users should still receive prefilled profile details where available.

## Backward Compatibility

- If `discounted_price` is missing, the store uses `price` as the active price.
- If `free_delivery` is missing, the store treats it as `false`.
- If `delivery_warranty_info` is missing, the store falls back to generated delivery and warranty copy.
