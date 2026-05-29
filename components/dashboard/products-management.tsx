"use client";

import { type FormEvent, useDeferredValue, useEffect, useMemo, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { ActionLink, CatalogCard, DetailPanel, DirectoryToolbar, InlineCallout, KeyValueList, ManagementBackLink } from "@/components/dashboard/management-primitives";
import { FormField, Modal, ModalFooterActions } from "@/components/dashboard/modals";
import { FormSubmitter, getFormSubmitIntent } from "@/components/dashboard/form-submitter";
import { Button, Checkbox, EmptyScaffold, MetricCardSecondary, Pagination, Panel, SelectField, StatusPill, TableActionsMenu, Tabs, TextAreaField, TextField, cx } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import {
  buildMultipartFormData,
  createProduct,
  createProductCategory,
  DEFAULT_PAGE_SIZE,
  deleteProduct,
  deleteProductCategory,
  formatCurrencyLabel,
  formatDateLabel,
  getProduct,
  getProductCategories,
  getProducts,
  updateProduct,
  updateProductCategory,
} from "@/lib/admin-api";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import type { AdminProductRecord, PaginationMeta, ProductCategoryApiRecord, ProductCategorySectionRecord, ProductSectionValueRecord } from "@/types/api.types";

const productViewTabs = ["Products", "Categories"] as const;
const productStatusTabs = ["All", "Published", "Draft"] as const;
const categoryFormId = "product-category-form";
const productCreateFormId = "product-create-form";
const productFormCategoryLimit = 100;

type ProductView = (typeof productViewTabs)[number];
type ProductStatusFilter = (typeof productStatusTabs)[number];
type SectionDraft = ProductSectionValueRecord & { key: string };
export type ManagedProductRow = AdminProductRecord & {
  categoryKey: string;
  categoryLabel: string;
};

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

function readNumber(record: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function readBoolean(record: Record<string, unknown>, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1" || normalized === "yes") {
        return true;
      }
      if (normalized === "false" || normalized === "0" || normalized === "no") {
        return false;
      }
    }

    if (typeof value === "number") {
      return value > 0;
    }
  }

  return fallback;
}

function readArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function readStringArray(record: Record<string, unknown>, keys: string[]) {
  return readArray(record, keys)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferDocumentKind(source: string, mimeType?: string | null) {
  const normalizedMime = mimeType?.toLowerCase() ?? "";
  const normalizedSource = source.toLowerCase();

  if (normalizedMime.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/.test(normalizedSource)) {
    return "image" as const;
  }

  if (normalizedMime.includes("pdf") || normalizedSource.endsWith(".pdf")) {
    return "pdf" as const;
  }

  return "file" as const;
}

function normalizeCategorySection(record: unknown, index: number): ProductCategorySectionRecord | null {
  if (typeof record === "string" && record.trim()) {
    const name = record.trim();

    return {
      id: `${slugify(name)}-${index}`,
      key: slugify(name),
      name,
      position: index + 1,
    };
  }

  if (!isRecord(record)) {
    return null;
  }

  const name = readString(record, ["name", "title", "label"]);

  if (!name) {
    return null;
  }

  return {
    id: readString(record, ["id"]) || `${slugify(name)}-${index}`,
    key: readString(record, ["key", "slug"]) || slugify(name),
    name,
    position: readNumber(record, ["position", "order"], index + 1),
  };
}

export function normalizeCategoryRecord(record: ProductCategoryApiRecord | Record<string, unknown>): ProductCategoryApiRecord {
  const raw = record as Record<string, unknown>;
  const sections = readArray(raw, ["sections", "section_definitions", "category_sections"])
    .map((item, index) => normalizeCategorySection(item, index))
    .filter((item): item is ProductCategorySectionRecord => Boolean(item));

  return {
    ...(record as ProductCategoryApiRecord),
    id: readString(raw, ["id"]),
    name: readString(raw, ["name", "title", "category_name", "category"]),
    description: readString(raw, ["description"], "") || null,
    image: readString(raw, ["image", "image_url"], "") || null,
    image_url: readString(raw, ["image_url", "image"], "") || null,
    sections,
    requires_datasheet: readBoolean(raw, ["requires_datasheet", "has_datasheet", "datasheet_enabled"]),
    requires_product_image: readBoolean(raw, ["requires_product_image", "has_product_image", "product_image_enabled"], true),
    created_at: readString(raw, ["created_at", "createdAt"]),
    updated_at: readString(raw, ["updated_at", "updatedAt"]) || undefined,
  };
}

function normalizeSectionValue(record: unknown, index: number): SectionDraft | null {
  if (!isRecord(record)) {
    return null;
  }

  const sectionName = readString(record, ["section_name", "name", "label", "title"]);
  const value = readString(record, ["value", "content", "answer"]);

  if (!sectionName) {
    return null;
  }

  return {
    id: readString(record, ["id"]) || undefined,
    section_id: readString(record, ["section_id"]) || undefined,
    section_name: sectionName,
    value,
    unit: readString(record, ["unit"]) || undefined,
    key: readString(record, ["section_id", "key"]) || `${slugify(sectionName)}-${index}`,
  };
}

function buildSectionDrafts(sections: ProductCategorySectionRecord[], currentValues: SectionDraft[] = []) {
  const existing = new Map(
    currentValues.map((item) => [
      item.section_id || slugify(item.section_name),
      item,
    ]),
  );

  const drafted = sections.map((section, index) => {
    const existingValue = existing.get(section.id || section.key || slugify(section.name));
    return {
      id: existingValue?.id,
      section_id: section.id || existingValue?.section_id,
      section_name: section.name,
      value: existingValue?.value ?? "",
      unit: existingValue?.unit ?? "",
      key: section.id || section.key || `${slugify(section.name)}-${index}`,
    } satisfies SectionDraft;
  });

  const extras = currentValues.filter((item) => !drafted.some((draft) => draft.key === item.key));
  return [...drafted, ...extras];
}

function useObjectUrl(file: File | null) {
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  return objectUrl;
}

function useObjectUrls(files: File[]) {
  const objectUrls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => {
    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [objectUrls]);

  return objectUrls;
}

function normalizeProductImageUrls(record: Record<string, unknown>) {
  const mediaRecord = isRecord(record.media) ? record.media : null;
  const mediaImageUrls = mediaRecord ? readStringArray(mediaRecord, ["image_urls"]) : [];
  const topLevelImageUrls = readStringArray(record, ["product_image_urls", "image_urls", "images"]);
  const fallbackImageUrl = readString(record, ["product_image_url", "image_url", "image"]);

  return [...topLevelImageUrls, ...mediaImageUrls, fallbackImageUrl]
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);
}

