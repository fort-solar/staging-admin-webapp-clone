"use client";

import Image from "next/image";
import { type FormEvent, useDeferredValue, useMemo, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  productCategories,
  productCategoriesMetrics,
  productRecords,
  productsMetrics,
  type ProductCategoryRecord,
  type ProductRecord,
} from "@/lib/management-data";
import {
  Button,
  MetricCardSecondary,
  Panel,
  SelectField,
  StatusPill,
  TableActionsMenu,
  Tabs,
  TextAreaField,
  TextField,
  cx,
} from "@/components/dashboard/ui";
import { FormField, Modal, ModalTextInput, UploadField } from "@/components/dashboard/modals";
import { FormSubmitter, getFormSubmitIntent } from "@/components/dashboard/form-submitter";
import { ActionLink, AttachmentItem, CatalogCard, DetailPanel, DirectoryToolbar, InlineCallout, KeyValueList, ManagementBackLink, MediaShowcase } from "@/components/dashboard/management-primitives";
import { FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { productAssets, toneFromStatus } from "@/lib/dashboard-data";

const productViewTabs = ["Products", "Categories"] as const;
const productStatusTabs = ["All", "Active", "Inactive", "Pending"] as const;
const categoryFormId = "product-category-form";
const productCreateFormId = "product-create-form";

type ProductView = (typeof productViewTabs)[number];
type ProductStatusFilter = (typeof productStatusTabs)[number];

function ProductMetricsStrip({ categoryMode = false }: { categoryMode?: boolean }) {
  const metrics = categoryMode ? productCategoriesMetrics : productsMetrics;
  const className = categoryMode ? "stats-grid--three" : "stats-grid--four";

  return (
    <section className={className}>
      {metrics.map((metric) => (
        <MetricCardSecondary key={metric.title} {...metric} />
      ))}
    </section>
  );
}

export function ProductsManagementScreen() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<ProductView>("Products");
  const [rows, setRows] = useState(productRecords);
  const [categories, setCategories] = useState<ProductCategoryRecord[]>(productCategories);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("All");
  const [page, setPage] = useState(1);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryTitle, setCategoryTitle] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredProducts = useMemo(
    () =>
      rows.filter((product) => {
        const haystack = `${product.name} ${product.brand} ${product.category} ${product.summary}`.toLowerCase();
        const matchesQuery = haystack.includes(deferredQuery.toLowerCase());
        const matchesCategory = categoryFilter === "All" || product.category === categoryFilter;
        const matchesStatus = statusFilter === "All" || product.status === statusFilter;
        return matchesQuery && matchesCategory && matchesStatus;
      }),
    [categoryFilter, deferredQuery, rows, statusFilter],
  );

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.title.toLowerCase().includes(deferredQuery.toLowerCase())),
    [categories, deferredQuery],
  );

  const notice = searchParams.get("created") ? "Product form submitted. Connect the API to persist this into the live catalogue." : searchParams.get("draft") ? "Draft saved locally. Hook the endpoint next." : null;

  return (
    <>
      <div className="dashboard-stack">
        <ProductMetricsStrip categoryMode={view === "Categories"} />
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
                  searchPlaceholder="Search Product..."
                  filters={
                    <div className="catalog-filter-stack">
                      <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                        Filter
                      </Button>
                      <SelectField
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        options={["All", ...Array.from(new Set(rows.map((product) => product.category)))]}
                      />
                    </div>
                  }
                  action={<ActionLink href="/products/new" leadingIcon={<PlusIcon className="mini-icon" />}>Add Product</ActionLink>}
                />
              </div>
              <div className="management-surface__filters">
                <Tabs value={statusFilter} onChange={setStatusFilter} options={productStatusTabs} compact />
              </div>
              <div className="catalog-grid-wrap">
                <div className="catalog-grid">
                  {filteredProducts.map((product) => (
                    <CatalogCard
                      key={product.id}
                      href={`/products/${product.slug}`}
                      image={product.image}
                      title={product.name}
                      eyebrow={product.category}
                      price={product.price}
                      summary={product.summary}
                      status={<StatusPill label={product.status} tone={product.statusTone} solid={false} />}
                      stats={[
                        { label: "Sales", value: String(product.sales), progress: Math.min(product.sales * 2.2, 100) },
                        { label: "Remaining Products", value: String(product.remaining), progress: Math.min(product.remaining / 15, 100) },
                      ]}
                      actions={
                        <TableActionsMenu
                          items={[
                            { label: "View Product", href: `/products/${product.slug}` },
                            { label: "Delete Product", tone: "danger", icon: <TrashIcon className="menu-icon" />, onSelect: () => setRows((current) => current.filter((item) => item.id !== product.id)) },
                          ]}
                        />
                      }
                    />
                  ))}
                </div>
              </div>
              <div className="pagination">
                <Button variant="secondary" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  Prev
                </Button>
                <span className="pagination__page is-active">{page}</span>
                <Button variant="secondary" size="sm" onClick={() => setPage((current) => current + 1)}>
                  Next
                </Button>
              </div>
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
                    <Button variant="primary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={() => setCategoryModalOpen(true)}>
                      Add New Category
                    </Button>
                  }
                />
              </div>
              <div className="category-directory">
                {filteredCategories.map((category) => (
                  <article key={category.id} className={cx("category-card", category.emphasis && "is-emphasis")}>
                    <div className="category-card__copy">
                      <strong>{category.title}</strong>
                      <span>{category.productCount} products</span>
                    </div>
                    <TableActionsMenu
                      items={[
                        {
                          label: "Rename Category",
                          onSelect: () => {
                            setCategoryTitle(category.title);
                            setCategoryModalOpen(true);
                          },
                        },
                        {
                          label: "Delete Category",
                          tone: "danger",
                          icon: <TrashIcon className="menu-icon" />,
                          onSelect: () => setCategories((current) => current.filter((item) => item.id !== category.id)),
                        },
                      ]}
                    />
                  </article>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>

      <Modal
        open={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false);
          setCategoryTitle("");
        }}
        title="Create Category"
        footer={
          <FormSubmitter
            formId={categoryFormId}
            cancelLabel="Cancel"
            onCancel={() => {
              setCategoryModalOpen(false);
              setCategoryTitle("");
            }}
            primaryLabel="Create"
          />
        }
      >
        <form
          id={categoryFormId}
          className="notification-wizard"
          onSubmit={(event) => {
            event.preventDefault();
            setCategories((current) => [
              { id: `CAT-${Date.now()}`, title: categoryTitle || "New Category", productCount: 0, emphasis: false },
              ...current,
            ]);
            setCategoryModalOpen(false);
            setCategoryTitle("");
          }}
        >
          <div className="notification-wizard__heading">
            <span>Complete the information below. We will create the category for product grouping.</span>
          </div>
          <FormField label="Category Title">
            <ModalTextInput value={categoryTitle} onChange={(event) => setCategoryTitle(event.target.value)} placeholder="eg Batteries" />
          </FormField>
        </form>
      </Modal>
    </>
  );
}

