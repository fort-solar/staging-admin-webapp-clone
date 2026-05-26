import { normalizeManagedProductRecord, normalizeCategoryRecord } from "@/components/dashboard/products-management";
import { buildMultipartFormData } from "@/lib/admin-api";

describe("admin product normalization", () => {
  it("keeps unified product image and category metadata aligned with the new API shape", () => {
    const category = normalizeCategoryRecord({
      id: "cat-1",
      name: "Inverters",
      sections: [{ id: "sec-1", key: "size", name: "Size", position: 1 }],
      requires_datasheet: true,
      requires_product_image: true,
      created_at: "2026-05-26T00:00:00.000Z",
      updated_at: "2026-05-26T00:00:00.000Z",
    });

    const normalized = normalizeManagedProductRecord(
      {
        id: "prod-1",
        slug: "12kva-hybrid-inverter",
        name: "12kVA Hybrid Inverter",
        category_id: "cat-1",
        price: 2500000,
        stock_quantity: 12,
        overview: "Three-phase hybrid inverter",
        product_image_url: "https://cdn.example.com/products/prod-1/image.jpg",
        datasheet_url: "https://cdn.example.com/products/prod-1/datasheet.pdf",
        section_values: [{ section_id: "sec-1", section_name: "Size", value: "12", unit: "kVA" }],
        specifications: {},
        is_active: true,
        status: "published",
        created_at: "2026-05-26T00:00:00.000Z",
        updated_at: "2026-05-26T00:00:00.000Z",
      },
      new Map([[category.id, category]]),
    );

    expect(normalized.categoryLabel).toBe("Inverters");
    expect(normalized.product_image_url).toBe("https://cdn.example.com/products/prod-1/image.jpg");
    expect(normalized.section_values).toEqual([
      expect.objectContaining({
        section_id: "sec-1",
        section_name: "Size",
        value: "12",
        unit: "kVA",
      }),
    ]);
  });
});

describe("buildMultipartFormData", () => {
  it("serializes dynamic arrays as JSON strings for multipart requests", () => {
    const formData = buildMultipartFormData({
      name: "12kVA Hybrid Inverter",
      is_active: true,
      section_values: [{ section_id: "sec-1", section_name: "Size", value: "12", unit: "kVA" }],
    });

    expect(formData.get("name")).toBe("12kVA Hybrid Inverter");
    expect(formData.get("is_active")).toBe("true");
    expect(formData.get("section_values")).toBe(
      JSON.stringify([{ section_id: "sec-1", section_name: "Size", value: "12", unit: "kVA" }]),
    );
  });
});