function statusFromActive(isActive: boolean) {
  return {
    label: isActive ? "Published" : "Draft",
    tone: isActive ? "success" : "warning",
  } as const;
}

function formatRequirementSummary(category: ProductCategoryApiRecord) {
  const tokens = [`${category.sections?.length ?? 0} sections`];
  if (category.requires_datasheet) {
    tokens.push("Datasheet");
  }
  if (category.requires_product_image) {
    tokens.push("Product Image");
  }
  return tokens.join(" · ");
}

function formatSectionSummary(product: ManagedProductRow) {
  const sections = product.section_values.filter((item) => item.value.trim());
  if (!sections.length) {
    return product.overview || "No category section values recorded yet.";
  }

  return sections
    .slice(0, 3)
    .map((item) => `${item.section_name}: ${item.value}${item.unit ? ` ${item.unit}` : ""}`)
    .join(" · ");
}

function formatSectionValue(item: ProductSectionValueRecord) {
  return `${item.value}${item.unit ? ` ${item.unit}` : ""}`;
}

export function normalizeManagedProductRecord(record: AdminProductRecord | Record<string, unknown>, categories: Map<string, ProductCategoryApiRecord>) {
  const raw = record as Record<string, unknown>;
  const categoryId = readString(raw, ["category_id"]);
  const embeddedCategory = isRecord(raw.category) ? normalizeCategoryRecord(raw.category) : null;
  const category = embeddedCategory || categories.get(categoryId) || null;
  const sectionValues = readArray(raw, ["section_values", "sections", "attributes"])
    .map((item, index) => normalizeSectionValue(item, index))
    .filter((item): item is SectionDraft => Boolean(item));
  const imageUrls = normalizeProductImageUrls(raw);
  const imageUrl = imageUrls[0] || null;
  const datasheetUrl = readString(raw, ["datasheet_url"]);

  return {
    ...(record as AdminProductRecord),
    id: readString(raw, ["id"]),
    slug: readString(raw, ["slug"]) || readString(raw, ["id"]),
    name: readString(raw, ["name", "product_name"]),
    category_id: categoryId || null,
    category,
    categoryKey: category?.id || categoryId || slugify(category?.name || "uncategorized"),
    categoryLabel: category?.name || readString(raw, ["category_name", "category"], "Uncategorised"),
    price: readNumber(raw, ["price"]),
    stock_quantity: readNumber(raw, ["stock_quantity", "stock"]),
    overview: readString(raw, ["overview", "description", "summary"]) || null,
    section_values: sectionValues,
    product_image_url: imageUrl,
    product_image_urls: imageUrls,
    image_url: imageUrl,
    image_urls: imageUrls,
    image: imageUrl,
    datasheet_url: datasheetUrl || null,
    specifications: isRecord(raw.specifications) ? raw.specifications : {},
    is_active: readBoolean(raw, ["is_active", "published", "active"], true),
    status: readString(raw, ["status"]) || undefined,
    created_at: readString(raw, ["created_at", "createdAt"]),
    updated_at: readString(raw, ["updated_at", "updatedAt"]),
  } satisfies ManagedProductRow;
}

export async function loadProducts(params: {
  page: number;
  query: string;
  categories: Map<string, ProductCategoryApiRecord>;
  limit?: number;
  categoryId?: string;
  isActive?: boolean;
}) {
  const trimmedQuery = params.query.trim();
  const limit = params.limit ?? DEFAULT_PAGE_SIZE;

  const payload = await getProducts({
    page: params.page,
    limit,
    search: trimmedQuery || undefined,
    q: trimmedQuery || undefined,
    category_id: params.categoryId,
    is_active: params.isActive,
  });

  return {
    data: payload.data.map((item) => normalizeManagedProductRecord(item, params.categories)),
    pagination: payload.pagination ?? emptyPagination,
  };
}

async function loadProductRecord(id: string, categories: Map<string, ProductCategoryApiRecord>) {
  const payload = await getProduct(id);
  return normalizeManagedProductRecord(payload.data, categories);
}

async function loadProductFormCategories(limit = productFormCategoryLimit) {
  const payload = await getProductCategories({ page: 1, limit });
  return payload.data.map(normalizeCategoryRecord);
}

async function deleteProductRecord(product: ManagedProductRow) {
  await deleteProduct(product.id);
}

