"use client";

import { type FormEvent, useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccessControl } from "@/components/auth/use-access-control";
import {
  blogPosts,
  contentMetrics,
  sitePages,
  type BlogPostRecord,
  type ContentStatus,
  type SitePageRecord,
} from "@/lib/operations-data";
import {
  Button,
  MetricCardSecondary,
  Pagination,
  Panel,
  StatusPill,
  TableActionsMenu,
  Tabs,
  TextAreaField,
  TextField,
} from "@/components/dashboard/ui";
import { FormField, Modal, UploadField } from "@/components/dashboard/modals";
import { FormSubmitter, getFormSubmitIntent } from "@/components/dashboard/form-submitter";
import { ActionLink, DirectoryToolbar, TagList } from "@/components/dashboard/management-primitives";
import { CopyIcon, EyeIcon, FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";

const statusTabs = ["All", "Published", "Draft"] as const;
const blogFormId = "blog-post-form";
const sitePageFormId = "site-page-form";

type StatusFilter = (typeof statusTabs)[number];

function ContentMetricsStrip({ pageMode = false }: { pageMode?: boolean }) {
  const metrics = pageMode
    ? contentMetrics.map((metric) =>
        metric.title === "Total Posts"
          ? { ...metric, title: "Total Pages" }
          : metric.title === "Published Posts"
            ? { ...metric, title: "Published Pages" }
            : metric,
      )
    : contentMetrics;

  return (
    <section className="stats-grid--four">
      {metrics.map((metric) => (
        <MetricCardSecondary key={metric.title} {...metric} />
      ))}
    </section>
  );
}

function matchesStatus(status: ContentStatus, filter: StatusFilter) {
  return filter === "All" || status === filter;
}

export function BlogManagementScreen() {
  const { can } = useAccessControl();
  const [rows, setRows] = useState(blogPosts);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<BlogPostRecord | null>(null);
  const deferredQuery = useDeferredValue(query);
  const canCreateBlog = can("blog", "create");
  const canUpdateBlog = can("blog", "update");
  const canDeleteBlog = can("blog", "delete");

  const filteredRows = useMemo(
    () =>
      rows.filter((post) => {
        const haystack = `${post.title} ${post.category} ${post.summary} ${post.status}`.toLowerCase();
        return haystack.includes(deferredQuery.toLowerCase()) && matchesStatus(post.status, status);
      }),
    [deferredQuery, rows, status],
  );

  return (
    <>
      <div className="dashboard-stack">
        <ContentMetricsStrip />
        <Panel className="overflow-hidden">
          <div className="management-surface__body">
            <div className="section-header content-section-header">
              <div>
                <h2 className="section-title">Blog</h2>
                <p className="section-description">Create, edit, preview, and publish SEO-ready blog posts.</p>
              </div>
              {canCreateBlog ? (
                <ActionLink href="/blog/new" leadingIcon={<PlusIcon className="mini-icon" />}>
                  Add Blog
                </ActionLink>
              ) : null}
            </div>
            <DirectoryToolbar
              searchValue={query}
              onSearchChange={setQuery}
              searchPlaceholder="Search Blogs..."
              filters={
                <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                  Filter
                </Button>
              }
            />
            <div className="management-surface__filters is-inline">
              <Tabs value={status} onChange={setStatus} options={statusTabs} compact />
            </div>
          </div>
          <div className="content-list">
            <div className="content-list__head blog-grid">
              <span>Post</span>
              <span>Created On</span>
              <span>Read Time</span>
              <span>Views</span>
              <span>Last Updated</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {filteredRows.map((post) => (
              <article key={post.id} className="content-row blog-grid">
                <div className="content-title-cell">
                  <span className="content-thumb" aria-hidden="true">
                    <span className="product-placeholder" />
                  </span>
                  <strong>{post.title}</strong>
                </div>
                <span>{post.createdAt}</span>
                <span>{post.readTime}</span>
                <span>{post.views}</span>
                <span>{post.updatedAt}</span>
                <StatusPill label={post.status} tone={post.statusTone} />
              <div className="content-actions">
                <Button variant="secondary" size="sm" leadingIcon={<EyeIcon className="mini-icon" />} onClick={() => setPreview(post)}>
                  Preview
                </Button>
                {canUpdateBlog ? (
                  <ActionLink href={`/blog/${post.slug}/edit`} variant="secondary" size="sm">
                    Edit
                  </ActionLink>
                ) : null}
                <TableActionsMenu
                  items={[
                    { label: "Copy Public URL", icon: <CopyIcon className="menu-icon" /> },
                    ...(canDeleteBlog
                      ? [
                          {
                            label: "Delete Post",
                            tone: "danger" as const,
                            icon: <TrashIcon className="menu-icon" />,
                            onSelect: () => setRows((current) => current.filter((item) => item.id !== post.id)),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            </article>
          ))}
          </div>
          <Pagination page={page} totalPages={6} onChange={setPage} />
        </Panel>
      </div>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Blog Post Preview" size="lg">
        {preview ? (
          <div className="content-preview">
            <div className="content-preview__media">
              <span className="product-placeholder" aria-hidden="true" />
            </div>
            <TagList items={[preview.category, preview.status, preview.readTime]} />
            <h2>{preview.title}</h2>
            <p>{preview.summary}</p>
            <div className="form-submitter is-between">
              <Button variant="secondary" onClick={() => setPreview(null)}>
                Close
              </Button>
              {canUpdateBlog ? (
                <Button variant="primary" onClick={() => setPreview(null)}>
                  Publish Now
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export function BlogFormScreen({ post }: { post?: BlogPostRecord | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(post?.title ?? "");
  const [summary, setSummary] = useState(post?.summary ?? "");
  const [category, setCategory] = useState(post?.category ?? "Solar Installation");
  const [cover, setCover] = useState("");
  const [body, setBody] = useState(post?.body ?? "(H2) Introduction:\nPower offers a sustainable and cost-effective solution. Discover why there is no better time to invest in solar energy.");
  const [seoTitle, setSeoTitle] = useState(post?.title ?? "");
  const [seoDescription, setSeoDescription] = useState(post?.summary ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = getFormSubmitIntent(event, "finish");
    router.push(intent === "draft" ? "/blog?draft=1" : "/blog?published=1");
  }

  return (
    <div className="dashboard-stack">
      <ContentMetricsStrip />
      <Panel className="product-form-shell">
        <form id={blogFormId} onSubmit={handleSubmit}>
          <div className="product-form-shell__header">
            <div>
              <h2 className="section-title">{post ? "Edit post" : "Create new post"}</h2>
              <p className="section-description">Prepare the article, cover media, SEO details, and publishing status.</p>
            </div>
            <FormSubmitter
              formId={blogFormId}
              cancelLabel="Cancel"
              onCancel={() => router.push("/blog")}
              primaryLabel="Finish"
              primaryIntent="finish"
              secondaryActions={[{ label: "Save to Draft", intent: "draft", variant: "secondary" }]}
            />
          </div>
          <div className="content-form-grid">
            <section className="detail-panel">
              <div className="detail-panel__header">
                <h3>Blog post</h3>
                <p>Basic editorial and preview metadata.</p>
              </div>
              <div className="detail-panel__stack">
                <FormField label="Blog Title">
                  <TextField value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter post title" />
                </FormField>
                <FormField label="Post Summary / Description" hint="A brief summary of your post (20-200 characters)">
                  <TextAreaField value={summary} onChange={setSummary} placeholder="Electricity costs keep rising..." rows={5} />
                </FormField>
                <FormField label="Cover Image">
                  <div className="upload-showcase-empty">
                    <PlusIcon className="mini-icon" />
                    <p>Click or drag to upload your cover image (JPG, PNG) to display on the blog page.</p>
                  </div>
                  <UploadField value={cover} onChange={setCover} buttonLabel="Upload cover" accept=".jpg,.jpeg,.png" />
                </FormField>
                <FormField label="Post Category">
                  <TextField value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Solar Installation" />
                </FormField>
              </div>
            </section>
            <section className="detail-panel">
              <div className="detail-panel__header">
                <h3>Post Content / Body</h3>
                <p>Compose and format the article body.</p>
              </div>
              <div className="rich-editor-shell">
                <div className="rich-editor-toolbar">
                  <span>Normal</span>
                  <strong>B</strong>
                  <em>I</em>
                  <strong>&quot;</strong>
                  <span>U</span>
                  <span>1.2</span>
                  <span>•</span>
                  <span>Link</span>
                  <button type="button">Clear Formatting</button>
                </div>
                <TextAreaField value={body} onChange={setBody} rows={18} />
              </div>
            </section>
            <section className="detail-panel">
              <div className="detail-panel__header">
                <h3>SEO</h3>
                <p>Search metadata for the public blog page.</p>
              </div>
              <div className="detail-panel__stack">
                <FormField label="SEO Title">
                  <TextField value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} placeholder="Search title" />
                </FormField>
                <FormField label="Meta Description">
                  <TextAreaField value={seoDescription} onChange={setSeoDescription} placeholder="Meta description" rows={5} />
                </FormField>
              </div>
            </section>
          </div>
        </form>
      </Panel>
    </div>
  );
}

export function SitePagesManagementScreen() {
  const { can } = useAccessControl();
  const [rows, setRows] = useState(sitePages);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);
  const canCreateSitePages = can("site_pages", "create");
  const canUpdateSitePages = can("site_pages", "update");
  const canDeleteSitePages = can("site_pages", "delete");

  const filteredRows = useMemo(
    () =>
      rows.filter((record) => {
        const haystack = `${record.title} ${record.pageType} ${record.seoTitle} ${record.status}`.toLowerCase();
        return haystack.includes(deferredQuery.toLowerCase()) && matchesStatus(record.status, status);
      }),
    [deferredQuery, rows, status],
  );

  return (
    <div className="dashboard-stack">
      <ContentMetricsStrip pageMode />
      <Panel className="overflow-hidden">
        <div className="management-surface__body">
          <div className="section-header content-section-header">
            <div>
              <h2 className="section-title">SEO Pages</h2>
              <p className="section-description">Manage main website pages, landing pages, metadata, and draft/publish state.</p>
            </div>
            {canCreateSitePages ? (
              <ActionLink href="/site-pages/new" leadingIcon={<PlusIcon className="mini-icon" />}>
                Add Page
              </ActionLink>
            ) : null}
          </div>
          <DirectoryToolbar
            searchValue={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search pages..."
            filters={
              <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                Filter
              </Button>
            }
          />
          <div className="management-surface__filters is-inline">
            <Tabs value={status} onChange={setStatus} options={statusTabs} compact />
          </div>
        </div>
        <div className="content-list">
          <div className="content-list__head page-grid">
            <span>Page</span>
            <span>Type</span>
            <span>SEO Score</span>
            <span>Sections</span>
            <span>Last Updated</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {filteredRows.map((record) => (
            <article key={record.id} className="content-row page-grid">
              <div className="content-title-cell is-stacked">
                <strong>{record.title}</strong>
                <span>/{record.slug}</span>
              </div>
              <span>{record.pageType}</span>
              <span className="seo-score">{record.seoScore}%</span>
              <span>{record.sections}</span>
              <span>{record.updatedAt}</span>
              <StatusPill label={record.status} tone={record.statusTone} />
              <div className="content-actions">
                {canUpdateSitePages ? (
                  <ActionLink href={`/site-pages/${record.slug}/edit`} variant="secondary" size="sm">
                    Edit
                  </ActionLink>
                ) : null}
                <TableActionsMenu
                  items={[
                    { label: "Copy Public URL", icon: <CopyIcon className="menu-icon" /> },
                    ...(canDeleteSitePages
                      ? [
                          {
                            label: "Delete Page",
                            tone: "danger" as const,
                            icon: <TrashIcon className="menu-icon" />,
                            onSelect: () => setRows((current) => current.filter((item) => item.id !== record.id)),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            </article>
          ))}
        </div>
        <Pagination page={page} totalPages={4} onChange={setPage} />
      </Panel>
    </div>
  );
}

export function SitePageFormScreen({ page }: { page?: SitePageRecord | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [pageType, setPageType] = useState(page?.pageType ?? "Main Page");
  const [seoTitle, setSeoTitle] = useState(page?.seoTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(page?.metaDescription ?? "");
  const [keywords, setKeywords] = useState("solar panels, solar installation, inverter, Nigeria");
  const [body, setBody] = useState("Hero section\nValue proposition\nBenefits\nCTA block\nFAQ section");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = getFormSubmitIntent(event, "finish");
    router.push(intent === "draft" ? "/site-pages?draft=1" : "/site-pages?published=1");
  }

  return (
    <div className="dashboard-stack">
      <ContentMetricsStrip pageMode />
      <Panel className="product-form-shell">
        <form id={sitePageFormId} onSubmit={handleSubmit}>
          <div className="product-form-shell__header">
            <div>
              <h2 className="section-title">{page ? "Edit website page" : "Create website page"}</h2>
              <p className="section-description">Use this for homepage, about, landing, and SEO page creation.</p>
            </div>
            <FormSubmitter
              formId={sitePageFormId}
              cancelLabel="Cancel"
              onCancel={() => router.push("/site-pages")}
              primaryLabel="Finish"
              primaryIntent="finish"
              secondaryActions={[{ label: "Save to Draft", intent: "draft", variant: "secondary" }]}
            />
          </div>
          <div className="content-form-grid is-pages">
            <section className="detail-panel">
              <div className="detail-panel__header">
                <h3>Page Information</h3>
                <p>Core website page routing and classification.</p>
              </div>
              <div className="detail-panel__stack">
                <FormField label="Page Title">
                  <TextField value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Homepage" />
                </FormField>
                <FormField label="Slug">
                  <TextField value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="home" />
                </FormField>
                <FormField label="Page Type">
                  <TextField value={pageType} onChange={(event) => setPageType(event.target.value)} placeholder="Main Page" />
                </FormField>
              </div>
            </section>
            <section className="detail-panel">
              <div className="detail-panel__header">
                <h3>SEO Metadata</h3>
                <p>Search preview and metadata fields for public pages.</p>
              </div>
              <div className="detail-panel__stack">
                <FormField label="SEO Title">
                  <TextField value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} placeholder="Fortsolar - Clean Solar Power" />
                </FormField>
                <FormField label="Meta Description">
                  <TextAreaField value={metaDescription} onChange={setMetaDescription} placeholder="Describe this page for search engines" rows={5} />
                </FormField>
                <FormField label="Keywords">
                  <TextField value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="Keywords" />
                </FormField>
              </div>
            </section>
            <section className="detail-panel">
              <div className="detail-panel__header">
                <h3>Page Sections</h3>
                <p>Organize the page content into reusable sections.</p>
              </div>
              <TextAreaField value={body} onChange={setBody} rows={12} />
            </section>
          </div>
        </form>
      </Panel>
    </div>
  );
}
