"use client";

import { type FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormSubmitter, getFormSubmitIntent } from "@/components/dashboard/form-submitter";
import { ActionLink, DirectoryToolbar, TagList } from "@/components/dashboard/management-primitives";
import { FormField, Modal } from "@/components/dashboard/modals";
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
import { CopyIcon, EyeIcon, FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { useToast } from "@/components/ui/toast";
import {
  createBlogPost,
  createSitePage,
  DEFAULT_PAGE_SIZE,
  deleteBlogPost,
  deleteSitePage,
  formatDateLabel,
  formatEnumLabel,
  getBlogPostBySlug,
  getBlogPosts,
  getSitePageBySlug,
  getSitePages,
  updateBlogPost,
  updateSitePage,
} from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { BlogPostRecord, PaginationMeta, SitePageRecord } from "@/types/api.types";

const statusTabs = ["All", "Published", "Draft"] as const;
const blogFormId = "blog-post-form";
const sitePageFormId = "site-page-form";
const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

type StatusFilter = (typeof statusTabs)[number];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function statusLabel(value: string) {
  return formatEnumLabel(value);
}

function matchesStatus(status: string, filter: StatusFilter) {
  return filter === "All" || statusLabel(status) === filter;
}

function parseSectionsInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {};
  }

  const parsed = JSON.parse(trimmed) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Sections must be a valid JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function stringifySections(value: Record<string, unknown> | null | undefined) {
  return JSON.stringify(value ?? {}, null, 2);
}

function ContentMetricsStrip({ metrics }: { metrics: Array<{ title: string; value: string; subtitle?: string; icon: "products" | "verification" | "bundles" | "calendar"; spark: number[] }> }) {
  return (
    <section className="stats-grid--four">
      {metrics.map((metric) => (
        <MetricCardSecondary key={metric.title} {...metric} />
      ))}
    </section>
  );
}

