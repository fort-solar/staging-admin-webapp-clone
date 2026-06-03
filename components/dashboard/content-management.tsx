"use client";

import { type FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormSubmitter, getFormSubmitIntent } from "@/components/dashboard/form-submitter";
import { ActionLink, DirectoryToolbar, TagList } from "@/components/dashboard/management-primitives";
import { FormField, ImageSelectField, Modal } from "@/components/dashboard/modals";
import { normalizeRichTextHtml, RichTextContent, RichTextEditor } from "@/components/dashboard/rich-text";
import {
  Button,
  MetricCardSecondary,
  Pagination,
  Panel,
  SelectField,
  StatusPill,
  TableActionsMenu,
  Tabs,
  TextAreaField,
  TextField,
} from "@/components/dashboard/ui";
import { CopyIcon, EyeIcon, FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { useToast } from "@/components/ui/toast";
import {
  buildMultipartFormData,
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
import { isDashboardActionCancelledError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { BlogPostRecord, PaginationMeta, SitePageRecord, SitePageSection } from "@/types/api.types";

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
type SitePageCardFormState = {
  id: string;
  title: string;
  subtitle: string;
  content: string;
};

type SitePageSectionFormState = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  content: string;
  isCard: boolean;
  cards: SitePageCardFormState[];
};

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

function createLocalId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyCard(): SitePageCardFormState {
  return {
    id: createLocalId("card"),
    title: "",
    subtitle: "",
    content: "",
  };
}

function createEmptySection(): SitePageSectionFormState {
  return {
    id: createLocalId("section"),
    type: "",
    title: "",
    subtitle: "",
    content: "",
    isCard: false,
    cards: [],
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function normalizeCards(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((card) => {
    if (!card || typeof card !== "object" || Array.isArray(card)) {
      return [];
    }

    return [
      {
        id: createLocalId("card"),
        title: stringValue(card.title),
        subtitle: stringValue(card.subtitle),
        content: stringValue(card.content),
      },
    ];
  });
}

function normalizeSection(section: unknown, fallbackType = ""): SitePageSectionFormState | null {
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    return null;
  }

  const candidate = section as Record<string, unknown>;
  const cards = normalizeCards(candidate.cards);
  const isCard = booleanValue(candidate.isCard) || cards.length > 0;

  return {
    id: createLocalId("section"),
    type: stringValue(candidate.type) || fallbackType,
    title: stringValue(candidate.title),
    subtitle: stringValue(candidate.subtitle),
    content: stringValue(candidate.content),
    isCard,
    cards,
  };
}

function normalizeSitePageSections(value: SitePageRecord["sections"] | null | undefined) {
  if (Array.isArray(value)) {
    const sections = value.flatMap((section) => {
      const normalized = normalizeSection(section);
      return normalized ? [normalized] : [];
    });

    return sections.length ? sections : [createEmptySection()];
  }

  if (value && typeof value === "object") {
    const sections = Object.entries(value).flatMap(([key, section]) => {
      const normalized = normalizeSection(section, key);
      return normalized ? [normalized] : [];
    });

    return sections.length ? sections : [createEmptySection()];
  }

  return [createEmptySection()];
}

function buildSitePageSectionsPayload(sections: SitePageSectionFormState[]): SitePageSection[] {
  return sections.flatMap((section, index) => {
    const type = section.type.trim();
    const title = section.title.trim();
    const subtitle = section.subtitle.trim();
    const content = section.content.trim();
    const cards = section.isCard
      ? section.cards.flatMap((card) => {
          const cardTitle = card.title.trim();
          const cardSubtitle = card.subtitle.trim();
          const cardContent = card.content.trim();

          if (!cardTitle && !cardSubtitle && !cardContent) {
            return [];
          }

          return [
            {
              ...(cardTitle ? { title: cardTitle } : {}),
              ...(cardSubtitle ? { subtitle: cardSubtitle } : {}),
              ...(cardContent ? { content: cardContent } : {}),
            },
          ];
        })
      : [];

    if (!type && !title && !subtitle && !content && !cards.length) {
      return [];
    }

    return [
      {
        type: type || `section-${index + 1}`,
        ...(title ? { title } : {}),
        ...(subtitle ? { subtitle } : {}),
        ...(content ? { content } : {}),
        ...(cards.length ? { cards } : {}),
      },
    ];
  });
}

function countSitePageSections(value: SitePageRecord["sections"] | null | undefined) {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (value && typeof value === "object") {
    return Object.keys(value).length;
  }

  return 0;
}

function calculateSeoScore({
  title,
  description,
  keywords,
  sectionCount,
}: {
  title: string;
  description: string;
  keywords: string;
  sectionCount: number;
}) {
  let score = 0;

  if (title.trim().length >= 20) {
    score += 30;
  }

  if (description.trim().length >= 50) {
    score += 30;
  }

  if (keywords.trim()) {
    score += 20;
  }

  if (sectionCount > 0) {
    score += 20;
  }

  return Math.min(score, 100);
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

    getBlogPosts({
      page,
      limit: DEFAULT_PAGE_SIZE,
      search: deferredQuery.trim() || undefined,
      q: deferredQuery.trim() || undefined,
    })
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
  }, [deferredQuery, page, refreshKey]);

  const filteredRows = useMemo(
    () =>
      rows.filter((post) => {
        return matchesStatus(post.status, status);
      }),
    [rows, status],
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
      if (isDashboardActionCancelledError(deleteError)) {
        return;
      }

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
      if (isDashboardActionCancelledError(publishError)) {
        return;
      }

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
              onSearchChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
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
            <RichTextContent value={preview.body} />
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
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("Solar Installation");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
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
        setSummary(post.summary);
        setCategory(post.category);
        setImageUrl(post.image_url);
        setImageFile(null);
        setBody(normalizeRichTextHtml(post.body));
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

      if (!postId && !imageFile) {
        throw new Error("Select a cover image to upload.");
      }

      const intent = getFormSubmitIntent(event, "publish");
      const payload = {
        slug: slugify(title),
        title,
        summary,
        body: normalizeRichTextHtml(body),
        category,
        status: intent === "draft" ? "draft" : "published",
        seo_title: seoTitle || title,
        meta_description: seoDescription || summary,
        read_time_minutes: Number(readTimeMinutes) || 0,
      };

      const bodyPayload = imageFile
        ? buildMultipartFormData({
            ...payload,
            image_url: imageFile,
          })
        : {
            ...payload,
            image_url: imageUrl,
          };

      if (postId) {
        await updateBlogPost(postId, bodyPayload);
      } else {
        await createBlogPost(bodyPayload);
      }

      toast({
        title: postId ? "Post updated" : "Post created",
        description: postId ? "The blog post was saved successfully." : "The blog post was created successfully.",
        variant: "success",
      });
      router.push("/blog");
      router.refresh();
    } catch (submitError) {
      if (isDashboardActionCancelledError(submitError)) {
        return;
      }

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
          { title: "Slug", value: slugify(title) || "pending", icon: "verification", spark: [16, 18, 24, 28, 30, 34] },
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
                <FormField label="Post Summary / Description" hint="A brief summary of your post (20-200 characters)">
                  <TextAreaField value={summary} onChange={setSummary} placeholder="Electricity costs keep rising..." rows={5} />
                </FormField>
                <FormField label="Cover Image">
                  <ImageSelectField file={imageFile} onFileChange={setImageFile} previewUrl={imageUrl || undefined} />
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
                <p>Compose and format the article body with rich text tools.</p>
              </div>
              <div className="detail-panel__stack">
                <div className="section-builder__header">
                  <p>Use headings, emphasis, lists, quotes, and links. The saved body is stored as sanitized HTML.</p>
                  <Button variant="secondary" size="sm" onClick={() => setBody("")}>
                    Clear
                  </Button>
                </div>
                <RichTextEditor value={body} onChange={setBody} placeholder="Write the full blog body here..." />
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

    getSitePages({
      page,
      limit: DEFAULT_PAGE_SIZE,
      search: deferredQuery.trim() || undefined,
      q: deferredQuery.trim() || undefined,
    })
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
  }, [deferredQuery, page, refreshKey]);

  const filteredRows = useMemo(
    () =>
      rows.filter((record) => {
        return matchesStatus(record.status, status);
      }),
    [rows, status],
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
      if (isDashboardActionCancelledError(deleteError)) {
        return;
      }

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
            onSearchChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
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
              <span>{formatEnumLabel(record.page_type)}</span>
              <span className="seo-score">{record.seo_score}%</span>
              <span>{countSitePageSections(record.sections)}</span>
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
  const [pageType, setPageType] = useState("content");
  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [sections, setSections] = useState<SitePageSectionFormState[]>([createEmptySection()]);
  const [isLoading, setIsLoading] = useState(Boolean(slug));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preparedSections = useMemo(() => buildSitePageSectionsPayload(sections), [sections]);
  const computedSeoScore = useMemo(
    () =>
      calculateSeoScore({
        title: seoTitle || title,
        description: metaDescription,
        keywords,
        sectionCount: preparedSections.length,
      }),
    [keywords, metaDescription, preparedSections.length, seoTitle, title],
  );

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
        setPageType(pageRecord.page_type);
        setSeoTitle(pageRecord.seo_title);
        setMetaDescription(pageRecord.meta_description);
        setKeywords(pageRecord.keywords);
        setSections(normalizeSitePageSections(pageRecord.sections));
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

  function addSection() {
    setSections((current) => [...current, createEmptySection()]);
  }

  function updateSection(sectionId: string, patch: Partial<Omit<SitePageSectionFormState, "id" | "cards">>) {
    setSections((current) => current.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)));
  }

  function removeSection(sectionId: string) {
    setSections((current) => current.filter((section) => section.id !== sectionId));
  }

  function toggleSectionCards(sectionId: string, enabled: boolean) {
    setSections((current) =>
      current.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }

        return {
          ...section,
          isCard: enabled,
          cards: enabled ? (section.cards.length ? section.cards : [createEmptyCard()]) : [],
        };
      }),
    );
  }

  function addCard(sectionId: string) {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              isCard: true,
              cards: [...section.cards, createEmptyCard()],
            }
          : section,
      ),
    );
  }

  function updateCard(sectionId: string, cardId: string, patch: Partial<Omit<SitePageCardFormState, "id">>) {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              cards: section.cards.map((card) => (card.id === cardId ? { ...card, ...patch } : card)),
            }
          : section,
      ),
    );
  }

  function removeCard(sectionId: string, cardId: string) {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              cards: section.cards.filter((card) => card.id !== cardId),
            }
          : section,
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);

      const intent = getFormSubmitIntent(event, "publish");
      const invalidCardSectionIndex = sections.findIndex(
        (section) =>
          section.isCard &&
          !section.cards.some((card) => card.title.trim() || card.subtitle.trim() || card.content.trim()),
      );

      if (invalidCardSectionIndex >= 0) {
        throw new Error(`Add at least one completed card to section ${invalidCardSectionIndex + 1}.`);
      }

      const structuredSections = preparedSections;

      if (!structuredSections.length) {
        throw new Error("Add at least one section before saving this page.");
      }

      const payload = {
        slug: slugify(title),
        title,
        page_type: pageType.trim() || "content",
        seo_title: seoTitle || title,
        meta_description: metaDescription,
        keywords,
        sections: structuredSections,
        seo_score: computedSeoScore,
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
      if (isDashboardActionCancelledError(submitError)) {
        return;
      }

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
          { title: "SEO Score", value: `${computedSeoScore}%`, icon: "verification", spark: [10, 14, 18, 24, 28, 34] },
          { title: "Slug", value: slugify(title) || "pending", icon: "calendar", spark: [18, 20, 22, 26, 30, 34] },
          { title: "Sections", value: `${preparedSections.length}`, icon: "bundles", spark: [16, 18, 24, 28, 34, 40] },
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
                <FormField label="Page Type" hint="Use values like content, landing, legal, or support.">
                  <TextField value={pageType} onChange={(event) => setPageType(event.target.value)} placeholder="content" />
                </FormField>
                <div className="summary-card">
                  <div className="summary-card__top">
                    <span>Route preview</span>
                    <strong>/{slugify(title) || "pending"}</strong>
                  </div>
                  <div className="summary-card__items">
                    <div className="summary-item">
                      <span>Page status</span>
                      <strong>{pageId ? "Editing" : "New Draft"}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Sections</span>
                      <strong>{preparedSections.length}</strong>
                    </div>
                    <div className="summary-item">
                      <span>SEO score</span>
                      <strong>{computedSeoScore}%</strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <section className="detail-panel">
              <div className="detail-panel__header">
                <h3>Page Sections</h3>
                <p>Build the exact ordered sections array the API expects without asking writers to touch JSON.</p>
              </div>
              <div className="detail-panel__stack">
                <div className="section-builder__header">
                  <p>Common types include `hero`, `content`, `features`, `faq`, `cta`, and `contact_form`.</p>
                  <Button variant="primary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={addSection}>
                    Add Section
                  </Button>
                </div>

                {sections.length ? (
                  <div className="section-builder">
                    {sections.map((section, index) => (
                      <article key={section.id} className="section-builder__item">
                        <div className="section-builder__item-head">
                          <div>
                            <strong>Section {index + 1}</strong>
                            <span>{section.type.trim() || "No type selected yet"}</span>
                          </div>
                          <Button variant="danger" size="sm" onClick={() => removeSection(section.id)}>
                            Remove
                          </Button>
                        </div>

                        <div className="detail-panel__stack">
                          <FormField label="Section Type" hint="Example: hero or contact_form">
                            <TextField value={section.type} onChange={(event) => updateSection(section.id, { type: event.target.value })} placeholder="hero" />
                          </FormField>
                          <FormField label="Section Title">
                            <TextField value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} placeholder="Get in Touch" />
                          </FormField>
                          <FormField label="Section Subtitle">
                            <TextField value={section.subtitle} onChange={(event) => updateSection(section.id, { subtitle: event.target.value })} placeholder="We are here to help." />
                          </FormField>
                          <FormField label="Section Content">
                            <TextAreaField value={section.content} onChange={(value) => updateSection(section.id, { content: value })} placeholder="Optional body copy for this section." rows={4} />
                          </FormField>
                          <FormField label="Card Layout">
                            <SelectField
                              value={section.isCard ? "yes" : "no"}
                              onChange={(value) => toggleSectionCards(section.id, value === "yes")}
                              options={[
                                { label: "No", value: "no" },
                                { label: "Yes", value: "yes" },
                              ]}
                            />
                          </FormField>

                          {section.isCard ? (
                            <div className="card-builder">
                              <div className="card-builder__header">
                                <strong>Cards ({section.cards.length})</strong>
                                <Button variant="secondary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={() => addCard(section.id)}>
                                  Add Card
                                </Button>
                              </div>
                              {section.cards.length ? (
                                <div className="card-builder__list">
                                  {section.cards.map((card, cardIndex) => (
                                    <div key={card.id} className="card-builder__item">
                                      <div className="card-builder__item-head">
                                        <div>
                                          <strong>Card {cardIndex + 1}</strong>
                                          <span>Use this for repeating highlight or info blocks.</span>
                                        </div>
                                        <Button variant="danger" size="sm" onClick={() => removeCard(section.id, card.id)}>
                                          Remove
                                        </Button>
                                      </div>
                                      <FormField label="Card Title">
                                        <TextField value={card.title} onChange={(event) => updateCard(section.id, card.id, { title: event.target.value })} placeholder="Support line" />
                                      </FormField>
                                      <FormField label="Card Subtitle">
                                        <TextField value={card.subtitle} onChange={(event) => updateCard(section.id, card.id, { subtitle: event.target.value })} placeholder="Fast response time" />
                                      </FormField>
                                      <FormField label="Card Content">
                                        <TextAreaField value={card.content} onChange={(value) => updateCard(section.id, card.id, { content: value })} placeholder="Write the card copy here." rows={4} />
                                      </FormField>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="upload-showcase-empty">
                                  <p>This section is marked as a card layout. Add at least one card.</p>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="upload-showcase-empty">
                    <p>Add your first section to begin building the page structure.</p>
                  </div>
                )}
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
                <div className="summary-card">
                  <div className="summary-card__top">
                    <span>Submission preview</span>
                    <strong>{pageType.trim() || "content"}</strong>
                  </div>
                  <div className="summary-card__items">
                    <div className="summary-item">
                      <span>Status</span>
                      <strong>{isSubmitting ? "Saving" : "Ready"}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Sections ready</span>
                      <strong>{preparedSections.length}</strong>
                    </div>
                    <div className="summary-item">
                      <span>SEO description</span>
                      <strong>{metaDescription.trim() ? "Added" : "Missing"}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </form>
      </Panel>
    </div>
  );
}