export function ProductDetailScreen({ product }: { product: ProductRecord }) {
  const [status, setStatus] = useState(product.status);
  const [statusTone, setStatusTone] = useState(product.statusTone);

  return (
    <div className="dashboard-stack">
      <ProductMetricsStrip />
      <InlineCallout>Preview data is wired end-to-end in the UI. Persisting edits is the remaining API task.</InlineCallout>
      <Panel className="product-detail-shell">
        <div className="product-detail-shell__header">
          <ManagementBackLink href="/products" label={product.name} meta={product.submittedAt} />
          <TableActionsMenu
            items={[
              {
                label: "Publish Product",
                onSelect: () => {
                  setStatus("Active");
                  setStatusTone(toneFromStatus("Active"));
                },
              },
              {
                label: "Archive Product",
                onSelect: () => {
                  setStatus("Inactive");
                  setStatusTone(toneFromStatus("Inactive"));
                },
              },
              { label: "Delete Product", tone: "danger", icon: <TrashIcon className="menu-icon" /> },
            ]}
          />
        </div>

        <div className="product-detail-grid">
          <DetailPanel title="Product Information">
            <KeyValueList
              items={[
                { label: "Product Id", value: product.id },
                { label: "Name", value: product.name },
                { label: "Category", value: product.category },
                { label: "Price", value: product.price },
                { label: "Stock", value: `${product.quantity} units` },
                { label: "Status", value: <StatusPill label={status} tone={statusTone} /> },
              ]}
            />
            <div className="detail-panel__stack">
              <div>
                <p className="section-description">Product Media</p>
                <div className="media-card">
                  <Image src={product.image} alt={product.name} fill sizes="420px" />
                </div>
              </div>
              <AttachmentItem label={product.datasheet} helper="Datasheet" />
            </div>
          </DetailPanel>

          <DetailPanel title="Product Description" description={product.description}>
            <KeyValueList items={product.highlights.map((item) => ({ label: item.label, value: item.value }))} />
          </DetailPanel>

          <DetailPanel title="Product Details Gallery or Showcase">
            <MediaShowcase title={product.name} image={product.image} gallery={product.gallery} />
          </DetailPanel>
        </div>
      </Panel>
    </div>
  );
}

type SpecRow = { label: string; value: string };