export function BlogManagementScreen() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const [rows, setRows] = useState<BlogPostRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [preview, setPreview] = useState<BlogPostRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const canCreateBlog = can("blog", "create");
  const canUpdateBlog = can("blog", "update");
  const canDeleteBlog = can("blog", "delete");

  useEffect(() => {
    let cancelled = false;

    getBlogPosts({ page, limit: DEFAULT_PAGE_SIZE })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setRows(payload.data);
        setPagination(payload.pagination);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setRows([]);
        setPagination(emptyPagination);
        setError(getErrorMessage(loadError, "Blog posts could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, refreshKey]);

  const filteredRows = useMemo(
    () =>
      rows.filter((post) => {
        const haystack = `${post.title} ${post.category} ${post.summary} ${post.status}`.toLowerCase();
        return haystack.includes(deferredQuery.toLowerCase()) && matchesStatus(post.status, status);
      }),
    [deferredQuery, rows, status],
  );

  const metrics = useMemo(
    () => [
      {
        title: "Total Posts",
        value: pagination.total.toLocaleString(),
        icon: "products" as const,
        spark: [14, 18, 24, 32, 38, 44],
      },
      {
        title: "Published Posts",
        value: rows.filter((post) => post.status.toLowerCase() === "published").length.toLocaleString(),
        icon: "verification" as const,
        spark: [10, 16, 22, 30, 38, 42],
      },
      {
        title: "Drafts",
        value: rows.filter((post) => post.status.toLowerCase() === "draft").length.toLocaleString(),
        icon: "calendar" as const,
        spark: [18, 16, 14, 20, 24, 22],
      },
      {
        title: "Total Views",
        value: rows.reduce((sum, post) => sum + post.views, 0).toLocaleString(),
        subtitle: "current page total",
        icon: "bundles" as const,
        spark: [12, 18, 26, 34, 42, 52],
      },
    ],
    [pagination.total, rows],
  );

  async function handleDelete(post: BlogPostRecord) {
    try {
      await deleteBlogPost(post.id);
      toast({
        title: "Post deleted",
        description: "The blog post was removed successfully.",
        variant: "success",
      });
      setRefreshKey((current) => current + 1);
    } catch (deleteError) {
      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The blog post could not be deleted."),
        variant: "error",
      });
    }
  }

  async function handlePublishPreview() {
    if (!preview) {
      return;
    }

    try {
      await updateBlogPost(preview.id, { status: "published" });
      toast({
        title: "Post published",
        description: "The blog post is now published.",
        variant: "success",
      });
      setPreview(null);
      setRefreshKey((current) => current + 1);
    } catch (publishError) {
      toast({
        title: "Publish failed",
        description: getErrorMessage(publishError, "The blog post could not be published."),
        variant: "error",
      });
    }
  }

  return (
    <>
      <div className="dashboard-stack">
        <ErrorMessage title="Blog load failed" message={error} />

        <ContentMetricsStrip metrics={metrics} />
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
              searchPlaceholder="Search blogs..."
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
                <span>{formatDateLabel(post.created_at)}</span>
                <span>{`${post.read_time_minutes} min read`}</span>
                <span>{post.views.toLocaleString()}</span>
                <span>{formatDateLabel(post.updated_at)}</span>
                <StatusPill label={statusLabel(post.status)} tone={toneFromStatus(post.status)} />
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
                              onSelect: () => void handleDelete(post),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </article>
            ))}
            {!filteredRows.length && !isLoading ? <div className="cell-subtle p-6">No blog posts matched the current filters.</div> : null}
          </div>
          <Pagination page={page} totalPages={Math.max(1, pagination.totalPages)} onChange={setPage} />
        </Panel>
      </div>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Blog Post Preview" size="lg">
        {preview ? (
          <div className="content-preview">
            <div className="content-preview__media">
              <span className="product-placeholder" aria-hidden="true" />
            </div>
            <TagList items={[preview.category, statusLabel(preview.status), `${preview.read_time_minutes} min read`]} />
            <h2>{preview.title}</h2>
            <p>{preview.summary}</p>
            <pre className="whitespace-pre-wrap text-sm text-[var(--text-soft)]">{preview.body}</pre>
            <div className="form-submitter is-between">
              <Button variant="secondary" onClick={() => setPreview(null)}>
                Close
              </Button>
              {canUpdateBlog && preview.status.toLowerCase() !== "published" ? (
                <Button variant="primary" onClick={() => void handlePublishPreview()}>
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

export function BlogFormScreen({ slug }: { slug?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [postId, setPostId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slugValue, setSlugValue] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("Solar Installation");
  const [imageUrl, setImageUrl] = useState("");
  const [body, setBody] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [readTimeMinutes, setReadTimeMinutes] = useState("5");
  const [isLoading, setIsLoading] = useState(Boolean(slug));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      return;
    }

    let cancelled = false;

    getBlogPostBySlug(slug)
      .then((post) => {
        if (cancelled) {
          return;
        }

        if (!post) {
          setError("The requested blog post could not be found.");
          return;
        }

        setPostId(post.id);
        setTitle(post.title);
        setSlugValue(post.slug);
        setSummary(post.summary);
        setCategory(post.category);
        setImageUrl(post.image_url);
        setBody(post.body);
        setSeoTitle(post.seo_title);
        setSeoDescription(post.meta_description);
        setReadTimeMinutes(String(post.read_time_minutes));
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "The blog post could not be loaded."));
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
  }, [slug]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);

      const intent = getFormSubmitIntent(event, "publish");
      const payload = {
        slug: slugify(slugValue || title),
        title,
        summary,
        body,
        category,
        status: intent === "draft" ? "draft" : "published",
        image_url: imageUrl,
        seo_title: seoTitle || title,
        meta_description: seoDescription || summary,
        read_time_minutes: Number(readTimeMinutes) || 0,
      };

      if (postId) {
        await updateBlogPost(postId, payload);
      } else {
        await createBlogPost(payload);
      }

      toast({
        title: postId ? "Post updated" : "Post created",
        description: postId ? "The blog post was saved successfully." : "The blog post was created successfully.",
        variant: "success",
      });
      router.push("/blog");
      router.refresh();
    } catch (submitError) {
      toast({
        title: postId ? "Update failed" : "Create failed",
        description: getErrorMessage(submitError, "The blog post could not be saved."),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dashboard-stack">
      <ErrorMessage title="Blog form error" message={error} />
      <ContentMetricsStrip
        metrics={[
          { title: "Editorial Status", value: postId ? "Editing" : "New Draft", icon: "products", spark: [12, 18, 22, 30, 34, 38] },
          { title: "Read Time", value: `${readTimeMinutes || 0} mins`, icon: "calendar", spark: [10, 14, 20, 24, 28, 32] },
          { title: "Slug", value: slugify(slugValue || title) || "pending", icon: "verification", spark: [16, 18, 24, 28, 30, 34] },
          { title: "SEO Ready", value: seoTitle || title ? "Yes" : "No", icon: "bundles", spark: [18, 22, 28, 32, 38, 44] },
        ]}
      />
      <Panel className="product-form-shell">
        <form id={blogFormId} onSubmit={handleSubmit}>
          <div className="product-form-shell__header">
            <div>
              <h2 className="section-title">{postId ? "Edit post" : "Create new post"}</h2>
              <p className="section-description">Prepare the article, cover media, SEO details, and publishing status.</p>
            </div>
            <FormSubmitter
              formId={blogFormId}
              cancelLabel="Cancel"
              onCancel={() => router.push("/blog")}
              primaryLabel={postId ? "Save Changes" : "Publish"}
              primaryIntent="publish"
              secondaryActions={[{ label: "Save to Draft", intent: "draft", variant: "secondary" }]}
              disabled={isSubmitting || isLoading}
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
                <FormField label="Slug">
                  <TextField value={slugValue} onChange={(event) => setSlugValue(event.target.value)} placeholder="how-solar-energy-can-save-you-money" />
                </FormField>
                <FormField label="Post Summary / Description" hint="A brief summary of your post (20-200 characters)">
                  <TextAreaField value={summary} onChange={setSummary} placeholder="Electricity costs keep rising..." rows={5} />
                </FormField>
                <FormField label="Cover Image URL">
                  <TextField value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." />
                </FormField>
                <FormField label="Post Category">
                  <TextField value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Solar Installation" />
                </FormField>
                <FormField label="Read Time Minutes">
                  <TextField value={readTimeMinutes} onChange={(event) => setReadTimeMinutes(event.target.value)} placeholder="5" />
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
                  <span>Markdown / Rich Text</span>
                  <button type="button" onClick={() => setBody("")}>
                    Clear
                  </button>
                </div>
                <TextAreaField value={body} onChange={setBody} rows={18} placeholder="Write the full blog body here..." />
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
  const { toast } = useToast();
  const [rows, setRows] = useState<SitePageRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const canCreateSitePages = can("site_pages", "create");
  const canUpdateSitePages = can("site_pages", "update");
  const canDeleteSitePages = can("site_pages", "delete");

  useEffect(() => {
    let cancelled = false;

    getSitePages({ page, limit: DEFAULT_PAGE_SIZE })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setRows(payload.data);
        setPagination(payload.pagination);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setRows([]);
        setPagination(emptyPagination);
        setError(getErrorMessage(loadError, "Site pages could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, refreshKey]);

  const filteredRows = useMemo(
    () =>
      rows.filter((record) => {
        const haystack = `${record.title} ${record.page_type} ${record.seo_title} ${record.status}`.toLowerCase();
        return haystack.includes(deferredQuery.toLowerCase()) && matchesStatus(record.status, status);
      }),
    [deferredQuery, rows, status],
  );

  const metrics = useMemo(
    () => [
      {
        title: "Total Pages",
        value: pagination.total.toLocaleString(),
        icon: "products" as const,
        spark: [14, 18, 24, 30, 36, 40],
      },
      {
        title: "Published Pages",
        value: rows.filter((pageRecord) => pageRecord.status.toLowerCase() === "published").length.toLocaleString(),
        icon: "verification" as const,
        spark: [10, 16, 22, 28, 34, 38],
      },
      {
        title: "Drafts",
        value: rows.filter((pageRecord) => pageRecord.status.toLowerCase() === "draft").length.toLocaleString(),
        icon: "calendar" as const,
        spark: [18, 16, 14, 18, 22, 24],
      },
      {
        title: "Avg SEO Score",
        value: rows.length ? `${Math.round(rows.reduce((sum, pageRecord) => sum + pageRecord.seo_score, 0) / rows.length)}%` : "0%",
        icon: "bundles" as const,
        spark: [16, 18, 24, 28, 34, 40],
      },
    ],
    [pagination.total, rows],
  );

  async function handleDelete(pageRecord: SitePageRecord) {
    try {
      await deleteSitePage(pageRecord.id);
      toast({
        title: "Page deleted",
        description: "The site page was removed successfully.",
        variant: "success",
      });
      setRefreshKey((current) => current + 1);
    } catch (deleteError) {
      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The site page could not be deleted."),
        variant: "error",
      });
    }
  }

  return (
    <div className="dashboard-stack">
      <ErrorMessage title="Site pages load failed" message={error} />

      <ContentMetricsStrip metrics={metrics} />
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
              <span>{record.page_type}</span>
              <span className="seo-score">{record.seo_score}%</span>
              <span>{Object.keys(record.sections ?? {}).length}</span>
              <span>{formatDateLabel(record.updated_at)}</span>
              <StatusPill label={statusLabel(record.status)} tone={toneFromStatus(record.status)} />
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
                            onSelect: () => void handleDelete(record),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            </article>
          ))}
          {!filteredRows.length && !isLoading ? <div className="cell-subtle p-6">No site pages matched the current filters.</div> : null}
        </div>
        <Pagination page={page} totalPages={Math.max(1, pagination.totalPages)} onChange={setPage} />
      </Panel>
    </div>
  );
}

export function SitePageFormScreen({ slug }: { slug?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pageId, setPageId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slugValue, setSlugValue] = useState("");
  const [pageType, setPageType] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [seoScore, setSeoScore] = useState("0");
  const [sections, setSections] = useState("{\n  \"hero\": {},\n  \"faq\": {}\n}");
  const [isLoading, setIsLoading] = useState(Boolean(slug));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      return;
    }

    let cancelled = false;

    getSitePageBySlug(slug)
      .then((pageRecord) => {
        if (cancelled) {
          return;
        }

        if (!pageRecord) {
          setError("The requested site page could not be found.");
          return;
        }

        setPageId(pageRecord.id);
        setTitle(pageRecord.title);
        setSlugValue(pageRecord.slug);
        setPageType(pageRecord.page_type);
        setSeoTitle(pageRecord.seo_title);
        setMetaDescription(pageRecord.meta_description);
        setKeywords(pageRecord.keywords);
        setSeoScore(String(pageRecord.seo_score));
        setSections(stringifySections(pageRecord.sections));
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "The site page could not be loaded."));
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
  }, [slug]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);

      const intent = getFormSubmitIntent(event, "publish");
      const payload = {
        slug: slugify(slugValue || title),
        title,
        page_type: pageType,
        seo_title: seoTitle || title,
        meta_description: metaDescription,
        keywords,
        sections: parseSectionsInput(sections),
        seo_score: Number(seoScore) || 0,
        status: intent === "draft" ? "draft" : "published",
      };

      if (pageId) {
        await updateSitePage(pageId, payload);
      } else {
        await createSitePage(payload);
      }

      toast({
        title: pageId ? "Page updated" : "Page created",
        description: pageId ? "The site page was saved successfully." : "The site page was created successfully.",
        variant: "success",
      });
      router.push("/site-pages");
      router.refresh();
    } catch (submitError) {
      toast({
        title: pageId ? "Update failed" : "Create failed",
        description: getErrorMessage(submitError, "The site page could not be saved."),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dashboard-stack">
      <ErrorMessage title="Site page form error" message={error} />
      <ContentMetricsStrip
        metrics={[
          { title: "Workflow", value: pageId ? "Editing" : "New Draft", icon: "products", spark: [12, 16, 22, 30, 34, 40] },
          { title: "SEO Score", value: `${seoScore || 0}%`, icon: "verification", spark: [10, 14, 18, 24, 28, 34] },
          { title: "Slug", value: slugify(slugValue || title) || "pending", icon: "calendar", spark: [18, 20, 22, 26, 30, 34] },
          { title: "Sections", value: `${Object.keys(parseSectionsInputSafe(sections)).length}`, icon: "bundles", spark: [16, 18, 24, 28, 34, 40] },
        ]}
      />
      <Panel className="product-form-shell">
        <form id={sitePageFormId} onSubmit={handleSubmit}>
          <div className="product-form-shell__header">
            <div>
              <h2 className="section-title">{pageId ? "Edit website page" : "Create website page"}</h2>
              <p className="section-description">Use this for homepage, about, landing, and SEO page creation.</p>
            </div>
            <FormSubmitter
              formId={sitePageFormId}
              cancelLabel="Cancel"
              onCancel={() => router.push("/site-pages")}
              primaryLabel={pageId ? "Save Changes" : "Publish"}
              primaryIntent="publish"
              secondaryActions={[{ label: "Save to Draft", intent: "draft", variant: "secondary" }]}
              disabled={isSubmitting || isLoading}
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
                  <TextField value={slugValue} onChange={(event) => setSlugValue(event.target.value)} placeholder="home" />
                </FormField>
                <FormField label="Page Type">
                  <TextField value={pageType} onChange={(event) => setPageType(event.target.value)} placeholder="Main Page" />
                </FormField>
                <FormField label="SEO Score">
                  <TextField value={seoScore} onChange={(event) => setSeoScore(event.target.value)} placeholder="0" />
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
                  <TextField value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="solar panels, solar installation, inverter, Nigeria" />
                </FormField>
              </div>
            </section>
            <section className="detail-panel">
              <div className="detail-panel__header">
                <h3>Page Sections</h3>
                <p>Store the sections payload as JSON.</p>
              </div>
              <TextAreaField value={sections} onChange={setSections} rows={12} />
            </section>
          </div>
        </form>
      </Panel>
    </div>
  );
}

function parseSectionsInputSafe(value: string) {
  try {
    return parseSectionsInput(value);
  } catch {
    return {};
  }
}
