"use client";

import { type FormEvent, useDeferredValue, useMemo, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccessControl } from "@/components/auth/use-access-control";
import { bundleMetrics, bundleRecords, type BundleRecord } from "@/lib/management-data";
import {
  Button,
  MetricCardSecondary,
  Panel,
  SelectField,
  StatusPill,
  TableActionsMenu,
  TextAreaField,
  TextField,
} from "@/components/dashboard/ui";
import { FormField, UploadField } from "@/components/dashboard/modals";
import { FormSubmitter, getFormSubmitIntent } from "@/components/dashboard/form-submitter";
import { ActionLink, AttachmentItem, CatalogCard, DetailPanel, DirectoryToolbar, InlineCallout, KeyValueList, ManagementBackLink, MediaShowcase, TagList } from "@/components/dashboard/management-primitives";
import { FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { toneFromStatus } from "@/lib/dashboard-data";

const bundleCreateFormId = "bundle-create-form";

function BundleMetricsStrip() {
  return (
    <section className="stats-grid--four">
      {bundleMetrics.map((metric) => (
        <MetricCardSecondary key={metric.title} {...metric} />
      ))}
    </section>
  );
}

export function BundlesManagementScreen() {
  const { can } = useAccessControl();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(bundleRecords);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);
  const canCreateBundles = can("bundles", "create");
  const canDeleteBundles = can("bundles", "delete");

  const filteredRows = useMemo(
    () =>
      rows.filter((bundle) =>
        `${bundle.name} ${bundle.type} ${bundle.summary} ${bundle.overview}`.toLowerCase().includes(deferredQuery.toLowerCase()),
      ),
    [deferredQuery, rows],
  );

  const notice = searchParams.get("created") ? "Bundle saved successfully." : searchParams.get("draft") ? "Bundle draft saved." : null;

  return (
    <div className="dashboard-stack">
      <BundleMetricsStrip />
      {notice ? <InlineCallout>{notice}</InlineCallout> : null}
      <Panel className="overflow-hidden">
        <div className="management-surface__body">
          <DirectoryToolbar
            searchValue={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search Bundles..."
            filters={
              <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                Filter
              </Button>
            }
            action={canCreateBundles ? <ActionLink href="/bundles/new" leadingIcon={<PlusIcon className="mini-icon" />}>Add New Bundle</ActionLink> : undefined}
          />
        </div>
        <div className="catalog-grid-wrap">
          <div className="catalog-grid">
            {filteredRows.map((bundle) => (
              <CatalogCard
                key={bundle.id}
                href={`/bundles/${bundle.slug}`}
                image={bundle.image}
                title={bundle.name}
                eyebrow={`${bundle.type} bundle`}
                price={bundle.price}
                summary={bundle.summary}
                status={<StatusPill label={bundle.status} tone={bundle.statusTone} solid={false} />}
                stats={[
                  { label: "Bundle Requests", value: String(bundle.requests), progress: Math.min(bundle.requests / 3, 100) },
                  { label: "Items Included", value: String(bundle.includes.length), progress: Math.min(bundle.includes.length * 20, 100) },
                ]}
                actions={
                  <TableActionsMenu
                    items={[
                      { label: "View Bundle", href: `/bundles/${bundle.slug}` },
                      ...(canDeleteBundles
                        ? [
                            {
                              label: "Delete Bundle",
                              tone: "danger" as const,
                              icon: <TrashIcon className="menu-icon" />,
                              onSelect: () => setRows((current) => current.filter((item) => item.id !== bundle.id)),
                            },
                          ]
                        : []),
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
      </Panel>
    </div>
  );
}

export function BundleDetailScreen({ bundle }: { bundle: BundleRecord }) {
  const { can } = useAccessControl();
  const [status, setStatus] = useState(bundle.status);
  const [statusTone, setStatusTone] = useState(bundle.statusTone);
  const [financeEnabled, setFinanceEnabled] = useState(bundle.financeEnabled);
  const canUpdateBundles = can("bundles", "update");
  const canDeleteBundles = can("bundles", "delete");

  return (
    <div className="dashboard-stack">
      <BundleMetricsStrip />
      <Panel className="product-detail-shell">
        <div className="product-detail-shell__header">
          <ManagementBackLink href="/bundles" label={bundle.name} meta={bundle.submittedAt} />
          <TableActionsMenu
            items={[
              ...(canUpdateBundles
                ? [
                    {
                      label: "Publish Bundle",
                      onSelect: () => {
                        setStatus("Published");
                        setStatusTone(toneFromStatus("Published"));
                      },
                    },
                    {
                      label: "Move To Draft",
                      onSelect: () => {
                        setStatus("Draft");
                        setStatusTone(toneFromStatus("Draft"));
                      },
                    },
                  ]
                : []),
              ...(canDeleteBundles ? [{ label: "Delete Bundle", tone: "danger" as const, icon: <TrashIcon className="menu-icon" /> }] : []),
            ]}
          />
        </div>

        <div className="bundle-detail-grid">
          <DetailPanel title="Bundle Information">
            <KeyValueList
              items={[
                { label: "Bundle Id", value: bundle.id },
                { label: "Bundle Type", value: bundle.type },
                { label: "Price", value: bundle.price },
                { label: "Status", value: <StatusPill label={status} tone={statusTone} /> },
                { label: "Bundle Requests", value: bundle.requests },
              ]}
            />
            <div className="detail-panel__stack">
              <div className="toggle-row">
                <div>
                  <strong>Solar Finance</strong>
                  <p>{financeEnabled ? "Enabled for checkout." : "Disabled for checkout."}</p>
                </div>
                <button
                  type="button"
                  className={`settings-switch ${financeEnabled ? "is-active" : ""}`}
                  onClick={() => setFinanceEnabled((value) => !value)}
                  disabled={!canUpdateBundles}
                >
                  <span className="settings-switch__thumb" />
                </button>
              </div>
              <div>
                <p className="section-description">Packages / Bundle Includes</p>
                <KeyValueList items={bundle.includes.map((item) => ({ label: item.label, value: item.qty }))} />
              </div>
              <div>
                <p className="section-description">What it Powers</p>
                <TagList items={bundle.powers} />
              </div>
            </div>
          </DetailPanel>

          <DetailPanel title="Bundle Overview" description={bundle.overview}>
            <div className="detail-panel__stack">
              <div>
                <p className="section-description">System Details</p>
                <KeyValueList items={bundle.systemDetails.map((item) => ({ label: item.label, value: item.value }))} />
              </div>
              <div>
                <p className="section-description">Bundle Thumbnail</p>
                <div className="media-card">
                  <span className="product-placeholder" aria-hidden="true" />
                </div>
              </div>
            </div>
          </DetailPanel>

          <DetailPanel title="Datasheets">
            <div className="detail-panel__stack">
              <MediaShowcase title={bundle.name} image={bundle.image} gallery={bundle.gallery} />
              <AttachmentItem label={bundle.datasheet} helper="02/04" />
            </div>
          </DetailPanel>
        </div>
      </Panel>
    </div>
  );
}

type BundleItemRow = { label: string; qty: string };
type BundleMetaRow = { label: string; value: string };

export function BundleFormScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [overview, setOverview] = useState("");
  const [type, setType] = useState("Lite");
  const [price, setPrice] = useState("1,234,902");
  const [discount, setDiscount] = useState("5");
  const [financeEnabled, setFinanceEnabled] = useState(true);
  const [mediaFile, setMediaFile] = useState("");
  const [datasheet, setDatasheet] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [bundleItems, setBundleItems] = useState<BundleItemRow[]>([
    { label: "450W Mono Solar Panel", qty: "x2" },
    { label: "200Ah Lithium Battery", qty: "x1" },
    { label: "Product", qty: "x2" },
  ]);
  const [systemDetails, setSystemDetails] = useState<BundleMetaRow[]>([
    { label: "Inverter Size", value: "12kVA" },
    { label: "PV Size", value: "12kWp" },
    { label: "Battery Size", value: "15kWh" },
  ]);
  const [powerItems, setPowerItems] = useState(["Washing Machine", "Laptops", "Phones", "Fridge", "Microwave", "LED Bulbs", "Outlets"]);

  function navigateWith(flag: "draft" | "created") {
    startTransition(() => {
      router.push(`/bundles?${flag}=1`);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = getFormSubmitIntent(event, "finish");
    navigateWith(intent === "draft" ? "draft" : "created");
  }

  return (
    <div className="dashboard-stack">
      <BundleMetricsStrip />
      <Panel className="product-form-shell">
        <form id={bundleCreateFormId} onSubmit={handleSubmit}>
          <div className="product-form-shell__header">
            <div>
              <h2 className="section-title">Add A New Bundle</h2>
              <p className="section-description">Create a bundle with included products, pricing, financing, and media.</p>
            </div>
            <FormSubmitter
              formId={bundleCreateFormId}
              cancelLabel="Cancel"
              onCancel={() => router.push("/bundles")}
              primaryLabel="Finish"
              primaryIntent="finish"
              secondaryActions={[
                { label: "Save to Draft", intent: "draft", variant: "secondary" },
                { label: "Finish & Publish", intent: "finish-publish", variant: "primary" },
              ]}
            />
          </div>

          <div className="product-form-grid">
          <DetailPanel title="Bundle Information" description="Set the bundle name, overview, type, price, and finance availability.">
            <div className="detail-panel__stack">
              <FormField label="Bundle">
                <TextField value={name} onChange={(event) => setName(event.target.value)} placeholder="Bundle Name" />
              </FormField>
              <FormField label="Bundle Overview">
                <TextAreaField value={overview} onChange={setOverview} placeholder="Bundle Overview" rows={6} />
              </FormField>
              <FormField label="Bundle Type">
                <SelectField value={type} onChange={setType} options={["Lite", "Standard", "Premium"]} />
              </FormField>
              <div className="product-inline-row is-two">
                <FormField label="Price">
                  <TextField value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Price (₦)" />
                </FormField>
                <FormField label="Discount">
                  <TextField value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="5%" />
                </FormField>
              </div>
              <div className="toggle-row">
                <div>
                  <strong>Solar Finance</strong>
                  <p>Enable or disable bundle financing at checkout.</p>
                </div>
                <button type="button" className={`settings-switch ${financeEnabled ? "is-active" : ""}`} onClick={() => setFinanceEnabled((value) => !value)}>
                  <span className="settings-switch__thumb" />
                </button>
              </div>
            </div>
          </DetailPanel>

          <DetailPanel title="What This Bundle Includes" description="Select the products and quantities included in this bundle.">
            <div className="detail-panel__stack">
              {bundleItems.map((row, index) => (
                <div key={`${row.label}-${index}`} className="form-repeat-row">
                  <SelectField
                    value={row.label}
                    onChange={(value) => setBundleItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, label: value } : item)))}
                    options={["450W Mono Solar Panel", "200Ah Lithium Battery", "5kVA Inverter", "Install Pack", "Product"]}
                  />
                  <TextField
                    value={row.qty}
                    onChange={(event) => setBundleItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, qty: event.target.value } : item)))}
                    placeholder="Qty"
                  />
                  <button
                    type="button"
                    className="icon-square-button is-danger"
                    onClick={() => setBundleItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label="Remove bundle item"
                  >
                    <TrashIcon className="mini-icon" />
                  </button>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => setBundleItems((current) => [...current, { label: "Product", qty: "x1" }])}>
                Add product
              </Button>

              <div>
                <p className="section-description">System Details</p>
                <div className="detail-panel__stack">
                  {systemDetails.map((row, index) => (
                    <div key={`${row.label}-${index}`} className="form-repeat-row">
                      <TextField
                        value={row.label}
                        onChange={(event) => setSystemDetails((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))}
                        placeholder="Label"
                      />
                      <TextField
                        value={row.value}
                        onChange={(event) => setSystemDetails((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))}
                        placeholder="Value"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <FormField label="What it Powers">
                <div className="detail-panel__stack">
                  <TextField value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="Search or add items" />
                  <div className="tag-list">
                    {powerItems.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="tag-list__item"
                        onClick={() => setPowerItems((current) => current.filter((entry) => entry !== item))}
                      >
                        {item}
                      </button>
                    ))}
                    {tagInput ? (
                      <button
                        type="button"
                        className="tag-list__item is-action"
                        onClick={() => {
                          setPowerItems((current) => [...current, tagInput]);
                          setTagInput("");
                        }}
                      >
                        Add {tagInput}
                      </button>
                    ) : null}
                  </div>
                </div>
              </FormField>
            </div>
          </DetailPanel>

          <DetailPanel title="Product Media" description="Keep the right rail focused on uploads and support files.">
            <div className="detail-panel__stack">
              <div className="upload-showcase-empty">
                <PlusIcon className="mini-icon" />
                <p>Upload bundle image (JPG, PNG) to display on the bundle page.</p>
              </div>
              <div className="thumbnail-strip">
                {[0, 1].map((item) => (
                  <span key={item} className="thumbnail-strip__item" aria-hidden="true">
                    <span className="product-placeholder" />
                  </span>
                ))}
              </div>
              <FormField label="Bundle thumbnail img">
                <UploadField value={mediaFile} onChange={setMediaFile} buttonLabel="Upload image" accept=".jpg,.jpeg,.png" />
              </FormField>
              <FormField label="Add Data sheets">
                <UploadField value={datasheet} onChange={setDatasheet} buttonLabel="Upload file" accept=".pdf,.doc,.docx" />
              </FormField>
              <AttachmentItem label={datasheet || "Datasheet-1"} helper="Preview" />
            </div>
          </DetailPanel>
          </div>
        </form>
      </Panel>
    </div>
  );
}