function DocumentSelectField({
  file,
  currentUrl,
  onFileChange,
  emptyLabel,
}: {
  file: File | null;
  currentUrl?: string | null;
  onFileChange: (file: File | null) => void;
  emptyLabel: string;
}) {
  const previewUrl = useObjectUrl(file);
  const activeUrl = previewUrl || currentUrl || "";
  const fileName = file?.name || currentUrl?.split("/").pop() || emptyLabel;
  const kind = inferDocumentKind(activeUrl || fileName, file?.type);

  return (
    <div className="flex flex-col gap-3">
      <label className="upload-field">
        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
        <span className="upload-field__button">
          <span>{file || currentUrl ? "Replace file" : "Choose file"}</span>
        </span>
        <span className="upload-field__value">{fileName}</span>
      </label>

      {activeUrl ? (
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <strong className="truncate text-sm">{fileName}</strong>
            <a href={activeUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[var(--brand)]">
              Open file
            </a>
          </div>
          {kind === "image" ? (
            <img src={activeUrl} alt={fileName} className="h-56 w-full rounded-[14px] object-cover" />
          ) : kind === "pdf" ? (
            <iframe src={activeUrl} title={fileName} className="h-64 w-full rounded-[14px] border border-[var(--border)] bg-white" />
          ) : (
            <div className="flex min-h-40 items-center justify-center rounded-[14px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 text-center text-sm text-[var(--text-soft)]">
              This file can be opened in a new tab.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-8 text-center text-sm text-[var(--text-soft)]">
          {emptyLabel}
        </div>
      )}

      {file ? (
        <button type="button" className="self-start text-xs font-semibold text-[var(--danger)]" onClick={() => onFileChange(null)}>
          Clear selected file
        </button>
      ) : null}
    </div>
  );
}

function ProductImageGalleryField({
  files,
  currentUrls,
  onFilesChange,
  productName,
}: {
  files: File[];
  currentUrls: string[];
  onFilesChange: (files: File[]) => void;
  productName: string;
}) {
  const previewUrls = useObjectUrls(files);
  const activeUrls = previewUrls.length ? previewUrls : currentUrls;
  const hasSelection = files.length > 0 || currentUrls.length > 0;
  const helperLabel = files.length
    ? `${files.length} image${files.length === 1 ? "" : "s"} selected`
    : currentUrls.length
      ? `${currentUrls.length} current image${currentUrls.length === 1 ? "" : "s"} on record`
      : "Upload one or more product images. The first image is used as the primary card image.";

  return (
    <div className="upload-preview-card">
      <label className="upload-field">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))}
        />
        <span className="upload-field__button">
          <span>{hasSelection ? "Replace images" : "Choose images"}</span>
        </span>
        <span className="upload-field__value">{helperLabel}</span>
      </label>

      {activeUrls.length ? (
        <div className="detail-panel__stack">
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-soft)]">
            The first image becomes the primary product image in cards, tables, and store listings.
          </div>
          <div className="thumbnail-strip">
            {activeUrls.map((url, index) => (
              <div key={`${url}-${index}`} className="thumbnail-strip__item">
                <img src={url} alt={`${productName || "Product"} image ${index + 1}`} className="h-full w-full object-cover" />
                {index === 0 ? <span className="thumbnail-strip__badge">Primary</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-8 text-center text-sm text-[var(--text-soft)]">
          Upload one or more product images. The first image will be used as the product card image.
        </div>
      )}

      {files.length ? (
        <button type="button" className="upload-preview-card__reset" onClick={() => onFilesChange([])}>
          {currentUrls.length ? "Use current images instead" : "Clear selected images"}
        </button>
      ) : null}
    </div>
  );
}

function ProductCategoryEditorModal({
  open,
  onClose,
  category,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  category?: ProductCategoryApiRecord | null;
  onSaved?: (result: { name: string; mode: "create" | "edit" }) => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [categoryTitle, setCategoryTitle] = useState("");
  const [categorySections, setCategorySections] = useState<ProductCategorySectionRecord[]>([{ name: "" }]);
  const [requiresDatasheet, setRequiresDatasheet] = useState(false);
  const [requiresProductImage, setRequiresProductImage] = useState(true);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const isEditing = Boolean(category);

  useEffect(() => {
    if (!open) {
      setCategoryTitle("");
      setCategorySections([{ name: "" }]);
      setRequiresDatasheet(false);
      setRequiresProductImage(true);
      return;
    }

    setCategoryTitle(category?.name ?? "");
    setCategorySections(category?.sections?.length ? category.sections : [{ name: "" }]);
    setRequiresDatasheet(Boolean(category?.requires_datasheet));
    setRequiresProductImage(category ? Boolean(category.requires_product_image) : true);
  }, [category, open]);

  function handleClose() {
    if (isSavingCategory) {
      return;
    }

    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingCategory(true);

    try {
      const preparedSections = categorySections
        .map((section, index) => normalizeCategorySection(section, index))
        .filter((section): section is ProductCategorySectionRecord => Boolean(section));

      if (!categoryTitle.trim()) {
        throw new Error("Enter a category title.");
      }

      if (!preparedSections.length) {
        throw new Error("Add at least one category section.");
      }

      const payload = {
        name: categoryTitle.trim(),
        sections: preparedSections.map((section, index) => ({
          ...(section.id ? { id: section.id } : {}),
          name: section.name.trim(),
          position: index + 1,
        })),
        requires_datasheet: requiresDatasheet,
        requires_product_image: requiresProductImage,
      };

      if (category) {
        await updateProductCategory(category.id, payload);
      } else {
        await createProductCategory(payload);
      }

      toast({
        title: isEditing ? "Category updated" : "Category created",
        description: `${payload.name} was ${isEditing ? "updated" : "added"} successfully.`,
        variant: "success",
      });

      if (onSaved) {
        try {
          await onSaved({ name: payload.name, mode: isEditing ? "edit" : "create" });
        } catch (refreshError) {
          toast({
            title: "Refresh failed",
            description: getErrorMessage(
              refreshError,
              "The category was saved, but the category list could not refresh.",
            ),
            variant: "error",
          });
        }
      }

      onClose();
    } catch (saveError) {
      if (isDashboardActionCancelledError(saveError) || isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: isEditing ? "Update failed" : "Create category failed",
        description: getErrorMessage(saveError, "The category could not be saved."),
        variant: "error",
      });
    } finally {
      setIsSavingCategory(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? "Edit Category" : "Create Category"}
      footer={
        <ModalFooterActions
          formId={categoryFormId}
          cancelLabel="Cancel"
          onCancel={handleClose}
          submitLabel={isSavingCategory ? "Saving..." : isEditing ? "Save Changes" : "Create Category"}
          disabled={isSavingCategory}
        />
      }
    >
      <form id={categoryFormId} className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-soft)]">
          Add the category title, define the dynamic sections for products in this category, then decide whether the category requires a datasheet and product image.
        </div>

        <FormField label="Category Title">
          <TextField value={categoryTitle} onChange={(event) => setCategoryTitle(event.target.value)} placeholder="Inverter" />
        </FormField>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <strong className="text-sm">Category Sections</strong>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCategorySections((current) => [...current, { name: "" }])}
            >
              Add Another Section
            </Button>
          </div>
          {categorySections.map((section, index) => (
            <div key={`${section.id || section.key || "section"}-${index}`} className="category-section-row">
              <TextField
                value={section.name}
                onChange={(event) =>
                  setCategorySections((current) =>
                    current.map((item, itemIndex) => (itemIndex === index ? { ...item, name: event.target.value } : item)),
                  )
                }
                placeholder="Section name"
              />
              <button
                type="button"
                className="icon-square-button is-danger"
                onClick={() =>
                  setCategorySections((current) =>
                    current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : [{ name: "" }],
                  )
                }
                aria-label="Remove section"
              >
                <TrashIcon className="mini-icon" />
              </button>
            </div>
          ))}
        </div>

        <div className="grid gap-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold">Require datasheet upload</span>
            <Checkbox checked={requiresDatasheet} onChange={setRequiresDatasheet} />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold">Require product image upload</span>
            <Checkbox checked={requiresProductImage} onChange={setRequiresProductImage} />
          </label>
        </div>
      </form>
    </Modal>
  );
}