export function ProductFormScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [overview, setOverview] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("Panels");
  const [quantity, setQuantity] = useState("22");
  const [discountedPrice, setDiscountedPrice] = useState("98,000");
  const [price, setPrice] = useState("110,400");
  const [datasheet, setDatasheet] = useState("");
  const [galleryFile, setGalleryFile] = useState("");
  const [mediaFile, setMediaFile] = useState("");
  const [specs, setSpecs] = useState<SpecRow[]>([
    { label: "Power Output", value: "550W" },
    { label: "Type", value: "" },
    { label: "Efficiency", value: "" },
  ]);

  function navigateWith(flag: "draft" | "created") {
    startTransition(() => {
      router.push(`/products?${flag}=1`);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = getFormSubmitIntent(event, "finish");
    navigateWith(intent === "draft" ? "draft" : "created");
  }

  return (
    <div className="dashboard-stack">
      <ProductMetricsStrip />
      <InlineCallout>All controls below are functional in the UI. The remaining work is wiring these payloads to the product API.</InlineCallout>
      <Panel className="product-form-shell">
        <form id={productCreateFormId} onSubmit={handleSubmit}>
          <div className="product-form-shell__header">
            <div>
              <h2 className="section-title">Add A New Product</h2>
              <p className="section-description">Use existing admin primitives and keep the final payload ready for API integration.</p>
            </div>
            <FormSubmitter
              formId={productCreateFormId}
              cancelLabel="Cancel"
              onCancel={() => router.push("/products")}
              primaryLabel="Finish"
              primaryIntent="finish"
              secondaryActions={[
                { label: "Save to Draft", intent: "draft", variant: "secondary" },
                { label: "Finish & Publish", intent: "finish-publish", variant: "primary" },
              ]}
            />
          </div>

          <div className="product-form-grid">
          <DetailPanel title="Basic Information" description="Capture the core product metadata that will eventually be submitted to the API.">
            <div className="detail-panel__stack">
              <FormField label="Product">
                <TextField value={name} onChange={(event) => setName(event.target.value)} placeholder="Product Name" />
              </FormField>
              <FormField label="Product Overview">
                <TextAreaField value={overview} onChange={setOverview} placeholder="Product Overview" rows={6} />
              </FormField>
              <FormField label="Brand Name">
                <TextField value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Brand Name" />
              </FormField>
              <FormField label="Category">
                <div className="product-inline-row">
                  <SelectField value={category} onChange={setCategory} options={["Panels", "Inverters", "Batteries", "Accessories"]} />
                  <button type="button" className="icon-square-button" aria-label="Create product category">
                    <PlusIcon className="mini-icon" />
                  </button>
                </div>
              </FormField>
              <div className="product-inline-row is-three">
                <FormField label="Quantity">
                  <TextField value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="22" />
                </FormField>
                <FormField label="Discounted Price">
                  <TextField value={discountedPrice} onChange={(event) => setDiscountedPrice(event.target.value)} placeholder="Price (₦)" />
                </FormField>
                <FormField label="Price">
                  <TextField value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Price (₦)" />
                </FormField>
              </div>
            </div>
          </DetailPanel>

          <DetailPanel title="Product Highlights / Quick Specs" description="Keep this block reusable because the same pattern is used across the catalog.">
            <div className="detail-panel__stack">
              {specs.map((row, index) => (
                <div key={`${row.label}-${index}`} className="form-repeat-row">
                  <SelectField
                    value={row.label}
                    onChange={(value) =>
                      setSpecs((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, label: value } : item)))
                    }
                    options={["Power Output", "Type", "Efficiency", "Warranty", "Voltage", "Battery Support"]}
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSpecs((current) => [...current, { label: "Specification", value: "" }])}
              >
                Add Spec
              </Button>

              <div className="detail-panel__stack">
                <FormField label="Product Media">
                  <div className="upload-preview-card">
                    <div className="upload-preview-card__canvas">
                      <Image src={productAssets.panel} alt="Product media preview" fill sizes="320px" />
                    </div>
                    <div className="thumbnail-strip">
                      {[productAssets.panel, productAssets.inverter, productAssets.battery].map((asset, index) => (
                        <span key={`${asset}-${index}`} className="thumbnail-strip__item">
                          <Image src={asset} alt={`Media ${index + 1}`} fill sizes="78px" />
                        </span>
                      ))}
                    </div>
                  </div>
                </FormField>
                <FormField label="Product img / video">
                  <UploadField value={mediaFile} onChange={setMediaFile} buttonLabel="Upload media" accept=".jpg,.jpeg,.png,.mp4" />
                </FormField>
              </div>
            </div>
          </DetailPanel>

          <DetailPanel title="Product Details Gallery or Showcase" description="Show the same media block users will see on the detail page.">
            <div className="detail-panel__stack">
              <div className="upload-showcase-empty">
                <PlusIcon className="mini-icon" />
                <p>Upload product details (JPG, PNG) to display on the product page.</p>
              </div>
              <UploadField value={galleryFile} onChange={setGalleryFile} buttonLabel="Upload gallery" accept=".jpg,.jpeg,.png" />
              <AttachmentItem label={datasheet || "Datasheet-1"} helper="Datasheet" />
              <FormField label="Add Data sheet">
                <UploadField value={datasheet} onChange={setDatasheet} buttonLabel="Upload file" accept=".pdf,.doc,.docx" />
              </FormField>
            </div>
          </DetailPanel>
          </div>
        </form>
      </Panel>
    </div>
  );
}
