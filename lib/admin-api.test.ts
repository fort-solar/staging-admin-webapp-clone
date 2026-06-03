import {
  appendFilesToFormData,
  buildSectionDrafts,
  normalizeManagedProductRecord,
  normalizeCategoryRecord,
  validateProductFormInput,
} from "@/components/dashboard/products-management";
import {
  buildQuotePackageRequestPayload,
  getQuoteUpdateViewState,
} from "@/components/dashboard/energy-audit-management";
import { dashboardGet } from "@/lib/api/client";
import {
  buildMultipartFormData,
  getVerificationSubmission,
  getVerificationSubmissions,
} from "@/lib/admin-api";

jest.mock("@/lib/api/client", () => ({
  DashboardRequestError: class DashboardRequestError extends Error {
    status: number;
    payload: unknown;

    constructor(message: string, status = 400, payload: unknown = null) {
      super(message);
      this.name = "DashboardRequestError";
      this.status = status;
      this.payload = payload;
    }
  },
  dashboardGet: jest.fn(),
  submitDashboardForm: jest.fn(),
}));

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

  it("appends multi-file image uploads under the repeated images key", () => {
    const front = new File(["front"], "front.jpg", { type: "image/jpeg" });
    const side = new File(["side"], "side.jpg", { type: "image/jpeg" });
    const formData = appendFilesToFormData(buildMultipartFormData({ name: "Panel" }), "images", [
      front,
      side,
    ]);

    expect(formData.getAll("images")).toEqual([front, side]);
  });
});

describe("product form helpers", () => {
  it("purges unselected category schema blocks when the category changes", () => {
    const nextDrafts = buildSectionDrafts(
      [
        { id: "sec-brand", key: "brand", name: "Brand", position: 1 },
        { id: "sec-size", key: "size", name: "Size", position: 2 },
      ],
      [
        {
          key: "sec-brand",
          section_id: "sec-brand",
          section_name: "Brand",
          value: "SMA",
          unit: "",
        },
        {
          key: "sec-legacy",
          section_id: "sec-legacy",
          section_name: "Legacy Block",
          value: "Remove me",
          unit: "",
        },
      ],
    );

    expect(nextDrafts).toEqual([
      expect.objectContaining({
        section_id: "sec-brand",
        section_name: "Brand",
        value: "SMA",
      }),
      expect.objectContaining({
        section_id: "sec-size",
        section_name: "Size",
        value: "",
      }),
    ]);
    expect(nextDrafts.some((item) => item.section_name === "Legacy Block")).toBe(false);
  });

  it("enforces positive-only pricing and stock rules", () => {
    expect(() =>
      validateProductFormInput({
        name: "Panel",
        categoryId: "cat-1",
        price: "0",
        discountedPrice: "",
        stockQuantity: "12",
        selectedCategory: null,
        imageFiles: [],
        currentImageUrls: [],
        datasheetFile: null,
        currentDatasheetUrl: null,
      }),
    ).toThrow("Enter a valid product price.");

    expect(() =>
      validateProductFormInput({
        name: "Panel",
        categoryId: "cat-1",
        price: "250000",
        discountedPrice: "",
        stockQuantity: "-1",
        selectedCategory: null,
        imageFiles: [],
        currentImageUrls: [],
        datasheetFile: null,
        currentDatasheetUrl: null,
      }),
    ).toThrow("Enter a valid stock quantity.");
  });
});