export function ProductsManagementScreen() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [view, setView] = useState<ProductView>("Products");
  const [rows, setRows] = useState<ManagedProductRow[]>([]);
  const [productsPagination, setProductsPagination] = useState<PaginationMeta>(emptyPagination);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ProductCategoryApiRecord[]>([]);
  const [categoriesPagination, setCategoriesPagination] = useState<PaginationMeta>(emptyPagination);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("All");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategoryApiRecord | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const canCreateProducts = can("products", "create");
  const canUpdateProducts = can("products", "update") || can("products", "create");
  const canDeleteProducts = can("products", "delete");
  const categoriesMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const notice = searchParams.get("created")
    ? "Product saved successfully."
    : searchParams.get("draft")
      ? "Product saved as draft."
      : null;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setCategoriesLoading(true);
      setCategoriesError(null);

      try {
        const payload = await getProductCategories({
          page: categoryPage,
          limit: DEFAULT_PAGE_SIZE,
          search: deferredQuery.trim() || undefined,
          q: deferredQuery.trim() || undefined,
        });

        if (cancelled) {
          return;
        }

        const normalized = payload.data.map(normalizeCategoryRecord);
        setCategories(normalized);
        setCategoriesPagination(payload.pagination ?? emptyPagination);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setCategories([]);
        setCategoriesPagination(emptyPagination);
        setCategoriesError(getErrorMessage(loadError, "Product categories could not be loaded."));
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [categoryPage, deferredQuery, refreshKey]);

  useEffect(() => {
    if (view !== "Products") {
      return;
    }

    let cancelled = false;

    void (async () => {
      setProductsLoading(true);
      setProductsError(null);

      try {
        const payload = await loadProducts({
          page: productPage,
          query: deferredQuery,
          categories: categoriesMap,
        });

        if (cancelled) {
          return;
        }

        setRows(payload.data);
        setProductsPagination(payload.pagination);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setRows([]);
        setProductsPagination(emptyPagination);
        setProductsError(getErrorMessage(loadError, "Products could not be loaded."));
      } finally {
        if (!cancelled) {
          setProductsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [categoriesMap, deferredQuery, productPage, refreshKey, view]);

  const categoryOptions = useMemo(() => {
    const fallbackCategories = rows
      .filter((item) => item.categoryKey)
      .map((item) => ({ label: item.categoryLabel, value: item.categoryKey }));

    const fromApi = categories.map((category) => ({ label: category.name, value: category.id }));
    const unique = new Map<string, string>();

    [...fromApi, ...fallbackCategories].forEach((option) => {
      if (option.value && !unique.has(option.value)) {
        unique.set(option.value, option.label);
      }
    });

    return [{ label: "All Categories", value: "" }, ...Array.from(unique.entries()).map(([value, label]) => ({ label, value }))];
  }, [categories, rows]);

  const filteredProducts = useMemo(() => {
    return rows.filter((product) => {
      const matchesCategory = !categoryFilter || product.categoryKey === categoryFilter;
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Published" && product.is_active) ||
        (statusFilter === "Draft" && !product.is_active);
      const matchesQuery =
        !deferredQuery.trim() ||
        [product.name, product.categoryLabel, product.overview || "", formatSectionSummary(product)]
          .join(" ")
          .toLowerCase()
          .includes(deferredQuery.trim().toLowerCase());

      return matchesCategory && matchesStatus && matchesQuery;
    });
  }, [categoryFilter, deferredQuery, rows, statusFilter]);

  const describedCategories = categories.filter((category) => (category.sections?.length ?? 0) > 0).length;
  const datasheetEnabledCategories = categories.filter((category) => category.requires_datasheet).length;
  const activeProducts = rows.filter((product) => product.is_active).length;
  const totalStock = rows.reduce((sum, product) => sum + product.stock_quantity, 0);

  function openCreateCategoryModal() {
    setEditingCategory(null);
    setCategoryModalOpen(true);
  }

  function openEditCategoryModal(category: ProductCategoryApiRecord) {
    setEditingCategory(category);
    setCategoryModalOpen(true);
  }

  function closeCategoryModal() {
    setCategoryModalOpen(false);
    setEditingCategory(null);
  }

  async function handleDeleteProduct(product: ManagedProductRow) {
    try {
      await deleteProductRecord(product);
      toast({
        title: "Product deleted",
        description: `${product.name} was removed successfully.`,
        variant: "success",
      });
      setRefreshKey((current) => current + 1);
    } catch (deleteError) {
      if (isDashboardActionCancelledError(deleteError) || isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The product could not be deleted."),
        variant: "error",
      });
    }
  }

  async function handleDeleteCategory(category: ProductCategoryApiRecord) {
    try {
      await deleteProductCategory(category.id);
      toast({
        title: "Category deleted",
        description: `${category.name} was removed successfully.`,
        variant: "success",
      });
      setRefreshKey((current) => current + 1);
    } catch (deleteError) {
      if (isDashboardActionCancelledError(deleteError) || isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The category could not be deleted."),
        variant: "error",
      });
    }
  }

  return (
    <>
      <div className="dashboard-stack">
        {view === "Products" ? (
          <section className="stats-grid--three">
            <MetricCardSecondary title="Products" value={productsPagination.total.toLocaleString()} icon="products" spark={[20, 28, 34, 42, 50, 58]} />
            <MetricCardSecondary title="Published" value={activeProducts.toLocaleString()} icon="verification" spark={[10, 18, 22, 30, 38, 46]} />
            <MetricCardSecondary title="Stock Units" value={totalStock.toLocaleString()} icon="sales" spark={[14, 20, 26, 34, 44, 52]} />
          </section>
        ) : (
          <section className="stats-grid--three">
            <MetricCardSecondary title="Categories" value={categoriesPagination.total.toLocaleString()} icon="products" spark={[12, 16, 22, 28, 32, 36]} />
            <MetricCardSecondary title="With Sections" value={describedCategories.toLocaleString()} icon="sales" spark={[10, 14, 18, 24, 28, 34]} />
            <MetricCardSecondary title="Datasheet Enabled" value={datasheetEnabledCategories.toLocaleString()} icon="verification" spark={[8, 12, 16, 18, 24, 30]} />
          </section>
        )}

        {notice ? <InlineCallout>{notice}</InlineCallout> : null}

        <Panel className="overflow-hidden">
          <div className="management-surface__tabs">
            <Tabs value={view} onChange={setView} options={productViewTabs} />
          </div>

          {view === "Products" ? (
            <>
              <div className="management-surface__body">
                <DirectoryToolbar
                  searchValue={query}
                  onSearchChange={(value) => {
                    setQuery(value);
                    setProductPage(1);
                  }}
                  searchPlaceholder="Search products..."
                  filters={
                    <div className="catalog-filter-stack">
                      <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                        Filter
                      </Button>
                      <SelectField value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} />
                    </div>
                  }
                  action={
                    canCreateProducts ? (
                      <ActionLink href="/products/new" leadingIcon={<PlusIcon className="mini-icon" />}>
                        Add Product
                      </ActionLink>
                    ) : undefined
                  }
                />
              </div>
              <div className="management-surface__filters">
                <Tabs value={statusFilter} onChange={setStatusFilter} options={productStatusTabs} compact />
              </div>
              <ErrorMessage title="Product load failed" message={productsError} />
              {productsLoading && !rows.length ? (
                <div className="p-6">
                  <p className="section-description">Loading products...</p>
                </div>
              ) : !productsLoading && !rows.length && !productsError ? (
                <div className="p-6">
                  <EmptyScaffold title="No products found" description="No record found on the database" />
                </div>
              ) : (
                <>
                  <div className="catalog-grid-wrap">
                    <div className="catalog-grid">
                      {filteredProducts.length ? (
                        filteredProducts.map((product) => {
                          const status = statusFromActive(product.is_active);

                          return (
                            <CatalogCard
                              key={product.id}
                              href={`/products/${product.id}`}
                              image={product.product_image_url || product.image_url || ""}
                              title={product.name}
                              eyebrow={product.categoryLabel}
                              price={formatCurrencyLabel(product.price)}
                              summary={formatSectionSummary(product)}
                              status={<StatusPill label={status.label} tone={status.tone} solid={false} />}
                              stats={[
                                { label: "Stock", value: product.stock_quantity.toLocaleString(), progress: Math.min(Math.max(product.stock_quantity, 8), 100) },
                                { label: "Sections", value: String(product.section_values.filter((item) => item.value.trim()).length), progress: Math.min(Math.max(product.section_values.length * 12, 8), 100) },
                              ]}
                              actions={
                                <TableActionsMenu
                                  items={[
                                    { label: "View Product", href: `/products/${product.id}` },
                                    ...(canUpdateProducts ? [{ label: "Edit Product", href: `/products/${product.id}/edit` }] : []),
                                    ...(canDeleteProducts
                                      ? [
                                          {
                                            label: "Delete Product",
                                            tone: "danger" as const,
                                            icon: <TrashIcon className="menu-icon" />,
                                            onSelect: () => handleDeleteProduct(product),
                                          },
                                        ]
                                      : []),
                                  ]}
                                />
                              }
                            />
                          );
                        })
                      ) : (
                        <div className="p-6">
                          <EmptyScaffold title="No products matched" description="No record found on the database" />
                        </div>
                      )}
                    </div>
                  </div>
                  <Pagination page={productPage} totalPages={Math.max(productsPagination.totalPages, 1)} onChange={setProductPage} />
                </>
              )}
            </>
          ) : (
            <>
              <div className="management-surface__body">
                <DirectoryToolbar
                  searchValue={query}
                  onSearchChange={(value) => {
                    setQuery(value);
                    setCategoryPage(1);
                  }}
                  searchPlaceholder="Search categories..."
                  filters={
                    <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                      Filter
                    </Button>
                  }
                  action={
                    canCreateProducts ? (
                      <Button variant="primary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={openCreateCategoryModal}>
                        Add New Category
                      </Button>
                    ) : undefined
                  }
                />
              </div>
              <ErrorMessage title="Category load failed" message={categoriesError} />
              {categoriesLoading && !categories.length ? (
                <div className="p-6">
                  <p className="section-description">Loading categories...</p>
                </div>
              ) : !categoriesLoading && !categories.length && !categoriesError ? (
                <div className="p-6">
                  <EmptyScaffold title="No categories found" description="No record found on the database" />
                </div>
              ) : (
                <>
                  <div className="category-directory">
                    {categories.map((category) => (
                      <article key={category.id} className={cx("category-card", (category.sections?.length ?? 0) > 0 && "is-emphasis")}>
                        <div className="category-card__copy">
                          <strong>{category.name}</strong>
                          <span>{formatRequirementSummary(category)}</span>
                        </div>
                        <TableActionsMenu
                          items={[
                            ...(canUpdateProducts
                              ? [
                                  {
                                    label: "Edit Category",
                                    onSelect: () => openEditCategoryModal(category),
                                  },
                                ]
                              : []),
                            ...(canDeleteProducts
                              ? [
                                  {
                                    label: "Delete Category",
                                    tone: "danger" as const,
                                    icon: <TrashIcon className="menu-icon" />,
                                    onSelect: () => handleDeleteCategory(category),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </article>
                    ))}
                  </div>
                  <Pagination page={categoryPage} totalPages={Math.max(categoriesPagination.totalPages, 1)} onChange={setCategoryPage} />
                </>
              )}
            </>
          )}
        </Panel>
      </div>

      <ProductCategoryEditorModal
        open={categoryModalOpen}
        onClose={closeCategoryModal}
        category={editingCategory}
        onSaved={() => {
          setRefreshKey((current) => current + 1);
        }}
      />
    </>
  );
}

export function ProductDetailScreen({ productId }: { productId: string }) {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const router = useRouter();
  const [product, setProduct] = useState<ManagedProductRow | null>(null);
  const [categories, setCategories] = useState<ProductCategoryApiRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canDeleteProducts = can("products", "delete");
  const canUpdateProducts = can("products", "update") || can("products", "create");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getProductCategories({ page: 1, limit: 100 }).then((payload) => payload.data.map(normalizeCategoryRecord)).catch(() => []),
    ])
      .then(([categoryRows]) => {
        if (cancelled) {
          return;
        }

        setCategories(categoryRows);
        return loadProductRecord(productId, new Map(categoryRows.map((item) => [item.id, item])));
      })
      .then((resolvedProduct) => {
        if (cancelled) {
          return;
        }

        setProduct(resolvedProduct ?? null);
        if (!resolvedProduct) {
          setError("No record found on the database.");
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Product details could not be loaded."));
          setProduct(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function handleDelete() {
    if (!product) {
      return;
    }

    try {
      await deleteProductRecord(product);
      toast({
        title: "Product deleted",
        description: `${product.name} was removed successfully.`,
        variant: "success",
      });
      router.push("/products");
    } catch (deleteError) {
      if (isDashboardActionCancelledError(deleteError) || isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The product could not be deleted."),
        variant: "error",
      });
    }
  }

  if (!product) {
    return (
      <Panel className="p-6">
        <ErrorMessage title="Product load failed" message={error} />
        {isLoading ? <p className="section-description">Loading product...</p> : <EmptyScaffold title="No product found" description="No record found on the database" />}
      </Panel>
    );
  }

  const status = statusFromActive(product.is_active);
  const selectedCategory = categories.find((item) => item.id === product.category_id) || product.category || null;
  const datasheetKind = product.datasheet_url ? inferDocumentKind(product.datasheet_url) : null;
  const productImageUrls = product.product_image_urls?.length
    ? product.product_image_urls
    : product.product_image_url
      ? [product.product_image_url]
      : [];

  return (
    <div className="dashboard-stack">
      <section className="stats-grid--three">
        <MetricCardSecondary title="Price" value={formatCurrencyLabel(product.price)} icon="sales" spark={[12, 18, 24, 30, 36, 42]} />
        <MetricCardSecondary title="Stock Quantity" value={product.stock_quantity.toLocaleString()} icon="products" spark={[18, 22, 28, 34, 40, 46]} />
        <MetricCardSecondary title="Category Sections" value={product.section_values.length.toLocaleString()} icon="verification" spark={[20, 26, 32, 38, 44, 50]} />
      </section>

      <Panel className="product-detail-shell">
        <div className="product-detail-shell__header">
          <ManagementBackLink href="/products" label={product.name} meta={`Updated ${formatDateLabel(product.updated_at)}`} />
          <TableActionsMenu
            items={[
              ...(canUpdateProducts ? [{ label: "Edit Product", href: `/products/${product.id}/edit` }] : []),
              ...(canDeleteProducts ? [{ label: "Delete Product", tone: "danger" as const, icon: <TrashIcon className="menu-icon" />, onSelect: handleDelete }] : []),
            ]}
          />
        </div>

        <div className="product-detail-grid">
          <DetailPanel title="Product Information">
            <KeyValueList
              items={[
                { label: "Product Id", value: product.id },
                { label: "Slug", value: product.slug },
                { label: "Category", value: product.categoryLabel },
                { label: "Price", value: formatCurrencyLabel(product.price) },
                { label: "Stock", value: `${product.stock_quantity} units` },
                { label: "Status", value: <StatusPill label={status.label} tone={status.tone} /> },
                { label: "Created", value: formatDateLabel(product.created_at) },
                { label: "Updated", value: formatDateLabel(product.updated_at) },
              ]}
            />
            <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <strong className="block text-sm">Overview</strong>
              <p className="mt-2 text-sm text-[var(--text-soft)]">{product.overview || "No product overview was returned for this record."}</p>
            </div>
          </DetailPanel>

          <DetailPanel title="Category Section Values" description={selectedCategory ? formatRequirementSummary(selectedCategory) : undefined}>
            {product.section_values.length ? (
              <KeyValueList
                items={product.section_values.map((item) => ({
                  label: item.section_name,
                  value: formatSectionValue(item),
                }))}
              />
            ) : (
              <p className="section-description">No dynamic section values were recorded for this product.</p>
            )}
          </DetailPanel>

          <DetailPanel title="Product Media">
            <div className="grid gap-4">
              <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                <strong className="mb-3 block text-sm">Product Images</strong>
                {productImageUrls.length ? (
                  <div className="detail-panel__stack">
                    <img src={productImageUrls[0]} alt={product.name} className="h-64 w-full rounded-[14px] object-cover" />
                    {productImageUrls.length > 1 ? (
                      <div className="thumbnail-strip">
                        {productImageUrls.map((imageUrl, index) => (
                          <div key={`${imageUrl}-${index}`} className="thumbnail-strip__item">
                            <img src={imageUrl} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover" />
                            {index === 0 ? <span className="thumbnail-strip__badge">Primary</span> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex min-h-52 items-center justify-center rounded-[14px] border border-dashed border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-soft)]">
                    No product images uploaded.
                  </div>
                )}
              </div>

              <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <strong className="text-sm">Datasheet</strong>
                  {product.datasheet_url ? (
                    <a href={product.datasheet_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[var(--brand)]">
                      Download
                    </a>
                  ) : null}
                </div>
                {product.datasheet_url ? (
                  datasheetKind === "image" ? (
                    <img src={product.datasheet_url} alt={`${product.name} datasheet`} className="h-64 w-full rounded-[14px] object-cover" />
                  ) : datasheetKind === "pdf" ? (
                    <iframe src={product.datasheet_url} title={`${product.name} datasheet`} className="h-64 w-full rounded-[14px] border border-[var(--border)] bg-white" />
                  ) : (
                    <div className="flex min-h-40 items-center justify-center rounded-[14px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 text-center text-sm text-[var(--text-soft)]">
                      Preview is unavailable for this file type. Use the download action instead.
                    </div>
                  )
                ) : (
                  <div className="flex min-h-40 items-center justify-center rounded-[14px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 text-center text-sm text-[var(--text-soft)]">
                    No datasheet uploaded.
                  </div>
                )}
              </div>
            </div>
          </DetailPanel>
        </div>
      </Panel>
    </div>
  );
}

export function ProductFormScreen({ productId }: { productId?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [categories, setCategories] = useState<ProductCategoryApiRecord[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(Boolean(productId));
  const [currentProduct, setCurrentProduct] = useState<ManagedProductRow | null>(null);
  const [name, setName] = useState("");
  const [overview, setOverview] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [sectionValues, setSectionValues] = useState<SectionDraft[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [currentImageUrls, setCurrentImageUrls] = useState<string[]>([]);
  const [datasheetFile, setDatasheetFile] = useState<File | null>(null);
  const [currentDatasheetUrl, setCurrentDatasheetUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const categoriesMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const selectedCategory = categories.find((category) => category.id === categoryId) || null;
  const isPublishedProduct = currentProduct?.is_active ?? false;
  const primaryProductIntent = isPublishedProduct ? "finish" : "finish-publish";
  const primaryProductLabel = isSubmitting ? "Saving..." : isPublishedProduct ? "Save Changes" : "Publish";
  const productSecondaryActions = isPublishedProduct
    ? [{ label: "Move to Draft", intent: "draft" as const, variant: "secondary" as const, disabled: isSubmitting }]
    : [{ label: "Save Draft", intent: "draft" as const, variant: "secondary" as const, disabled: isSubmitting }];

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setCategoriesLoading(true);

      try {
        const nextCategories = await loadProductFormCategories();

        if (!cancelled) {
          setCategories(nextCategories);
        }
      } catch {
        if (!cancelled) {
          setCategories([]);
        }
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!productId) {
      return;
    }

    if (categoriesLoading) {
      return;
    }

    if (currentProduct) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoadingProduct(true);

      try {
        const product = await loadProductRecord(productId, categoriesMap);

        if (cancelled || !product) {
          return;
        }

        setCurrentProduct(product);
        setName(product.name);
        setOverview(product.overview || "");
        setCategoryId(product.category_id || "");
        setPrice(product.price ? String(product.price) : "");
        setStockQuantity(product.stock_quantity ? String(product.stock_quantity) : "");
        setSectionValues(product.section_values.map((item, index) => ({ ...item, key: item.key || `${slugify(item.section_name)}-${index}` })));
        setCurrentImageUrls(product.product_image_urls?.length ? product.product_image_urls : product.product_image_url ? [product.product_image_url] : []);
        setCurrentDatasheetUrl(product.datasheet_url || null);
      } catch (loadError) {
        if (!cancelled) {
          toast({
            title: "Product load failed",
            description: getErrorMessage(loadError, "The product could not be loaded for editing."),
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingProduct(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [categoriesLoading, categoriesMap, currentProduct, productId, toast]);

  useEffect(() => {
    if (!selectedCategory) {
      return;
    }

    setSectionValues((current) => buildSectionDrafts(selectedCategory.sections ?? [], current));
  }, [selectedCategory]);

  function navigateWith(flag: "draft" | "created") {
    startTransition(() => {
      router.push(`/products?${flag}=1`);
    });
  }

  function handleCategoryChange(nextCategoryId: string, categoryRows = categories) {
    setCategoryId(nextCategoryId);
    const nextCategory = categoryRows.find((category) => category.id === nextCategoryId);
    setSectionValues((current) => buildSectionDrafts(nextCategory?.sections ?? [], current));
  }

  async function refreshProductCategories(preferredCategoryName?: string) {
    setCategoriesLoading(true);

    try {
      const nextCategories = await loadProductFormCategories();
      setCategories(nextCategories);

      if (!preferredCategoryName?.trim()) {
        return;
      }

      const normalizedName = preferredCategoryName.trim().toLowerCase();
      const createdCategory = nextCategories.find(
        (category) => category.name.trim().toLowerCase() === normalizedName,
      );

      if (createdCategory) {
        handleCategoryChange(createdCategory.id, nextCategories);
      }
    } finally {
      setCategoriesLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = getFormSubmitIntent(event, primaryProductIntent);
    const isDraft = intent === "draft";
    const shouldPublish = intent === "finish-publish";
    const nextIsActive = isDraft ? false : shouldPublish ? true : currentProduct?.is_active ?? false;

    setIsSubmitting(true);

    try {
      if (!name.trim()) {
        throw new Error("Enter a product name.");
      }

      if (!categoryId) {
        throw new Error("Select a product category.");
      }

      if (!price.trim()) {
        throw new Error("Enter the product price.");
      }

      if (!stockQuantity.trim()) {
        throw new Error("Enter the stock quantity.");
      }

      if (selectedCategory?.requires_product_image && !imageFiles.length && !currentImageUrls.length) {
        throw new Error("Upload at least one product image for this category.");
      }

      if (selectedCategory?.requires_datasheet && !datasheetFile && !currentDatasheetUrl) {
        throw new Error("Upload a datasheet for this category.");
      }

      const primaryImageFile = imageFiles[0] ?? null;
      const payload = {
        name: name.trim(),
        overview: overview.trim(),
        category_id: categoryId,
        price: Number(price),
        stock_quantity: Number(stockQuantity),
        section_values: sectionValues
          .filter((item) => item.section_name.trim())
          .map((item) => ({
            section_id: item.section_id || undefined,
            section_name: item.section_name.trim(),
            value: item.value.trim(),
            unit: item.unit?.trim() || undefined,
          })),
        is_active: nextIsActive,
        ...(primaryImageFile ? { image: primaryImageFile } : {}),
        ...(datasheetFile ? { datasheet: datasheetFile } : {}),
      };
      const formData = buildMultipartFormData(payload);
      imageFiles.forEach((file) => {
        formData.append("images", file);
      });

      if (productId) {
        await updateProduct(productId, formData);
      } else {
        await createProduct(formData);
      }

      navigateWith(nextIsActive ? "created" : "draft");
    } catch (saveError) {
      if (isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: productId ? "Update product failed" : "Create product failed",
        description: getErrorMessage(saveError, "The product could not be saved."),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dashboard-stack">
      <Panel className="product-form-shell">
        <form id={productCreateFormId} onSubmit={handleSubmit}>
          <div className="product-form-shell__header">
            <div>
              <h2 className="section-title">{productId ? "Edit Product" : "Add A New Product"}</h2>
              <p className="section-description">
                Select the category first. The category sections will define the extra fields required for this product.
              </p>
            </div>
            <FormSubmitter
              formId={productCreateFormId}
              cancelLabel="Cancel"
              onCancel={() => router.push(productId ? `/products/${productId}` : "/products")}
              primaryLabel={primaryProductLabel}
              primaryIntent={primaryProductIntent}
              disabled={isSubmitting}
              secondaryActions={productSecondaryActions}
            />
          </div>

          <div className="product-form-grid">
            <DetailPanel title="Basic Information" description="Every product keeps these default fields regardless of category.">
              <div className="detail-panel__stack">
                <div className="product-inline-row">
                  <FormField label="Product Category">
                    <SelectField
                      value={categoryId}
                      onChange={handleCategoryChange}
                      options={[
                        { label: categoriesLoading ? "Loading categories..." : "Select category", value: "" },
                        ...categories.map((category) => ({ label: category.name, value: category.id })),
                      ]}
                    />
                  </FormField>
                  <button
                    type="button"
                    className="icon-square-button"
                    onClick={() => setCategoryModalOpen(true)}
                    aria-label="Add product category"
                    title="Add product category"
                  >
                    <PlusIcon className="mini-icon" />
                  </button>
                </div>
                <FormField label="Product Name">
                  <TextField value={name} onChange={(event) => setName(event.target.value)} placeholder="Product Name" />
                </FormField>
                <FormField label="Overview">
                  <TextAreaField value={overview} onChange={setOverview} placeholder="Short product overview" rows={6} />
                </FormField>
                <div className="product-inline-row is-two">
                  <FormField label="Price">
                    <TextField value={price} onChange={(event) => setPrice(event.target.value)} placeholder="250000" />
                  </FormField>
                  <FormField label="Stock Quantity">
                    <TextField value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} placeholder="22" />
                  </FormField>
                </div>
                {loadingProduct ? <p className="section-description">Loading product data...</p> : null}
              </div>
            </DetailPanel>

            <DetailPanel title="Category Sections" description="These fields are generated from the selected product category.">
              <div className="detail-panel__stack">
                {selectedCategory?.sections?.length ? (
                  sectionValues.map((item, index) => (
                    <div key={item.key} className={cx("product-inline-row", /size/i.test(item.section_name) ? "is-two" : "")}>
                      <FormField label={item.section_name}>
                        <TextField
                          value={item.value}
                          onChange={(event) =>
                            setSectionValues((current) =>
                              current.map((currentItem, currentIndex) =>
                                currentIndex === index ? { ...currentItem, value: event.target.value } : currentItem,
                              ),
                            )
                          }
                          placeholder={`Enter ${item.section_name.toLowerCase()}`}
                        />
                      </FormField>
                      {/size/i.test(item.section_name) ? (
                        <FormField label={`${item.section_name} Unit`}>
                          <TextField
                            value={item.unit || ""}
                            onChange={(event) =>
                              setSectionValues((current) =>
                                current.map((currentItem, currentIndex) =>
                                  currentIndex === index ? { ...currentItem, unit: event.target.value } : currentItem,
                                ),
                              )
                            }
                            placeholder="kVA"
                          />
                        </FormField>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-10 text-center text-sm text-[var(--text-soft)]">
                    Select a category to generate the product section fields.
                  </div>
                )}
              </div>
            </DetailPanel>

            <DetailPanel title="Media & Documents" description="These requirements change with the selected category settings.">
              <div className="detail-panel__stack">
                {selectedCategory?.requires_product_image ? (
                  <FormField label="Product Images">
                    <ProductImageGalleryField
                      files={imageFiles}
                      currentUrls={currentImageUrls}
                      onFilesChange={setImageFiles}
                      productName={name}
                    />
                  </FormField>
                ) : (
                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-soft)]">
                    This category does not require product images.
                  </div>
                )}

                {selectedCategory?.requires_datasheet ? (
                  <FormField label="Datasheet">
                    <DocumentSelectField
                      file={datasheetFile}
                      currentUrl={currentDatasheetUrl}
                      onFileChange={setDatasheetFile}
                      emptyLabel="Upload a datasheet in PDF or image format. A preview will appear here."
                    />
                  </FormField>
                ) : (
                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-soft)]">
                    This category does not require a datasheet.
                  </div>
                )}
              </div>
            </DetailPanel>
          </div>
        </form>
      </Panel>

      <ProductCategoryEditorModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onSaved={({ name }) => refreshProductCategories(name)}
      />
    </div>
  );
}
