"use client";

import { type FormEvent, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { ActionLink, CatalogCard, DetailPanel, DirectoryToolbar, InlineCallout, KeyValueList, ManagementBackLink } from "@/components/dashboard/management-primitives";
import { FormField } from "@/components/dashboard/modals";
import { FormSubmitter, getFormSubmitIntent } from "@/components/dashboard/form-submitter";
import { Button, Checkbox, EmptyScaffold, MetricCardSecondary, Pagination, Panel, SelectField, StatusPill, TableActionsMenu, TextAreaField, TextField } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import {
  buildMultipartFormData,
  createPackage,
  DEFAULT_PAGE_SIZE,
  deletePackage,
  formatCurrencyLabel,
  formatDateLabel,
  getPackage,
  getPackageBySlug,
  getPackages,
  getProductCategories,
  getProducts,
  loadAllPaginatedRecords,
  updatePackage,
} from "@/lib/admin-api";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import type { ManagedMediaAsset, PackageProductItemRecord, PackageRecord, PackageSystemDetailsRecord, PaginationMeta, ProductCategoryApiRecord } from "@/types/api.types";
import {
  normalizeManagedProductRecord,
  normalizeCategoryRecord,
  type ManagedProductRow,
} from "@/components/dashboard/products-management";

const packageCreateFormId = "package-create-form";
const appliancePresetOptions = ["Laptops", "Phones", "Fridge", "Microwave", "Led Bulbs", "Outlets", "TVs", "Standing Fan", "Washing Machine"];

type PackageItemDraft = {
  key: string;
  category_id: string;
  product_id: string;
  quantity: string;
};

type ManagedPackageRow = PackageRecord & {
  overviewText: string;
  thumbnailUrl: string | null;
  packageImageUrl: string | null;
  selectedProducts: PackageProductItemRecord[];
  discountPercentage: number;
  solarFinanceEnabled: boolean;
  whatItPowers: string[];
  systemDetails: PackageSystemDetailsRecord;
  datasheetAssets: ManagedMediaAsset[];
  productGallery: string[];
  finalPrice: number;
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

function inferAssetKind(source: string, mimeType?: string | null) {
  const normalizedSource = source.toLowerCase();
  const normalizedMime = mimeType?.toLowerCase() ?? "";

  if (normalizedMime.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/.test(normalizedSource)) {
    return "image" as const;
  }

  if (normalizedMime.includes("pdf") || normalizedSource.endsWith(".pdf")) {
    return "pdf" as const;
  }

  return "file" as const;
}

function normalizeAsset(record: unknown, fallbackName: string): ManagedMediaAsset | null {
  if (typeof record === "string" && record.trim()) {
    return {
      name: fallbackName,
      url: record.trim(),
      kind: inferAssetKind(record.trim()),
    };
  }

  if (!isRecord(record)) {
    return null;
  }

  const url = readString(record, ["url", "file_url", "image_url", "datasheet_url", "href"]);

  if (!url) {
    return null;
  }

  const mimeType = readString(record, ["mime_type", "mimeType"]) || null;

  return {
    id: readString(record, ["id"]) || undefined,
    name: readString(record, ["name", "filename", "title"], fallbackName),
    url,
    mime_type: mimeType,
    kind: inferAssetKind(url, mimeType),
  };
}

function normalizePackageItem(record: unknown, index: number): PackageProductItemRecord | null {
  if (!isRecord(record)) {
    return null;
  }

  const productRecord = isRecord(record.product) ? (record.product as ManagedProductRow) : null;

  return {
    id: readString(record, ["id"]) || undefined,
    category_id: readString(record, ["category_id"]),
    category_name: readString(record, ["category_name", "category"], productRecord?.categoryLabel || undefined),
    product_id: readString(record, ["product_id", "id"], productRecord?.id || ""),
    product_name: readString(record, ["product_name", "name"], productRecord?.name || `Product ${index + 1}`),
    quantity: readNumber(record, ["quantity"], 1),
    product: productRecord || null,
  };
}

function formatSystemLabel(value: string, unit: string) {
  if (!value.trim()) {
    return "0";
  }

  return `${value.trim()}${unit}`;
}

function normalizePackageRecord(record: PackageRecord | Record<string, unknown>) {
  const raw = record as Record<string, unknown>;
  const items = readArray(raw, ["items", "products", "package_items"])
    .map((item, index) => normalizePackageItem(item, index))
    .filter((item): item is PackageProductItemRecord => Boolean(item));
  const systemDetailsRecord = isRecord(raw.system_details) ? raw.system_details : {};
  const overviewText = readString(raw, ["overview", "description", "summary"]);
  const discountPercentage = readNumber(raw, ["discount_percentage", "discount"]);
  const datasheetCandidates = [
    ...readArray(raw, ["datasheets"]).map((asset, index) => normalizeAsset(asset, `Datasheet ${index + 1}`)),
    ...items
      .map((item) => normalizeAsset(item.product?.datasheet_url || null, `${item.product_name || "Product"} Datasheet`))
      .filter((asset): asset is ManagedMediaAsset => Boolean(asset)),
  ].filter((asset): asset is ManagedMediaAsset => Boolean(asset));
  const datasheetAssets = datasheetCandidates.filter((asset, index, all) => all.findIndex((candidate) => candidate.url === asset.url) === index);
  const productGallery = [
    ...readArray(raw, ["product_images"]).filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ...items.map((item) => item.product?.product_image_url || item.product?.image_url || "").filter(Boolean),
  ].filter((value, index, all) => all.indexOf(value) === index);

  return {
    ...(record as PackageRecord),
    id: readString(raw, ["id"]),
    slug: readString(raw, ["slug"]) || readString(raw, ["id"]),
    name: readString(raw, ["name"]),
    description: overviewText || null,
    price: readNumber(raw, ["price"]),
    image_url: readString(raw, ["image_url", "package_image_url", "thumbnail_url", "image"]) || null,
    thumbnailUrl: readString(raw, ["thumbnail_url", "image_url", "image"]) || null,
    packageImageUrl: readString(raw, ["package_image_url", "image_url", "image"]) || null,
    overviewText,
    selectedProducts: items,
    discountPercentage,
    solarFinanceEnabled: readBoolean(raw, ["solar_finance_enabled", "solar_finance"]),
    whatItPowers: readArray(raw, ["what_it_powers", "powers"]).filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    systemDetails: {
      inverter_size: readString(systemDetailsRecord, ["inverter_size"], readString(raw, ["system_size_kw"])),
      inverter_label: readString(systemDetailsRecord, ["inverter_label"]) || formatSystemLabel(readString(systemDetailsRecord, ["inverter_size"], readString(raw, ["system_size_kw"])), "kVA"),
      pv_size: readString(systemDetailsRecord, ["pv_size"], readString(raw, ["system_size_kw"])),
      pv_label: readString(systemDetailsRecord, ["pv_label"]) || formatSystemLabel(readString(systemDetailsRecord, ["pv_size"], readString(raw, ["system_size_kw"])), "kWp"),
      battery_size: readString(systemDetailsRecord, ["battery_size"], readBoolean(raw, ["battery_included"]) ? "Included" : ""),
      battery_label: readString(systemDetailsRecord, ["battery_label"]) || formatSystemLabel(readString(systemDetailsRecord, ["battery_size"], readBoolean(raw, ["battery_included"]) ? "1" : "0"), "kWh"),
    },
    datasheetAssets,
    productGallery,
    finalPrice: Math.max(0, readNumber(raw, ["price"]) - (readNumber(raw, ["price"]) * discountPercentage) / 100),
  } satisfies ManagedPackageRow;
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

function PackageMetricsStrip({
  total,
  active,
  financeEnabled,
}: {
  total: number;
  active: number;
  financeEnabled: number;
}) {
  return (
    <section className="stats-grid--three">
      <MetricCardSecondary title="Total Packages" value={total.toLocaleString()} icon="bundles" spark={[18, 20, 24, 32, 40, 48]} />
      <MetricCardSecondary title="Published" value={active.toLocaleString()} icon="verification" spark={[28, 24, 21, 18, 16, 14]} />
      <MetricCardSecondary title="Solar Finance Enabled" value={financeEnabled.toLocaleString()} icon="sales" spark={[12, 18, 22, 34, 46, 54]} />
    </section>
  );
}

export function BundlesManagementScreen() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<ManagedPackageRow[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const canCreateBundles = can("bundles", "create");
  const canUpdateBundles = can("bundles", "update") || can("bundles", "create");
  const canDeleteBundles = can("bundles", "delete");
  const notice = searchParams.get("created")
    ? "Package saved successfully."
    : searchParams.get("draft")
      ? "Package saved as draft."
      : null;

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setIsLoading(true);
        setError(null);
      }
    });

    getPackages({
      page,
      limit: DEFAULT_PAGE_SIZE,
      search: deferredQuery.trim() || undefined,
      q: deferredQuery.trim() || undefined,
    })
      .then((payload) => {
        if (!cancelled) {
          setRows(payload.data.map(normalizePackageRecord));
          setPagination(payload.pagination ?? emptyPagination);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setRows([]);
          setPagination(emptyPagination);
          setError(getErrorMessage(loadError, "Packages could not be loaded."));
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
  }, [deferredQuery, page, refreshKey]);

  async function handleDeletePackage(pkg: ManagedPackageRow) {
    try {
      await deletePackage(pkg.id);
      toast({
        title: "Package deleted",
        description: `${pkg.name} was removed successfully.`,
        variant: "success",
      });
      setRefreshKey((current) => current + 1);
    } catch (deleteError) {
      if (isDashboardActionCancelledError(deleteError) || isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The package could not be deleted."),
        variant: "error",
      });
    }
  }

  const activePackages = rows.filter((pkg) => pkg.is_active).length;
  const solarFinanceEnabled = rows.filter((pkg) => pkg.solarFinanceEnabled).length;

  return (
    <div className="dashboard-stack">
      <PackageMetricsStrip total={pagination.total} active={activePackages} financeEnabled={solarFinanceEnabled} />
      {notice ? <InlineCallout>{notice}</InlineCallout> : null}
      <Panel className="overflow-hidden">
        <div className="management-surface__body">
          <DirectoryToolbar
            searchValue={query}
            onSearchChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            searchPlaceholder="Search packages..."
            filters={
              <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                Filter
              </Button>
            }
            action={
              canCreateBundles ? (
                <ActionLink href="/packages/new" leadingIcon={<PlusIcon className="mini-icon" />}>
                  Add New Package
                </ActionLink>
              ) : undefined
            }
          />
        </div>
        <ErrorMessage title="Package load failed" message={error} />
        {!isLoading && !rows.length && !error ? (
          <div className="p-6">
            <EmptyScaffold title="No packages found" description="No record found on the database" />
          </div>
        ) : (
          <>
            <div className="catalog-grid-wrap">
              <div className="catalog-grid">
                {rows.length ? (
                  rows.map((pkg) => {
                    const status = pkg.is_active ? "Published" : "Draft";

                    return (
                      <CatalogCard
                        key={pkg.id}
                        href={`/packages/${pkg.id}`}
                        image={pkg.thumbnailUrl || pkg.packageImageUrl || ""}
                        title={pkg.name}
                        eyebrow={`${pkg.selectedProducts.length} products included`}
                        price={formatCurrencyLabel(pkg.finalPrice || pkg.price)}
                        summary={pkg.overviewText || "No package overview available."}
                        status={<StatusPill label={status} tone={pkg.is_active ? "success" : "warning"} solid={false} />}
                        stats={[
                          { label: "Discount", value: `${pkg.discountPercentage || 0}%`, progress: Math.min(Math.max((pkg.discountPercentage || 0) * 5, 8), 100) },
                          { label: "Finance", value: pkg.solarFinanceEnabled ? "Enabled" : "Disabled", progress: pkg.solarFinanceEnabled ? 100 : 8 },
                        ]}
                        actions={
                          <TableActionsMenu
                            items={[
                              { label: "View Package", href: `/packages/${pkg.id}` },
                              ...(canUpdateBundles ? [{ label: "Edit Package", href: `/packages/${pkg.id}/edit` }] : []),
                              ...(canDeleteBundles
                                ? [
                                    {
                                      label: "Delete Package",
                                      tone: "danger" as const,
                                      icon: <TrashIcon className="menu-icon" />,
                                      onSelect: () => handleDeletePackage(pkg),
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
                    <EmptyScaffold title="No packages matched" description="No record found on the database" />
                  </div>
                )}
              </div>
            </div>
            <Pagination page={page} totalPages={Math.max(pagination.totalPages, 1)} onChange={setPage} />
          </>
        )}
      </Panel>
    </div>
  );
}

export function BundleDetailScreen({ packageId }: { packageId: string }) {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const router = useRouter();
  const [pkg, setPackage] = useState<ManagedPackageRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string>("");
  const canUpdateBundles = can("bundles", "update") || can("bundles", "create");
  const canDeleteBundles = can("bundles", "delete");

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setIsLoading(true);
        setError(null);
      }
    });

    getPackage(packageId)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        const normalized = normalizePackageRecord(payload.data);
        setPackage(normalized);
        setActiveImage(normalized.packageImageUrl || normalized.thumbnailUrl || normalized.productGallery[0] || "");
      })
      .catch(() =>
        getPackageBySlug(packageId)
          .then((record) => {
            if (cancelled) {
              return;
            }

            if (!record) {
              setPackage(null);
              setError("No record found on the database.");
              return;
            }

            const normalized = normalizePackageRecord(record);
            setPackage(normalized);
            setActiveImage(normalized.packageImageUrl || normalized.thumbnailUrl || normalized.productGallery[0] || "");
          })
          .catch((loadError) => {
            if (!cancelled) {
              setPackage(null);
              setError(getErrorMessage(loadError, "Package details could not be loaded."));
            }
          }),
      )
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [packageId]);

  async function handleDelete() {
    if (!pkg) {
      return;
    }

    try {
      await deletePackage(pkg.id);
      toast({
        title: "Package deleted",
        description: `${pkg.name} was removed successfully.`,
        variant: "success",
      });
      router.push("/packages");
    } catch (deleteError) {
      if (isDashboardActionCancelledError(deleteError) || isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The package could not be deleted."),
        variant: "error",
      });
    }
  }

  if (!pkg) {
    return (
      <Panel className="p-6">
        <ErrorMessage title="Package load failed" message={error} />
        {isLoading ? <p className="section-description">Loading package...</p> : <EmptyScaffold title="No package found" description="No record found on the database" />}
      </Panel>
    );
  }

  const gallery = [pkg.packageImageUrl, ...pkg.productGallery].filter((value): value is string => Boolean(value));

  return (
    <div className="dashboard-stack">
      <PackageMetricsStrip total={1} active={pkg.is_active ? 1 : 0} financeEnabled={pkg.solarFinanceEnabled ? 1 : 0} />
      <Panel className="product-detail-shell">
        <div className="product-detail-shell__header">
          <ManagementBackLink href="/packages" label={pkg.name} meta={`Updated ${formatDateLabel(pkg.updated_at)}`} />
          <TableActionsMenu
            items={[
              ...(canUpdateBundles ? [{ label: "Edit Package", href: `/packages/${pkg.id}/edit` }] : []),
              ...(canDeleteBundles ? [{ label: "Delete Package", tone: "danger" as const, icon: <TrashIcon className="menu-icon" />, onSelect: handleDelete }] : []),
            ]}
          />
        </div>

        <div className="bundle-detail-grid">
          <DetailPanel title="Package Information">
            <KeyValueList
              items={[
                { label: "Package Id", value: pkg.id },
                { label: "Slug", value: pkg.slug },
                { label: "Price", value: formatCurrencyLabel(pkg.price) },
                { label: "Discount", value: `${pkg.discountPercentage || 0}%` },
                { label: "Final Price", value: formatCurrencyLabel(pkg.finalPrice || pkg.price) },
                { label: "Status", value: <StatusPill label={pkg.is_active ? "Published" : "Draft"} tone={pkg.is_active ? "success" : "warning"} /> },
              ]}
            />
            <div className="rounded-[18px] border border-(--border) bg-(--surface-muted) p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <strong className="block text-sm">Solar Finance</strong>
                  <p className="mt-1 text-sm text-(--text-soft)">{pkg.solarFinanceEnabled ? "Enabled for customers who need installment or credit options." : "Disabled for this package."}</p>
                </div>
                <Checkbox checked={pkg.solarFinanceEnabled} onChange={() => undefined} />
              </div>
            </div>
            <div>
              <strong className="mb-3 block text-sm">What This Package Includes</strong>
              <KeyValueList
                items={pkg.selectedProducts.map((item) => ({
                  label: item.product_name || "Product",
                  value: `x${item.quantity}`,
                }))}
              />
            </div>
          </DetailPanel>

          <DetailPanel title="Package Overview" description={pkg.overviewText || "No package overview available."}>
            <div className="grid gap-4">
              <div>
                <strong className="mb-3 block text-sm">System Details</strong>
                <KeyValueList
                  items={[
                    { label: "Inverter Size", value: pkg.systemDetails.inverter_label || pkg.systemDetails.inverter_size || "N/A" },
                    { label: "PV Size", value: pkg.systemDetails.pv_label || pkg.systemDetails.pv_size || "N/A" },
                    { label: "Battery Size", value: pkg.systemDetails.battery_label || pkg.systemDetails.battery_size || "N/A" },
                  ]}
                />
              </div>
              <div>
                <strong className="mb-3 block text-sm">What It Powers</strong>
                <div className="flex flex-wrap gap-2">
                  {pkg.whatItPowers.length ? (
                    pkg.whatItPowers.map((item) => (
                      <span key={item} className="tag-list__item">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-(--text-soft)">No power capacity tags were added for this package.</span>
                  )}
                </div>
              </div>
              <div className="rounded-[18px] border border-(--border) bg-[var(--surface-muted)] p-3">
                <strong className="mb-3 block text-sm">Package Thumbnail</strong>
                {pkg.thumbnailUrl ? (
                  <img src={pkg.thumbnailUrl} alt={`${pkg.name} thumbnail`} className="aspect-[4/3] w-full max-w-[520px] rounded-[14px] object-cover" />
                ) : (
                  <div className="flex aspect-[4/3] w-full max-w-[520px] items-center justify-center rounded-[14px] border border-dashed border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-soft)]">
                    No thumbnail uploaded.
                  </div>
                )}
              </div>
            </div>
          </DetailPanel>

          <DetailPanel title="Media">
            <div className="grid gap-4">
              <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                <strong className="mb-3 block text-sm">Package Image & Product Images</strong>
                {activeImage ? (
                  <img src={activeImage} alt={pkg.name} className="h-64 w-full rounded-[14px] object-cover" />
                ) : (
                  <div className="flex min-h-52 items-center justify-center rounded-[14px] border border-dashed border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-soft)]">
                    No package image uploaded.
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {gallery.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      className={`h-16 w-16 overflow-hidden rounded-[12px] border ${activeImage === image ? "border-[var(--brand)]" : "border-[var(--border)]"}`}
                      onClick={() => setActiveImage(image)}
                    >
                      <img src={image} alt={`${pkg.name} gallery ${index + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                <strong className="mb-3 block text-sm">Datasheets</strong>
                <div className="grid gap-3">
                  {pkg.datasheetAssets.length ? (
                    pkg.datasheetAssets.map((asset) => (
                      <div key={asset.url} className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <strong className="truncate text-sm">{asset.name}</strong>
                          <a href={asset.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[var(--brand)]">
                            Open
                          </a>
                        </div>
                        {asset.kind === "image" ? (
                          <img src={asset.url} alt={asset.name} className="h-40 w-full rounded-[12px] object-cover" />
                        ) : asset.kind === "pdf" ? (
                          <iframe src={asset.url} title={asset.name} className="h-40 w-full rounded-[12px] border border-[var(--border)] bg-white" />
                        ) : (
                          <div className="flex min-h-24 items-center justify-center rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] text-sm text-[var(--text-soft)]">
                            Preview unavailable.
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-[var(--text-soft)]">No datasheets were resolved from the products attached to this package.</div>
                  )}
                </div>
              </div>
            </div>
          </DetailPanel>
        </div>
      </Panel>
    </div>
  );
}

export function BundleFormScreen({ packageId }: { packageId?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [categories, setCategories] = useState<ProductCategoryApiRecord[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [productsByCategory, setProductsByCategory] = useState<Record<string, ManagedProductRow[]>>({});
  const [loadingProductsByCategory, setLoadingProductsByCategory] = useState<Record<string, boolean>>({});
  const [loadingPackage, setLoadingPackage] = useState(Boolean(packageId));
  const [currentPackage, setCurrentPackage] = useState<ManagedPackageRow | null>(null);
  const [name, setName] = useState("");
  const [overview, setOverview] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [solarFinanceEnabled, setSolarFinanceEnabled] = useState(false);
  const [items, setItems] = useState<PackageItemDraft[]>([{ key: "package-item-1", category_id: "", product_id: "", quantity: "1" }]);
  const [inverterSize, setInverterSize] = useState("");
  const [pvSize, setPvSize] = useState("");
  const [batterySize, setBatterySize] = useState("");
  const [whatItPowers, setWhatItPowers] = useState<string[]>([]);
  const [customPowerInput, setCustomPowerInput] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [packageImageFile, setPackageImageFile] = useState<File | null>(null);
  const [currentThumbnailUrl, setCurrentThumbnailUrl] = useState<string | null>(null);
  const [currentPackageImageUrl, setCurrentPackageImageUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const categoryProductsRef = useRef<Record<string, ManagedProductRow[]>>({});
  const loadingCategoryRequestsRef = useRef<Set<string>>(new Set());
  const categoriesMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const selectedCategoryIds = useMemo(
    () => Array.from(new Set(items.map((item) => item.category_id).filter((value): value is string => Boolean(value)))),
    [items],
  );
  const products = useMemo(() => Object.values(productsByCategory).flat(), [productsByCategory]);
  const productLookup = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const selectedProducts = useMemo(
    () =>
      items
        .map((item) => productLookup.get(item.product_id))
        .filter((product): product is ManagedProductRow => Boolean(product)),
    [items, productLookup],
  );
  const thumbnailPreviewUrl = useObjectUrl(thumbnailFile);
  const packageImagePreviewUrl = useObjectUrl(packageImageFile);
  const isPublishedPackage = currentPackage?.is_active ?? false;
  const primaryPackageIntent = isPublishedPackage ? "finish" : "finish-publish";
  const primaryPackageLabel = isSubmitting ? "Saving..." : isPublishedPackage ? "Save Changes" : "Publish";
  const packageSecondaryActions = isPublishedPackage
    ? [{ label: "Move to Draft", intent: "draft" as const, variant: "secondary" as const, disabled: isSubmitting }]
    : [{ label: "Save Draft", intent: "draft" as const, variant: "secondary" as const, disabled: isSubmitting }];

  const fetchProductsForCategory = useCallback(async (categoryId: string) => {
    if (!categoryId || !categoriesMap.size) {
      return;
    }

    if (categoryProductsRef.current[categoryId] || loadingCategoryRequestsRef.current.has(categoryId)) {
      return;
    }

    loadingCategoryRequestsRef.current.add(categoryId);
    setLoadingProductsByCategory((current) => ({ ...current, [categoryId]: true }));

    try {
      const productRows = await loadAllPaginatedRecords(getProducts, {
        category_id: categoryId,
        fields: ["id", "name", "price", "category_id", "is_active", "stock_quantity"],
      });

      setProductsByCategory((current) => {
        const next = {
          ...current,
          [categoryId]: productRows.map((item) =>
            normalizeManagedProductRecord(item, categoriesMap),
          ),
        };
        categoryProductsRef.current = next;
        return next;
      });
      setCatalogError(null);
    } catch (loadError) {
      setCatalogError(getErrorMessage(loadError, "Products could not be loaded for the selected category."));
    } finally {
      loadingCategoryRequestsRef.current.delete(categoryId);
      setLoadingProductsByCategory((current) => ({ ...current, [categoryId]: false }));
    }
  }, [categoriesMap]);

  useEffect(() => {
    let cancelled = false;

    setCatalogError(null);

    loadAllPaginatedRecords(getProductCategories)
      .then((records) => {
        if (!cancelled) {
          setCategories(records.map(normalizeCategoryRecord));
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setCategories([]);
          setCatalogError(getErrorMessage(loadError, "Product categories could not be loaded."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCatalog(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loadingCatalog || !selectedCategoryIds.length) {
      return;
    }

    selectedCategoryIds.forEach((categoryId) => {
      void fetchProductsForCategory(categoryId);
    });
  }, [fetchProductsForCategory, loadingCatalog, selectedCategoryIds]);

  useEffect(() => {
    if (!packageId || loadingCatalog) {
      return;
    }

    let cancelled = false;
    setLoadingPackage(true);

    getPackage(packageId)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        return payload.data;
      })
      .catch(() => getPackageBySlug(packageId))
      .then((record) => {
        if (cancelled || !record) {
          return;
        }

        const normalized = normalizePackageRecord(record);
        setCurrentPackage(normalized);
        setName(normalized.name);
        setOverview(normalized.overviewText);
        setPrice(normalized.price ? String(normalized.price) : "");
        setDiscount(normalized.discountPercentage ? String(normalized.discountPercentage) : "");
        setSolarFinanceEnabled(normalized.solarFinanceEnabled);
        setItems(
          normalized.selectedProducts.length
            ? normalized.selectedProducts.map((item, index) => ({
                key: item.id || `package-item-${index + 1}`,
                category_id: item.category_id,
                product_id: item.product_id,
                quantity: String(item.quantity || 1),
              }))
            : [{ key: "package-item-1", category_id: "", product_id: "", quantity: "1" }],
        );
        setInverterSize(normalized.systemDetails.inverter_size || "");
        setPvSize(normalized.systemDetails.pv_size || "");
        setBatterySize(normalized.systemDetails.battery_size || "");
        setWhatItPowers(normalized.whatItPowers);
        setCurrentThumbnailUrl(normalized.thumbnailUrl);
        setCurrentPackageImageUrl(normalized.packageImageUrl);
      })
      .catch((loadError) => {
        if (!cancelled) {
          toast({
            title: "Package load failed",
            description: getErrorMessage(loadError, "The package could not be loaded for editing."),
            variant: "error",
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPackage(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadingCatalog, packageId, toast]);

  function navigateWith(flag: "draft" | "created") {
    startTransition(() => {
      router.push(`/packages?${flag}=1`);
    });
  }

  function addWhatItPowers(value: string) {
    const normalized = value.trim();
    if (!normalized || whatItPowers.includes(normalized)) {
      return;
    }

    setWhatItPowers((current) => [...current, normalized]);
    setCustomPowerInput("");
  }

  function removeWhatItPowers(value: string) {
    setWhatItPowers((current) => current.filter((item) => item !== value));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = getFormSubmitIntent(event, primaryPackageIntent);
    const isDraft = intent === "draft";
    const shouldPublish = intent === "finish-publish";
    const nextIsActive = isDraft ? false : shouldPublish ? true : currentPackage?.is_active ?? false;

    setIsSubmitting(true);

    try {
      const preparedItems = items
        .filter((item) => item.category_id && item.product_id)
        .map((item) => ({
          category_id: item.category_id,
          product_id: item.product_id,
          quantity: Number(item.quantity || 1),
        }));

      if (!name.trim()) {
        throw new Error("Enter the package name.");
      }

      if (!price.trim()) {
        throw new Error("Enter the package price.");
      }

      if (!preparedItems.length) {
        throw new Error("Add at least one product to the package.");
      }

      if (!thumbnailFile && !currentThumbnailUrl) {
        throw new Error("Upload the package thumbnail.");
      }

      if (!packageImageFile && !currentPackageImageUrl) {
        throw new Error("Upload the package image.");
      }

      const selectedBundleProducts = preparedItems
        .map((item) => products.find((product) => product.id === item.product_id))
        .filter((product): product is ManagedProductRow => Boolean(product));
      const panelProducts = selectedBundleProducts.filter((product) => /panel/i.test(product.categoryLabel));
      const inverterProduct = selectedBundleProducts.find((product) => /inverter/i.test(product.categoryLabel));
      const batteryProducts = selectedBundleProducts.filter((product) => /battery/i.test(product.categoryLabel));

      const payload = {
        name: name.trim(),
        overview: overview.trim(),
        description: overview.trim(),
        price: Number(price),
        discount_percentage: Number(discount || 0),
        solar_finance_enabled: solarFinanceEnabled,
        category_id: null,
        items: preparedItems,
        what_it_powers: whatItPowers,
        system_details: {
          inverter_size: inverterSize.trim(),
          inverter_label: formatSystemLabel(inverterSize, "kVA"),
          pv_size: pvSize.trim(),
          pv_label: formatSystemLabel(pvSize, "kWp"),
          battery_size: batterySize.trim(),
          battery_label: formatSystemLabel(batterySize, "kWh"),
        },
        system_size_kw: Number(pvSize || inverterSize || 0),
        number_of_panels: panelProducts.length,
        panel_type: panelProducts[0]?.name || "Selected panel mix",
        inverter_type: inverterProduct?.name || "Selected inverter",
        battery_included: batteryProducts.length > 0,
        warranty_years: 0,
        estimated_savings_monthly: 0,
        payback_period_years: 0,
        is_active: nextIsActive,
        ...(thumbnailFile ? { thumbnail: thumbnailFile } : {}),
        ...(packageImageFile ? { image: packageImageFile } : {}),
      };

      if (packageId) {
        await updatePackage(packageId, buildMultipartFormData(payload));
      } else {
        await createPackage(buildMultipartFormData(payload));
      }

      navigateWith(nextIsActive ? "created" : "draft");
    } catch (saveError) {
      if (isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: packageId ? "Update package failed" : "Create package failed",
        description: getErrorMessage(saveError, "The package could not be saved."),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dashboard-stack">
      <PackageMetricsStrip total={0} active={currentPackage?.is_active ? 1 : 0} financeEnabled={solarFinanceEnabled ? 1 : 0} />
      <Panel className="product-form-shell">
        <form id={packageCreateFormId} onSubmit={handleSubmit}>
          <div className="product-form-shell__header">
            <div>
              <h2 className="section-title">{packageId ? "Edit Package" : "Add A New Package"}</h2>
              <p className="section-description">Packages combine multiple products, optional solar finance, fixed thumbnail media, and a derived datasheet gallery from included products.</p>
            </div>
            <FormSubmitter
              formId={packageCreateFormId}
              cancelLabel="Cancel"
              onCancel={() => router.push(packageId ? `/packages/${packageId}` : "/packages")}
              primaryLabel={primaryPackageLabel}
              primaryIntent={primaryPackageIntent}
              disabled={isSubmitting}
              secondaryActions={packageSecondaryActions}
            />
          </div>

          <div className="product-form-grid">
            <DetailPanel title="Package Information" description="Set the package name, pricing, overview, and whether solar finance is available.">
              <div className="detail-panel__stack">
                <FormField label="Package Name">
                  <TextField value={name} onChange={(event) => setName(event.target.value)} placeholder="Starter Solar Package" />
                </FormField>
                <FormField label="Package Overview">
                  <TextAreaField value={overview} onChange={setOverview} placeholder="Package overview" rows={6} />
                </FormField>
                <div className="product-inline-row is-two">
                  <FormField label="Price">
                    <TextField value={price} onChange={(event) => setPrice(event.target.value)} placeholder="250000" />
                  </FormField>
                  <FormField label="Discount (%)">
                    <TextField value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="5" />
                  </FormField>
                </div>
                <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <label className="flex items-center justify-between gap-4">
                    <div>
                      <strong className="block text-sm">Solar Finance</strong>
                      <span className="text-sm text-[var(--text-soft)]">Enable this when customers can buy the package in installments or on credit.</span>
                    </div>
                    <Checkbox checked={solarFinanceEnabled} onChange={setSolarFinanceEnabled} />
                  </label>
                </div>
                <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-soft)]">
                  Final price preview: <strong className="text-[var(--text)]">{formatCurrencyLabel(Math.max(0, Number(price || 0) - (Number(price || 0) * Number(discount || 0)) / 100))}</strong>
                </div>
                {loadingPackage ? <p className="section-description">Loading package data...</p> : null}
              </div>
            </DetailPanel>

            <DetailPanel title="What This Package Includes" description="Pick a category, then pick the product within that category and the quantity.">
              <div className="detail-panel__stack">
                <ErrorMessage title="Catalog load failed" message={catalogError} />
                {items.map((item, index) => {
                  const categoryProducts = item.category_id ? productsByCategory[item.category_id] ?? [] : [];
                  const isLoadingCategoryProducts = item.category_id ? Boolean(loadingProductsByCategory[item.category_id]) : false;

                  return (
                    <div key={item.key} className="grid gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                      <div className="grid gap-3">
                        <FormField label="Category">
                          <SelectField
                            value={item.category_id}
                            onChange={(value) => {
                              setItems((current) =>
                                current.map((currentItem, currentIndex) =>
                                  currentIndex === index ? { ...currentItem, category_id: value, product_id: "" } : currentItem,
                                ),
                              );

                              if (value) {
                                void fetchProductsForCategory(value);
                              }
                            }}
                            options={[
                              { label: loadingCatalog ? "Loading categories..." : categories.length ? "Select category" : "No categories available", value: "" },
                              ...categories.map((category) => ({ label: category.name, value: category.id })),
                            ]}
                          />
                        </FormField>
                        <FormField label="Product">
                          <SelectField
                            value={item.product_id}
                            onChange={(value) =>
                              setItems((current) =>
                                current.map((currentItem, currentIndex) =>
                                  currentIndex === index ? { ...currentItem, product_id: value } : currentItem,
                                ),
                              )
                            }
                            options={[
                              {
                                label: item.category_id
                                  ? isLoadingCategoryProducts
                                    ? "Loading products..."
                                    : categoryProducts.length
                                      ? "Select product"
                                      : "No products in this category"
                                  : "Choose a category first",
                                value: "",
                              },
                              ...categoryProducts.map((product) => ({ label: product.name, value: product.id })),
                            ]}
                          />
                        </FormField>
                        <FormField label="Qty">
                          <TextField
                            value={item.quantity}
                            onChange={(event) =>
                              setItems((current) =>
                                current.map((currentItem, currentIndex) =>
                                  currentIndex === index ? { ...currentItem, quantity: event.target.value } : currentItem,
                                ),
                              )
                            }
                            placeholder="1"
                          />
                        </FormField>
                        <button
                          type="button"
                          className="icon-square-button is-danger self-end"
                          onClick={() =>
                            setItems((current) =>
                              current.length > 1 ? current.filter((_, currentIndex) => currentIndex !== index) : [{ key: "package-item-1", category_id: "", product_id: "", quantity: "1" }],
                            )
                          }
                          aria-label="Remove package item"
                        >
                          <TrashIcon className="mini-icon" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <Button variant="secondary" size="sm" onClick={() => setItems((current) => [...current, { key: `package-item-${Date.now()}`, category_id: "", product_id: "", quantity: "1" }])}>
                  Add Product
                </Button>

                <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="mb-3 text-sm font-semibold">System Details</p>
                  <div className="grid gap-3">
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_120px]">
                      <FormField label="Inverter Size">
                        <TextField value={inverterSize} onChange={(event) => setInverterSize(event.target.value)} placeholder="12" />
                      </FormField>
                      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--text-soft)] self-end">
                        {formatSystemLabel(inverterSize, "kVA")}
                      </div>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_120px]">
                      <FormField label="PV Size">
                        <TextField value={pvSize} onChange={(event) => setPvSize(event.target.value)} placeholder="12" />
                      </FormField>
                      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--text-soft)] self-end">
                        {formatSystemLabel(pvSize, "kWp")}
                      </div>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_120px]">
                      <FormField label="Battery Size">
                        <TextField value={batterySize} onChange={(event) => setBatterySize(event.target.value)} placeholder="15" />
                      </FormField>
                      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--text-soft)] self-end">
                        {formatSystemLabel(batterySize, "kWh")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="mb-3 text-sm font-semibold">What It Powers</p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {whatItPowers.map((item) => (
                      <button key={item} type="button" className="tag-list__item is-action" onClick={() => removeWhatItPowers(item)}>
                        {item} ×
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {appliancePresetOptions.map((option) => (
                      <Button key={option} variant="secondary" size="sm" onClick={() => addWhatItPowers(option)}>
                        {whatItPowers.includes(option) ? `Added: ${option}` : `+ ${option}`}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <TextField value={customPowerInput} onChange={(event) => setCustomPowerInput(event.target.value)} placeholder="Search or add items" />
                    <Button variant="primary" size="sm" onClick={() => addWhatItPowers(customPowerInput)}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </DetailPanel>

            <DetailPanel title="Product Media" description="The package thumbnail is used in listings, and the package image leads the detail page. Use tight 4:3 crops for both. Product images and datasheets are derived from the selected products.">
              <div className="detail-panel__stack">
                <FormField label="Package Thumbnail">
                  <div className="grid gap-3">
                    <label className="upload-field">
                      <input type="file" accept="image/*" onChange={(event) => setThumbnailFile(event.target.files?.[0] ?? null)} />
                      <span className="upload-field__button">
                        <span>{thumbnailFile || currentThumbnailUrl ? "Replace image" : "Choose image"}</span>
                      </span>
                      <span className="upload-field__value">{thumbnailFile?.name || currentThumbnailUrl?.split("/").pop() || "Upload package thumbnail (recommended 4:3)"}</span>
                    </label>
                    {thumbnailPreviewUrl || currentThumbnailUrl ? (
                      <img
                        src={thumbnailPreviewUrl || currentThumbnailUrl || ""}
                        alt="Package thumbnail preview"
                        className="aspect-[4/3] w-full max-w-[520px] rounded-[18px] border border-[var(--border)] object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[4/3] w-full max-w-[520px] items-center justify-center rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 text-center text-sm text-[var(--text-soft)]">
                        Upload package thumbnail. Recommended crop: 4:3.
                      </div>
                    )}
                  </div>
                </FormField>

                <FormField label="Package Image">
                  <div className="grid gap-3">
                    <label className="upload-field">
                      <input type="file" accept="image/*" onChange={(event) => setPackageImageFile(event.target.files?.[0] ?? null)} />
                      <span className="upload-field__button">
                        <span>{packageImageFile || currentPackageImageUrl ? "Replace image" : "Choose image"}</span>
                      </span>
                      <span className="upload-field__value">{packageImageFile?.name || currentPackageImageUrl?.split("/").pop() || "Upload package image (recommended 4:3)"}</span>
                    </label>
                    {packageImagePreviewUrl || currentPackageImageUrl ? (
                      <img src={packageImagePreviewUrl || currentPackageImageUrl || ""} alt="Package image preview" className="aspect-[4/3] w-full max-w-[520px] rounded-[18px] border border-[var(--border)] object-cover" />
                    ) : (
                      <div className="flex aspect-[4/3] w-full max-w-[520px] items-center justify-center rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 text-center text-sm text-[var(--text-soft)]">
                        Upload package image. Recommended crop: 4:3.
                      </div>
                    )}
                  </div>
                </FormField>

                <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="mb-3 text-sm font-semibold">Selected Product Images</p>
                  <div className="flex flex-wrap gap-3">
                    {selectedProducts.length ? (
                      selectedProducts.map((product) =>
                        product.product_image_url || product.image_url ? (
                          <img key={product.id} src={product.product_image_url || product.image_url || ""} alt={product.name} className="aspect-[4/3] w-24 rounded-[14px] border border-[var(--border)] object-cover" />
                        ) : null,
                      )
                    ) : (
                      <span className="text-sm text-[var(--text-soft)]">Product images from the selected products will appear here.</span>
                    )}
                  </div>
                </div>

                <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="mb-3 text-sm font-semibold">Selected Product Datasheets</p>
                  <div className="grid gap-3">
                    {selectedProducts.length ? (
                      selectedProducts.map((product) => {
                        const datasheetUrl = product.datasheet_url;
                        const kind = datasheetUrl ? inferAssetKind(datasheetUrl) : null;

                        if (!datasheetUrl) {
                          return null;
                        }

                        return (
                          <div key={`${product.id}-datasheet`} className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <strong className="truncate text-sm">{product.name}</strong>
                              <a href={datasheetUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[var(--brand)]">
                                Open
                              </a>
                            </div>
                            {kind === "image" ? (
                              <img src={datasheetUrl} alt={`${product.name} datasheet`} className="h-32 w-full rounded-[12px] object-cover" />
                            ) : kind === "pdf" ? (
                              <iframe src={datasheetUrl} title={`${product.name} datasheet`} className="h-32 w-full rounded-[12px] border border-[var(--border)] bg-white" />
                            ) : (
                              <div className="flex min-h-24 items-center justify-center rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] text-sm text-[var(--text-soft)]">
                                Preview unavailable.
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-sm text-[var(--text-soft)]">Datasheets from the selected products will appear here.</span>
                    )}
                  </div>
                </div>
              </div>
            </DetailPanel>
          </div>
        </form>
      </Panel>
    </div>
  );
}