describe("verification submission normalization", () => {
  const mockedDashboardGet = dashboardGet as jest.MockedFunction<typeof dashboardGet>;

  afterEach(() => {
    mockedDashboardGet.mockReset();
  });

  it("hydrates submission documents from id and certificate urls returned by the list endpoint", async () => {
    mockedDashboardGet.mockResolvedValue({
      success: true,
      data: [
        {
          id: "verification-1",
          installer_id: "installer-1",
          status: "pending",
          submitted_at: "2026-05-31T17:40:23.406Z",
          reviewed_at: null,
          reviewed_by_admin_id: null,
          admin_note: null,
          created_at: "2026-05-31T17:40:23.406Z",
          updated_at: "2026-05-31T17:40:23.406Z",
          user_id: "user-1",
          user_email: "installer@example.com",
          user_name: "Installer Example",
          documents_count: 0,
          id_file_url: "https://api.fortsolar.test/uploads/id-card.pdf?sig=abc",
          certificate_file_url: "/uploads/certificates/solar-training.png",
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    } as never);

    const payload = await getVerificationSubmissions();

    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.documents_count).toBe(2);
    expect(payload.data[0]?.documents).toEqual([
      expect.objectContaining({
        label: "ID File",
        upload: expect.objectContaining({
          file_path: "https://api.fortsolar.test/uploads/id-card.pdf?sig=abc",
        }),
      }),
      expect.objectContaining({
        label: "Certificate File",
        upload: expect.objectContaining({
          file_path: "/uploads/certificates/solar-training.png",
        }),
      }),
    ]);
  });

  it("hydrates submission documents from url fields returned by the detail endpoint", async () => {
    mockedDashboardGet.mockResolvedValue({
      success: true,
      data: {
        submission: {
          id: "verification-2",
          installer_id: "installer-2",
          status: "pending",
          submitted_at: "2026-05-31T17:40:23.406Z",
          reviewed_at: null,
          reviewed_by_admin_id: null,
          admin_note: null,
          created_at: "2026-05-31T17:40:23.406Z",
          updated_at: "2026-05-31T17:40:23.406Z",
          user_id: "user-2",
          user_email: "installer2@example.com",
          user_name: "Installer Two",
          documents_count: 0,
        },
        id_file_url: "/uploads/id/installer-two.pdf",
        certificate_file_url: "/uploads/cert/installer-two.pdf",
      },
    } as never);

    const payload = await getVerificationSubmission("verification-2");

    expect(payload.data.submission.documents_count).toBe(2);
    expect(payload.data.documents).toEqual([
      expect.objectContaining({
        label: "ID File",
        upload: expect.objectContaining({
          file_path: "/uploads/id/installer-two.pdf",
        }),
      }),
      expect.objectContaining({
        label: "Certificate File",
        upload: expect.objectContaining({
          file_path: "/uploads/cert/installer-two.pdf",
        }),
      }),
    ]);
  });
});

describe("quote review helpers", () => {
  it("builds the reviewed package-request payload from the quote detail", () => {
    const payload = buildQuotePackageRequestPayload({
      id: "quote-1",
      name: "Ada Customer",
      email: "ada@example.com",
      phone: "08000000000",
      address: "14 Allen Avenue",
      location: "Ikeja, Lagos",
      recommended_system_size: 5,
      estimated_cost: 3500000,
      estimated_savings: 420000,
      payback_period_years: 4,
      form_extras: { roofType: "pitched" },
      appliances: [
        {
          id: "app-1",
          name: "AC",
          wattage: 1200,
          quantity: 2,
          hoursPerDay: 8,
        },
      ],
    } as never);

    expect(payload).toEqual({
      source_quote_id: "quote-1",
      customer_name: "Ada Customer",
      customer_email: "ada@example.com",
      customer_phone: "08000000000",
      address: "14 Allen Avenue",
      recommended_system_size: 5,
      estimated_cost: 3500000,
      estimated_savings: 420000,
      payback_period_years: 4,
      appliances: [
        {
          id: "app-1",
          name: "AC",
          wattage: 1200,
          quantity: 2,
          hoursPerDay: 8,
        },
      ],
      form_extras: { roofType: "pitched" },
    });
  });

  it("marks reviewed quotes as read-only and exposes the reviewed payload preview state", () => {
    const view = getQuoteUpdateViewState(
      {
        id: "quote-2",
        status: "reviewed",
        is_closed: false,
      } as never,
      "reviewed",
    );

    expect(view).toEqual({
      isReadOnly: true,
      showReviewedPayloadPreview: true,
      isClosed: false,
      isReviewed: true,
    });
  });
});
