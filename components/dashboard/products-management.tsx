"use client";

import { type FormEvent, useDeferredValue, useEffect, useMemo, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { ActionLink, AttachmentItem, CatalogCard, DetailPanel, DirectoryToolbar, InlineCallout, KeyValueList, ManagementBackLink, MediaShowcase } from "@/components/dashboard/management-primitives";
import { FormField, Modal, ModalFooterActions, ModalTextArea, ModalTextInput } from "@/components/dashboard/modals";
import { FormSubmitter, getFormSubmitIntent } from "@/components/dashboard/form-submitter";
import { Button, EmptyScaffold, MetricCardSecondary, Pagination, Panel, SelectField, StatusPill, TableActionsMenu, Tabs, TextAreaField, TextField, cx } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import {
  createProductBattery,
  createProductCategory,
  createProductInverter,
  createProductPanel,
  DEFAULT_PAGE_SIZE,
  deleteProductBattery,
  deleteProductCategory,
  deleteProductInverter,
  deleteProductPanel,
  formatCurrencyLabel,
  formatDateLabel,
  getProductBatteries,
  getProductCategories,
  getProductInverters,
  getProductPanels,
  updateProductCategory,
} from "@/lib/admin-api";
import { isDashboardSessionExpiredError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type {
  PaginationMeta,
  ProductBatteryRecord,
  ProductCategoryApiRecord,
  ProductInverterRecord,
  ProductPanelRecord,
} from "@/types/api.types";

const productViewTabs = ["Products", "Categories"] as const;
const productStatusTabs = ["All", "Active", "Inactive"] as const;
const productTypeOptions = ["Panels", "Inverters", "Batteries"] as const;
const productTypeValueOptions = [
  { label: "Panels", value: "panels" },
  { label: "Inverters", value: "inverters" },
  { label: "Batteries", value: "batteries" },
] as const;
const categoryFormId = "product-category-form";
const productCreateFormId = "product-create-form";

type ProductView = (typeof productViewTabs)[number];
type ProductStatusFilter = (typeof productStatusTabs)[number];
type ProductKind = "panels" | "inverters" | "batteries";

type ProductCatalogRow = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  type: ProductKind;
  categoryLabel: string;
  price: number;
  stockQuantity: number;
  imageUrl: string;
  isActive: boolean;
  summary: string;
  primaryStatLabel: string;
  primaryStatValue: string;
  primaryStatProgress: number;
  secondaryStatLabel: string;
  secondaryStatValue: string;
  secondaryStatProgress: number;
  detailItems: Array<{ label: string; value: string }>;
  specifications: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type ProductDetailProps =
  | { productType: "panels"; product: ProductPanelRecord }
  | { productType: "inverters"; product: ProductInverterRecord }
  | { productType: "batteries"; product: ProductBatteryRecord };

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

function normalizePanelRecord(product: ProductPanelRecord): ProductCatalogRow {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    type: "panels",
    categoryLabel: "Panels",
    price: product.price,
    stockQuantity: product.stock_quantity,
    imageUrl: product.image_url,
    isActive: product.is_active,
    summary: `${product.brand}${product.wattage ? ` · ${product.wattage}W` : ""}`,
    primaryStatLabel: "Stock",
    primaryStatValue: String(product.stock_quantity),
    primaryStatProgress: Math.min(Math.max(product.stock_quantity, 8), 100),
    secondaryStatLabel: "Efficiency",
    secondaryStatValue: `${product.efficiency}%`,
    secondaryStatProgress: Math.min(Math.max(product.efficiency, 8), 100),
    detailItems: [
      { label: "Wattage", value: `${product.wattage}W` },
      { label: "Efficiency", value: `${product.efficiency}%` },
      { label: "Voltage", value: `${product.voltage}V` },
      { label: "Dimensions", value: product.dimensions || "N/A" },
      { label: "Weight", value: `${product.weight_kg}kg` },
    ],
    specifications: product.specifications,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

function normalizeInverterRecord(product: ProductInverterRecord): ProductCatalogRow {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    type: "inverters",
    categoryLabel: "Inverters",
    price: product.price,
    stockQuantity: product.stock_quantity,
    imageUrl: product.image_url,
    isActive: product.is_active,
    summary: `${product.brand}${product.type ? ` · ${product.type}` : ""}`,
    primaryStatLabel: "Stock",
    primaryStatValue: String(product.stock_quantity),
    primaryStatProgress: Math.min(Math.max(product.stock_quantity, 8), 100),
    secondaryStatLabel: "Capacity",
    secondaryStatValue: `${product.capacity_kva}kVA`,
    secondaryStatProgress: Math.min(Math.max(product.capacity_kva * 10, 8), 100),
    detailItems: [
      { label: "Type", value: product.type || "N/A" },
      { label: "Capacity", value: `${product.capacity_kva}kVA` },
      { label: "Efficiency", value: `${product.efficiency}%` },
      { label: "Voltage Range", value: product.voltage_range || "N/A" },
    ],
    specifications: product.specifications,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

function normalizeBatteryRecord(product: ProductBatteryRecord): ProductCatalogRow {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    type: "batteries",
    categoryLabel: "Batteries",
    price: product.price,
    stockQuantity: product.stock_quantity,
    imageUrl: product.image_url,
    isActive: product.is_active,
    summary: `${product.brand}${product.type ? ` · ${product.type}` : ""}`,
    primaryStatLabel: "Stock",
    primaryStatValue: String(product.stock_quantity),
    primaryStatProgress: Math.min(Math.max(product.stock_quantity, 8), 100),
    secondaryStatLabel: "Capacity",
    secondaryStatValue: `${product.capacity_ah}Ah`,
    secondaryStatProgress: Math.min(Math.max(product.capacity_ah / 2, 8), 100),
    detailItems: [
      { label: "Capacity", value: `${product.capacity_ah}Ah` },
      { label: "Voltage", value: `${product.voltage}V` },
      { label: "Type", value: product.type || "N/A" },
      { label: "Cycle Life", value: String(product.cycle_life) },
    ],
    specifications: product.specifications,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

function getKindFromLabel(label: string): ProductKind {
  switch (label) {
    case "Inverters":
      return "inverters";
    case "Batteries":
      return "batteries";
    default:
      return "panels";
  }
}

function getLabelFromKind(kind: ProductKind) {
  switch (kind) {
    case "inverters":
      return "Inverters";
    case "batteries":
      return "Batteries";
    default:
      return "Panels";
  }
}

function getStatusMetadata(isActive: boolean) {
  const label = isActive ? "Active" : "Inactive";
  return {
    label,
    tone: toneFromStatus(label),
  };
}

async function deleteProductByKind(kind: ProductKind, id: string) {
  switch (kind) {
    case "inverters":
      return deleteProductInverter(id);
    case "batteries":
      return deleteProductBattery(id);
    default:
      return deleteProductPanel(id);
  }
}

export function ProductsManagementScreen() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [view, setView] = useState<ProductView>("Products");
  const [rows, setRows] = useState<ProductCatalogRow[]>([]);
  const [productsPagination, setProductsPagination] = useState<PaginationMeta>(emptyPagination);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ProductCategoryApiRecord[]>([]);
  const [categoriesPagination, setCategoriesPagination] = useState<PaginationMeta>(emptyPagination);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState<(typeof productTypeOptions)[number]>("Panels");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("All");
  const [productPage, setProductPage] = useState(1);
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategoryApiRecord | null>(null);
  const [categoryTitle, setCategoryTitle] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryImageUrl, setCategoryImageUrl] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const canCreateProducts = can("products", "create");
  const canUpdateProducts = can("products", "update") || can("products", "create");
  const canDeleteProducts = can("products", "delete");
  const productKind = getKindFromLabel(productTypeFilter);

  useEffect(() => {
    if (view !== "Products") {
      return;
    }

    let cancelled = false;

    setProductsLoading(true);
    setProductsError(null);

    const request =
      productKind === "inverters"
        ? getProductInverters({
            page: productPage,
            limit: DEFAULT_PAGE_SIZE,
            search: deferredQuery.trim() || undefined,
            q: deferredQuery.trim() || undefined,
            fields: ["id", "slug", "name", "brand", "type", "capacity_kva", "efficiency", "price", "stock_quantity", "image_url", "is_active"],
          }).then((payload) => ({
            data: payload.data.map(normalizeInverterRecord),
            pagination: payload.pagination,
          }))
        : productKind === "batteries"
          ? getProductBatteries({
              page: productPage,
              limit: DEFAULT_PAGE_SIZE,
              search: deferredQuery.trim() || undefined,
              q: deferredQuery.trim() || undefined,
              fields: ["id", "slug", "name", "brand", "type", "capacity_ah", "voltage", "cycle_life", "price", "stock_quantity", "image_url", "is_active"],
            }).then((payload) => ({
              data: payload.data.map(normalizeBatteryRecord),
              pagination: payload.pagination,
            }))
          : getProductPanels({
              page: productPage,
              limit: DEFAULT_PAGE_SIZE,
              search: deferredQuery.trim() || undefined,
              q: deferredQuery.trim() || undefined,
              fields: ["id", "slug", "name", "brand", "wattage", "efficiency", "price", "stock_quantity", "image_url", "is_active"],
            }).then((payload) => ({
              data: payload.data.map(normalizePanelRecord),
              pagination: payload.pagination,
            }));

    request
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setRows(payload.data);
        setProductsPagination(payload.pagination);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setProductsError(getErrorMessage(loadError, "Products could not be loaded."));
        setRows([]);
        setProductsPagination(emptyPagination);
      })
      .finally(() => {
        if (!cancelled) {
          setProductsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deferredQuery, productKind, productPage, refreshKey, view]);

  useEffect(() => {
    if (view !== "Categories") {
      return;
    }

    let cancelled = false;

    setCategoriesLoading(true);
    setCategoriesError(null);

    getProductCategories({
      page: categoryPage,
      limit: DEFAULT_PAGE_SIZE,
      search: deferredQuery.trim() || undefined,
      q: deferredQuery.trim() || undefined,
      fields: ["id", "name", "description", "image_url", "created_at"],
    })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setCategories(payload.data);
        setCategoriesPagination(payload.pagination);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setCategoriesError(getErrorMessage(loadError, "Product categories could not be loaded."));
        setCategories([]);
        setCategoriesPagination(emptyPagination);
      })
      .finally(() => {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [categoryPage, deferredQuery, refreshKey, view]);

  const filteredProducts = useMemo(
    () =>
      rows.filter((product) => {
        const status = product.isActive ? "Active" : "Inactive";
        return statusFilter === "All" || statusFilter === status;
      }),
    [rows, statusFilter],
  );

  const activeProducts = rows.filter((product) => product.isActive).length;
  const totalStock = rows.reduce((sum, product) => sum + product.stockQuantity, 0);
  const describedCategories = categories.filter((category) => Boolean(category.description)).length;
  const imagedCategories = categories.filter((category) => Boolean(category.image_url)).length;
  const notice = searchParams.get("created") ? "Product saved successfully." : searchParams.get("draft") ? "Product draft saved." : null;

  function resetCategoryForm() {
    setEditingCategory(null);
    setCategoryTitle("");
    setCategoryDescription("");
    setCategoryImageUrl("");
  }

  function openCreateCategoryModal() {
    resetCategoryForm();
    setCategoryModalOpen(true);
  }

  function openEditCategoryModal(category: ProductCategoryApiRecord) {
    setEditingCategory(category);
    setCategoryTitle(category.name);
    setCategoryDescription(category.description ?? "");
    setCategoryImageUrl(category.image_url ?? "");
    setCategoryModalOpen(true);
  }

  function closeCategoryModal() {
    if (isSavingCategory) {
      return;
    }

    setCategoryModalOpen(false);
    resetCategoryForm();
  }

  async function handleDeleteProduct(product: ProductCatalogRow) {
    try {
      await deleteProductByKind(product.type, product.id);
      toast({
        title: "Product deleted",
        description: `${product.name} was removed successfully.`,
        variant: "success",
      });

      if (rows.length === 1 && productPage > 1) {
        setProductPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch (deleteError) {
      if (isDashboardSessionExpiredError(deleteError)) {
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

      if (categories.length === 1 && categoryPage > 1) {
        setCategoryPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch (deleteError) {
      if (isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The category could not be deleted."),
        variant: "error",
      });
    }
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingCategory(true);

    try {
      const payload = {
        name: categoryTitle.trim(),
        description: categoryDescription.trim(),
        image_url: categoryImageUrl.trim(),
      };

      if (editingCategory) {
        await updateProductCategory(editingCategory.id, payload);
      } else {
        await createProductCategory(payload);
      }

      toast({
        title: editingCategory ? "Category updated" : "Category created",
        description: `${payload.name} was ${editingCategory ? "updated" : "added"} successfully.`,
        variant: "success",
      });
      setCategoryModalOpen(false);
      resetCategoryForm();
      setCategoryPage(1);
      setRefreshKey((current) => current + 1);
    } catch (saveError) {
      if (isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: editingCategory ? "Update failed" : "Create category failed",
        description: getErrorMessage(saveError, "The category could not be saved."),
        variant: "error",
      });
    } finally {
      setIsSavingCategory(false);
    }
  }

  return (
    <>
      <div className="dashboard-stack">
        {view === "Products" ? (
          <section className="stats-grid--three">
            <MetricCardSecondary title={`Total ${productTypeFilter}`} value={productsPagination.total.toLocaleString()} icon="products" spark={[20, 28, 34, 42, 50, 58]} />
            <MetricCardSecondary title="Active On This Page" value={activeProducts.toLocaleString()} icon="verification" spark={[10, 18, 22, 30, 38, 46]} />
            <MetricCardSecondary title="Stock Units" value={totalStock.toLocaleString()} icon="sales" spark={[14, 20, 26, 34, 44, 52]} />
          </section>
        ) : (
          <section className="stats-grid--three">
            <MetricCardSecondary title="Total Categories" value={categoriesPagination.total.toLocaleString()} icon="products" spark={[12, 16, 22, 28, 32, 36]} />
            <MetricCardSecondary title="With Description" value={describedCategories.toLocaleString()} icon="sales" spark={[10, 14, 18, 24, 28, 34]} />
            <MetricCardSecondary title="With Images" value={imagedCategories.toLocaleString()} icon="verification" spark={[8, 12, 16, 18, 24, 30]} />
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
                  onSearchChange={setQuery}
                  searchPlaceholder={`Search ${productTypeFilter.toLowerCase()}...`}
                  filters={
                    <div className="catalog-filter-stack">
                      <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                        Filter
                      </Button>
                      <SelectField
                        value={productTypeFilter}
                        onChange={(value) => {
                          setProductTypeFilter(value as (typeof productTypeOptions)[number]);
                          setProductPage(1);
                        }}
                        options={[...productTypeOptions]}
                      />
                    </div>
                  }
                  action={canCreateProducts ? <ActionLink href="/products/new" leadingIcon={<PlusIcon className="mini-icon" />}>Add Product</ActionLink> : undefined}
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
                          const status = getStatusMetadata(product.isActive);

                          return (
                            <CatalogCard
                              key={`${product.type}-${product.id}`}
                              href={`/products/${product.id}?type=${product.type}`}
                              image={product.imageUrl || ""}
                              title={product.name}
                              eyebrow={product.categoryLabel}
                              price={formatCurrencyLabel(product.price)}
                              summary={product.summary}
                              status={<StatusPill label={status.label} tone={status.tone} solid={false} />}
                              stats={[
                                { label: product.primaryStatLabel, value: product.primaryStatValue, progress: product.primaryStatProgress },
                                { label: product.secondaryStatLabel, value: product.secondaryStatValue, progress: product.secondaryStatProgress },
                              ]}
                              actions={
                                <TableActionsMenu
                                  items={[
                                    { label: "View Product", href: `/products/${product.id}?type=${product.type}` },
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
                  onSearchChange={setQuery}
                  searchPlaceholder="Search Category..."
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
                    {categories.length ? (
                      categories.map((category) => (
                        <article key={category.id} className={cx("category-card", category.image_url && "is-emphasis")}>
                          <div className="category-card__copy">
                            <strong>{category.name}</strong>
                            <span>{category.description || `Created ${formatDateLabel(category.created_at)}`}</span>
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
                      ))
                    ) : (
                      <div className="p-6">
                        <EmptyScaffold title="No categories matched" description="No record found on the database" />
                      </div>
                    )}
                  </div>
                  <Pagination page={categoryPage} totalPages={Math.max(categoriesPagination.totalPages, 1)} onChange={setCategoryPage} />
                </>
              )}
            </>
          )}
        </Panel>
      </div>

      <Modal
        open={categoryModalOpen}
        onClose={closeCategoryModal}
        title={editingCategory ? "Edit Category" : "Create Category"}
        footer={
          <ModalFooterActions
            formId={categoryFormId}
            cancelLabel="Cancel"
            onCancel={closeCategoryModal}
            submitLabel={isSavingCategory ? (editingCategory ? "Saving..." : "Creating...") : editingCategory ? "Save Changes" : "Create Category"}
            disabled={isSavingCategory}
          />
        }
      >
        <form id={categoryFormId} className="notification-wizard" onSubmit={handleCategorySubmit}>
          <div className="notification-wizard__heading">
            <span>Complete the information below. We will save the category for product grouping.</span>
          </div>
          <FormField label="Category Title">
            <ModalTextInput value={categoryTitle} onChange={(event) => setCategoryTitle(event.target.value)} placeholder="eg Batteries" />
          </FormField>
          <FormField label="Description">
            <ModalTextArea value={categoryDescription} onChange={setCategoryDescription} placeholder="Short category description" />
          </FormField>
          <FormField label="Image URL">
            <ModalTextInput value={categoryImageUrl} onChange={(event) => setCategoryImageUrl(event.target.value)} placeholder="https://example.com/category.png" />
          </FormField>
        </form>
      </Modal>
    </>
  );
}

function buildProductDetailRow({ productType, product }: ProductDetailProps) {
  const status = getStatusMetadata(product.is_active);
  const specificationEntries = Object.entries(product.specifications ?? {});
  const common = {
    status,
    specificationEntries,
    metaTitle: `${getLabelFromKind(productType)} Details`,
  };

  if (productType === "panels") {
    return {
      ...common,
      heroMetrics: [
        { title: "Panel Price", value: formatCurrencyLabel(product.price), icon: "sales" as const, spark: [12, 18, 24, 30, 36, 42] },
        { title: "Stock Quantity", value: product.stock_quantity.toLocaleString(), icon: "products" as const, spark: [18, 22, 28, 34, 40, 46] },
        { title: "Power Output", value: `${product.wattage}W`, icon: "verification" as const, spark: [20, 26, 32, 38, 44, 50] },
      ],
      infoItems: [
        { label: "Product Id", value: product.id },
        { label: "Slug", value: product.slug },
        { label: "Name", value: product.name },
        { label: "Category", value: "Panels" },
        { label: "Brand", value: product.brand },
        { label: "Price", value: formatCurrencyLabel(product.price) },
        { label: "Stock", value: `${product.stock_quantity} units` },
        { label: "Status", value: <StatusPill label={status.label} tone={status.tone} /> },
        { label: "Created", value: formatDateLabel(product.created_at) },
        { label: "Updated", value: formatDateLabel(product.updated_at) },
      ],
      specItems: [
        { label: "Wattage", value: `${product.wattage}W` },
        { label: "Efficiency", value: `${product.efficiency}%` },
        { label: "Voltage", value: `${product.voltage}V` },
        { label: "Dimensions", value: product.dimensions || "N/A" },
        { label: "Weight", value: `${product.weight_kg}kg` },
      ],
    };
  }

  if (productType === "inverters") {
    return {
      ...common,
      heroMetrics: [
        { title: "Inverter Price", value: formatCurrencyLabel(product.price), icon: "sales" as const, spark: [12, 18, 24, 30, 36, 42] },
        { title: "Stock Quantity", value: product.stock_quantity.toLocaleString(), icon: "products" as const, spark: [18, 22, 28, 34, 40, 46] },
        { title: "Capacity", value: `${product.capacity_kva}kVA`, icon: "verification" as const, spark: [20, 26, 32, 38, 44, 50] },
      ],
      infoItems: [
        { label: "Product Id", value: product.id },
        { label: "Slug", value: product.slug },
        { label: "Name", value: product.name },
        { label: "Category", value: "Inverters" },
        { label: "Brand", value: product.brand },
        { label: "Price", value: formatCurrencyLabel(product.price) },
        { label: "Stock", value: `${product.stock_quantity} units` },
        { label: "Status", value: <StatusPill label={status.label} tone={status.tone} /> },
        { label: "Created", value: formatDateLabel(product.created_at) },
        { label: "Updated", value: formatDateLabel(product.updated_at) },
      ],
      specItems: [
        { label: "Type", value: product.type || "N/A" },
        { label: "Capacity", value: `${product.capacity_kva}kVA` },
        { label: "Efficiency", value: `${product.efficiency}%` },
        { label: "Voltage Range", value: product.voltage_range || "N/A" },
      ],
    };
  }

  return {
    ...common,
    heroMetrics: [
      { title: "Battery Price", value: formatCurrencyLabel(product.price), icon: "sales" as const, spark: [12, 18, 24, 30, 36, 42] },
      { title: "Stock Quantity", value: product.stock_quantity.toLocaleString(), icon: "products" as const, spark: [18, 22, 28, 34, 40, 46] },
      { title: "Capacity", value: `${product.capacity_ah}Ah`, icon: "verification" as const, spark: [20, 26, 32, 38, 44, 50] },
    ],
    infoItems: [
      { label: "Product Id", value: product.id },
      { label: "Slug", value: product.slug },
      { label: "Name", value: product.name },
      { label: "Category", value: "Batteries" },
      { label: "Brand", value: product.brand },
      { label: "Price", value: formatCurrencyLabel(product.price) },
      { label: "Stock", value: `${product.stock_quantity} units` },
      { label: "Status", value: <StatusPill label={status.label} tone={status.tone} /> },
      { label: "Created", value: formatDateLabel(product.created_at) },
      { label: "Updated", value: formatDateLabel(product.updated_at) },
    ],
    specItems: [
      { label: "Capacity", value: `${product.capacity_ah}Ah` },
      { label: "Voltage", value: `${product.voltage}V` },
      { label: "Type", value: product.type || "N/A" },
      { label: "Cycle Life", value: String(product.cycle_life) },
    ],
  };
}

export function ProductDetailScreen(props: ProductDetailProps) {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const router = useRouter();
  const canDeleteProducts = can("products", "delete");
  const detail = buildProductDetailRow(props);

  async function handleDeleteProduct() {
    try {
      await deleteProductByKind(props.productType, props.product.id);
      toast({
        title: "Product deleted",
        description: `${props.product.name} was removed successfully.`,
        variant: "success",
      });
      router.push("/products");
    } catch (deleteError) {
      if (isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The product could not be deleted."),
        variant: "error",
      });
    }
  }

  return (
    <div className="dashboard-stack">
      <section className="stats-grid--three">
        {detail.heroMetrics.map((metric) => (
          <MetricCardSecondary key={metric.title} title={metric.title} value={metric.value} icon={metric.icon} spark={metric.spark} />
        ))}
      </section>
      <Panel className="product-detail-shell">
        <div className="product-detail-shell__header">
          <ManagementBackLink href="/products" label={props.product.name} meta={`Updated ${formatDateLabel(props.product.updated_at)}`} />
          <TableActionsMenu
            items={[
              ...(canDeleteProducts ? [{ label: "Delete Product", tone: "danger" as const, icon: <TrashIcon className="menu-icon" />, onSelect: handleDeleteProduct }] : []),
            ]}
          />
        </div>

        <div className="product-detail-grid">
          <DetailPanel title="Product Information">
            <KeyValueList items={detail.infoItems} />
            <div className="detail-panel__stack">
              <div>
                <p className="section-description">Product Media</p>
                <div className="media-card">
                  <span className="product-placeholder" aria-hidden="true" />
                </div>
              </div>
              <AttachmentItem label={props.product.image_url || "No image URL available"} helper="Primary Image" actionLabel="Preview" />
            </div>
          </DetailPanel>

          <DetailPanel title={detail.metaTitle} description="Core product specifications returned by the admin API.">
            <KeyValueList items={detail.specItems} />
          </DetailPanel>

          <DetailPanel title="Additional Metadata">
            {detail.specificationEntries.length ? (
              <KeyValueList
                items={detail.specificationEntries.map(([label, value]) => ({
                  label,
                  value: typeof value === "string" ? value : JSON.stringify(value),
                }))}
              />
            ) : (
              <p className="section-description">No extra product metadata was returned for this product.</p>
            )}
          </DetailPanel>

          <DetailPanel title="Product Details Gallery or Showcase">
            <MediaShowcase title={props.product.name} image={props.product.image_url} gallery={props.product.image_url ? [props.product.image_url] : []} />
          </DetailPanel>
        </div>
      </Panel>
    </div>
  );
}

type SpecRow = { label: string; value: string };

export function ProductFormScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const [productType, setProductType] = useState<ProductKind>("panels");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("active");
  const [panelWattage, setPanelWattage] = useState("");
  const [panelEfficiency, setPanelEfficiency] = useState("");
  const [panelVoltage, setPanelVoltage] = useState("");
  const [panelDimensions, setPanelDimensions] = useState("");
  const [panelWeight, setPanelWeight] = useState("");
  const [inverterType, setInverterType] = useState("");
  const [capacityKva, setCapacityKva] = useState("");
  const [inverterEfficiency, setInverterEfficiency] = useState("");
  const [voltageRange, setVoltageRange] = useState("");
  const [batteryType, setBatteryType] = useState("");
  const [capacityAh, setCapacityAh] = useState("");
  const [batteryVoltage, setBatteryVoltage] = useState("");
  const [cycleLife, setCycleLife] = useState("");
  const [specs, setSpecs] = useState<SpecRow[]>([
    { label: "Warranty", value: "" },
    { label: "Installation", value: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function navigateWith(flag: "draft" | "created") {
    startTransition(() => {
      router.push(`/products?${flag}=1`);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = getFormSubmitIntent(event, "finish");
    const isDraft = intent === "draft";
    setIsSubmitting(true);

    try {
      const specifications = Object.fromEntries(
        specs.filter((row) => row.label.trim()).map((row) => [row.label.trim(), row.value.trim()]),
      );

      const isActive = isDraft ? false : status === "active";

      if (productType === "panels") {
        await createProductPanel({
          name: name.trim(),
          brand: brand.trim(),
          wattage: Number(panelWattage),
          efficiency: Number(panelEfficiency),
          voltage: Number(panelVoltage),
          dimensions: panelDimensions.trim(),
          weight_kg: Number(panelWeight),
          price: Number(price),
          stock_quantity: Number(stockQuantity),
          image_url: imageUrl.trim(),
          specifications,
          is_active: isActive,
        });
      } else if (productType === "inverters") {
        await createProductInverter({
          name: name.trim(),
          brand: brand.trim(),
          type: inverterType.trim(),
          capacity_kva: Number(capacityKva),
          efficiency: Number(inverterEfficiency),
          voltage_range: voltageRange.trim(),
          price: Number(price),
          stock_quantity: Number(stockQuantity),
          image_url: imageUrl.trim(),
          specifications,
          is_active: isActive,
        });
      } else {
        await createProductBattery({
          name: name.trim(),
          brand: brand.trim(),
          capacity_ah: Number(capacityAh),
          voltage: Number(batteryVoltage),
          type: batteryType.trim(),
          cycle_life: Number(cycleLife),
          price: Number(price),
          stock_quantity: Number(stockQuantity),
          image_url: imageUrl.trim(),
          specifications,
          is_active: isActive,
        });
      }

      navigateWith(isDraft ? "draft" : "created");
    } catch (saveError) {
      if (isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: "Create product failed",
        description: getErrorMessage(saveError, "The product could not be created."),
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
              <h2 className="section-title">Add A New Product</h2>
              <p className="section-description">Create a panel, inverter, or battery from the admin product endpoints.</p>
            </div>
            <FormSubmitter
              formId={productCreateFormId}
              cancelLabel="Cancel"
              onCancel={() => router.push("/products")}
              primaryLabel={isSubmitting ? "Saving..." : "Finish"}
              primaryIntent="finish"
              disabled={isSubmitting}
              secondaryActions={[
                { label: "Save to Draft", intent: "draft", variant: "secondary", disabled: isSubmitting },
                { label: "Finish & Publish", intent: "finish-publish", variant: "primary", disabled: isSubmitting },
              ]}
            />
          </div>

          <div className="product-form-grid">
            <DetailPanel title="Basic Information" description="Capture the core product fields required by the selected product endpoint.">
              <div className="detail-panel__stack">
                <FormField label="Product Type">
                  <SelectField value={productType} onChange={(value) => setProductType(value as ProductKind)} options={productTypeValueOptions.map((option) => ({ label: option.label, value: option.value }))} />
                </FormField>
                <FormField label="Product Name">
                  <TextField value={name} onChange={(event) => setName(event.target.value)} placeholder="Product Name" />
                </FormField>
                <FormField label="Brand Name">
                  <TextField value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Brand Name" />
                </FormField>
                <div className="product-inline-row is-three">
                  <FormField label="Stock Quantity">
                    <TextField value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} placeholder="22" />
                  </FormField>
                  <FormField label="Price">
                    <TextField value={price} onChange={(event) => setPrice(event.target.value)} placeholder="250000" />
                  </FormField>
                  <FormField label="Status">
                    <SelectField value={status} onChange={setStatus} options={["active", "inactive"]} />
                  </FormField>
                </div>
                <FormField label="Image URL">
                  <TextField value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://example.com/image.png" />
                </FormField>
              </div>
            </DetailPanel>

            <DetailPanel title="Type-Specific Fields" description="These fields switch automatically based on the selected product type.">
              <div className="detail-panel__stack">
                {productType === "panels" ? (
                  <>
                    <div className="product-inline-row is-three">
                      <FormField label="Wattage">
                        <TextField value={panelWattage} onChange={(event) => setPanelWattage(event.target.value)} placeholder="550" />
                      </FormField>
                      <FormField label="Efficiency">
                        <TextField value={panelEfficiency} onChange={(event) => setPanelEfficiency(event.target.value)} placeholder="21.3" />
                      </FormField>
                      <FormField label="Voltage">
                        <TextField value={panelVoltage} onChange={(event) => setPanelVoltage(event.target.value)} placeholder="48" />
                      </FormField>
                    </div>
                    <FormField label="Dimensions">
                      <TextField value={panelDimensions} onChange={(event) => setPanelDimensions(event.target.value)} placeholder="2278 x 1134 x 35mm" />
                    </FormField>
                    <FormField label="Weight (kg)">
                      <TextField value={panelWeight} onChange={(event) => setPanelWeight(event.target.value)} placeholder="28.5" />
                    </FormField>
                  </>
                ) : null}

                {productType === "inverters" ? (
                  <>
                    <FormField label="Inverter Type">
                      <TextField value={inverterType} onChange={(event) => setInverterType(event.target.value)} placeholder="Hybrid" />
                    </FormField>
                    <div className="product-inline-row is-three">
                      <FormField label="Capacity (kVA)">
                        <TextField value={capacityKva} onChange={(event) => setCapacityKva(event.target.value)} placeholder="5" />
                      </FormField>
                      <FormField label="Efficiency">
                        <TextField value={inverterEfficiency} onChange={(event) => setInverterEfficiency(event.target.value)} placeholder="96" />
                      </FormField>
                      <FormField label="Voltage Range">
                        <TextField value={voltageRange} onChange={(event) => setVoltageRange(event.target.value)} placeholder="120 - 450V" />
                      </FormField>
                    </div>
                  </>
                ) : null}

                {productType === "batteries" ? (
                  <>
                    <FormField label="Battery Type">
                      <TextField value={batteryType} onChange={(event) => setBatteryType(event.target.value)} placeholder="Lithium" />
                    </FormField>
                    <div className="product-inline-row is-three">
                      <FormField label="Capacity (Ah)">
                        <TextField value={capacityAh} onChange={(event) => setCapacityAh(event.target.value)} placeholder="200" />
                      </FormField>
                      <FormField label="Voltage">
                        <TextField value={batteryVoltage} onChange={(event) => setBatteryVoltage(event.target.value)} placeholder="48" />
                      </FormField>
                      <FormField label="Cycle Life">
                        <TextField value={cycleLife} onChange={(event) => setCycleLife(event.target.value)} placeholder="6000" />
                      </FormField>
                    </div>
                  </>
                ) : null}
              </div>
            </DetailPanel>

            <DetailPanel title="Product Specifications" description="Additional key/value metadata is sent under the `specifications` object.">
              <div className="detail-panel__stack">
                {specs.map((row, index) => (
                  <div key={`${row.label}-${index}`} className="form-repeat-row">
                    <TextField
                      value={row.label}
                      onChange={(event) =>
                        setSpecs((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))
                      }
                      placeholder="Label"
                    />
                    <TextField
                      value={row.value}
                      onChange={(event) =>
                        setSpecs((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))
                      }
                      placeholder="Value"
                    />
                    <button
                      type="button"
                      className="icon-square-button is-danger"
                      onClick={() => setSpecs((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      aria-label="Remove specification row"
                    >
                      <TrashIcon className="mini-icon" />
                    </button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => setSpecs((current) => [...current, { label: "", value: "" }])}>
                  Add Spec
                </Button>
                <FormField label="Preview Notes">
                  <TextAreaField
                    value={specs
                      .filter((row) => row.label || row.value)
                      .map((row) => `${row.label || "Specification"}: ${row.value || "N/A"}`)
                      .join("\n")}
                    onChange={() => undefined}
                    placeholder="Specifications preview"
                    rows={6}
                  />
                </FormField>
              </div>
            </DetailPanel>
          </div>
        </form>
      </Panel>
    </div>
  );
}
