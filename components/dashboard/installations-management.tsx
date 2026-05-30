"use client";

import { type ChangeEvent, type FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { CalendarIcon, FilterIcon, LocationIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { ActionLink, DetailPanel, DirectoryToolbar, InlineCallout } from "@/components/dashboard/management-primitives";
import { FormField } from "@/components/dashboard/modals";
import { FormSubmitter } from "@/components/dashboard/form-submitter";
import { Button, EmptyScaffold, MetricCardSecondary, Pagination, Panel, SelectField, StatusPill, TableActionsMenu, Tabs, TextAreaField, TextField, cx } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import {
  buildMultipartFormData,
  createInstallation,
  DEFAULT_PAGE_SIZE,
  deleteInstallation,
  formatDateLabel,
  formatEnumLabel,
  getInstallation,
  getInstallations,
  getPackages,
  updateInstallation,
} from "@/lib/admin-api";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { InstallationRecord, ManagedMediaAsset, PackageRecord, PaginationMeta } from "@/types/api.types";

const projectStatusTabs = ["All", "Published", "Draft", "Archived"] as const;
const projectFormId = "project-form";

type ProjectStatusFilter = (typeof projectStatusTabs)[number];
type ProjectValidationErrors = Partial<Record<
  | "overview"
  | "location"
  | "highlights"
  | "systemDetails"
  | "whatItPowers"
  | "media",
  string
>>;

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readStringArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    }
  }

  return [];
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferMediaKind(source: string, mimeType?: string | null) {
  const normalizedSource = source.toLowerCase();
  const normalizedMime = mimeType?.toLowerCase() ?? "";

  if (normalizedMime.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(normalizedSource)) {
    return "image" as const;
  }

  if (normalizedMime.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(normalizedSource)) {
    return "video" as const;
  }

  if (normalizedMime.includes("pdf") || normalizedSource.endsWith(".pdf")) {
    return "pdf" as const;
  }

  return "file" as const;
}

function fileMediaKind(file: File) {
  return inferMediaKind(file.name, file.type);
}

function useObjectUrls(files: File[]) {
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
  return urls;
}

function fileSelectionKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
}

function mergeSelectedFiles(currentFiles: File[], nextFiles: File[]) {
  const seen = new Set(currentFiles.map(fileSelectionKey));
  const merged = [...currentFiles];

  nextFiles.forEach((file) => {
    const key = fileSelectionKey(file);

    if (!seen.has(key)) {
      seen.add(key);
      merged.push(file);
    }
  });

  return merged;
}

function normalizeProjectMedia(record: InstallationRecord | Record<string, unknown>) {
  const raw = record as Record<string, unknown>;
  const mediaRecord = isRecord(raw.media) ? raw.media : null;
  const sourceMedia = Array.isArray(raw.media) ? raw.media : [];
  const normalizedMedia = sourceMedia
    .filter((item): item is ManagedMediaAsset => isRecord(item) && typeof item.url === "string" && item.url.trim().length > 0)
    .map((item, index) => ({
      id: item.id ?? `${item.url}-${index}`,
      name: item.name || item.url.split("/").pop() || `Media ${index + 1}`,
      url: item.url.trim(),
      mime_type: item.mime_type ?? null,
      kind: item.kind ?? inferMediaKind(item.url, item.mime_type),
    }));

  const fallbackImages = [
    ...readStringArray(raw, ["image_urls"]),
    ...(mediaRecord ? readStringArray(mediaRecord, ["image_urls"]) : []),
  ].map((url, index) => ({
    id: `image-${index}-${url}`,
    name: url.split("/").pop() || `Image ${index + 1}`,
    url,
    kind: "image" as const,
  }));

  const fallbackVideos = readStringArray(raw, ["video_urls"]).map((url, index) => ({
    id: `video-${index}-${url}`,
    name: url.split("/").pop() || `Video ${index + 1}`,
    url,
    kind: "video" as const,
  }));

  const combined = [...normalizedMedia, ...fallbackImages, ...fallbackVideos];

  return combined.filter((item, index, all) => all.findIndex((entry) => entry.url === item.url) === index);
}

function projectImages(record: InstallationRecord | Record<string, unknown>) {
  return normalizeProjectMedia(record)
    .filter((asset) => asset.kind === "image")
    .map((asset) => asset.url)
    .slice(0, 4);
}

function projectLocation(record: InstallationRecord) {
  return [record.address, record.city, record.state, record.country].filter(Boolean).join(", ") || "Nigeria";
}

function projectTitle(record: InstallationRecord) {
  return record.title || record.package_name || record.address || record.customer_name || record.customer_email || "Untitled project";
}

function projectSummary(record: InstallationRecord) {
  return record.summary || record.overview || "Project summary coming soon.";
}

function projectDate(record: InstallationRecord) {
  return record.scheduled_date || record.created_at;
}

function matchesProjectStatus(status: string, filter: ProjectStatusFilter) {
  if (filter === "All") {
    return true;
  }

  const normalized = status.trim().toLowerCase();

  if (filter === "Published") {
    return normalized !== "draft" && normalized !== "archived" && normalized !== "cancelled";
  }

  if (filter === "Draft") {
    return normalized === "draft";
  }

  return normalized === "archived" || normalized === "cancelled";
}

function withSelectedOption(options: Array<{ label: string; value: string }>, value: string, fallbackLabel: string) {
  if (!value || options.some((option) => option.value === value)) {
    return options;
  }

  return [{ value, label: fallbackLabel }, ...options];
}

function buildProjectTitle({
  packageName,
  address,
  city,
  state,
  country,
  fallbackTitle,
}: {
  packageName?: string | null;
  address: string;
  city: string;
  state: string;
  country: string;
  fallbackTitle?: string;
}) {
  const normalizedPackageName = packageName?.trim() ?? "";
  const normalizedFallbackTitle = fallbackTitle?.trim() ?? "";
  const primaryLocation = [city.trim(), state.trim(), address.trim(), country.trim()].find(Boolean) || "";

  if (normalizedPackageName) {
    return primaryLocation ? `${normalizedPackageName} Installation - ${primaryLocation}` : `${normalizedPackageName} Installation`;
  }

  if (normalizedFallbackTitle) {
    return normalizedFallbackTitle;
  }

  return primaryLocation ? `Solar Installation - ${primaryLocation}` : "Solar Installation";
}

function buildProjectSummary(overview: string, fallbackSummary?: string) {
  const normalizedOverview = overview.trim();

  if (!normalizedOverview) {
    return fallbackSummary?.trim() ?? "";
  }

  if (normalizedOverview.length <= 180) {
    return normalizedOverview;
  }

  const shortened = normalizedOverview.slice(0, 177);
  const boundary = shortened.lastIndexOf(" ");
  return `${(boundary > 120 ? shortened.slice(0, boundary) : shortened).trim()}...`;
}

function ProjectCard({
  record,
  canDelete,
  onDelete,
}: {
  record: InstallationRecord;
  canDelete: boolean;
  onDelete: (record: InstallationRecord) => Promise<void>;
}) {
  const slides = projectImages(record);
  const [activeIndex, setActiveIndex] = useState(0);
  const resolvedActiveIndex = slides.length ? activeIndex % slides.length : 0;

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 3200);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <article className="installation-card">
      <div className="installation-card__actions">
        <TableActionsMenu
          items={[
            { label: "Edit Project", href: `/projects/new?projectId=${record.id}` },
            ...(canDelete
              ? [
                  {
                    label: "Delete Project",
                    tone: "danger" as const,
                    icon: <TrashIcon className="menu-icon" />,
                    onSelect: () => void onDelete(record),
                  },
                ]
              : []),
          ]}
        />
      </div>

      {slides.length ? (
        <div className="installation-card__media">
          {slides.map((image, index) => (
            <img
              key={`${record.id}-slide-${index}`}
              src={image}
              alt={projectTitle(record)}
              className={cx("installation-card__image", resolvedActiveIndex === index && "is-active")}
            />
          ))}
        </div>
      ) : (
        <div className="installation-card__placeholder">
          <strong>{normalizeProjectMedia(record).some((asset) => asset.kind === "video") ? "Video project" : "No project image"}</strong>
          <span>{normalizeProjectMedia(record).some((asset) => asset.kind === "video") ? "Videos are kept out of the card slider until image media is added." : "Upload at least one image to power the project slider."}</span>
        </div>
      )}

      <div className="installation-card__shade" />

      <div className="installation-card__top">
        <span>
          <CalendarIcon className="mini-icon" />
          {formatDateLabel(projectDate(record))}
        </span>
        <span>
          <LocationIcon className="mini-icon" />
          {projectLocation(record)}
        </span>
      </div>

      {slides.length ? (
        <div className="installation-card__dots" aria-hidden="true">
          {slides.map((_, index) => (
            <span key={`${record.id}-dot-${index}`} className={cx(resolvedActiveIndex === index && "is-active")} />
          ))}
        </div>
      ) : null}

      <div className="installation-card__copy">
        <h3>{projectTitle(record)}</h3>
        <p>{projectSummary(record)}</p>
        <div className="installation-card__meta">
          <StatusPill label={formatEnumLabel(record.status)} tone={toneFromStatus(record.status)} solid={false} />
          <span>{record.package_name ? `Package • ${record.package_name}` : "Package • None"}</span>
        </div>
      </div>
    </article>
  );
}

export function InstallationsManagementScreen() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<InstallationRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatusFilter>("All");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const canCreateProjects = can("installations", "create");
  const canDeleteProjects = can("installations", "delete");

  useEffect(() => {
    let cancelled = false;

    getInstallations({
      page,
      limit: DEFAULT_PAGE_SIZE,
      search: deferredQuery.trim() || undefined,
      q: deferredQuery.trim() || undefined,
      fields: [
        "id",
        "title",
        "summary",
        "overview",
        "package_id",
        "package_name",
        "client_name",
        "customer_name",
        "customer_email",
        "status",
        "scheduled_date",
        "created_at",
        "city",
        "state",
        "country",
        "views",
        "media",
        "image_urls",
        "video_urls",
      ],
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

        setError(getErrorMessage(loadError, "Projects could not be loaded."));
        setRows([]);
        setPagination(emptyPagination);
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
    () => rows.filter((record) => matchesProjectStatus(record.status, status)),
    [rows, status],
  );
  const mostUsedPackage = useMemo(() => {
    const counts = new Map<string, number>();

    rows.forEach((record) => {
      const key = record.package_name?.trim() || "Independent Project";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "No package yet";
  }, [rows]);
  const publishedCount = rows.filter((record) => matchesProjectStatus(record.status, "Published")).length;
  const draftCount = rows.filter((record) => matchesProjectStatus(record.status, "Draft")).length;
  const mediaCount = rows.reduce((sum, record) => sum + normalizeProjectMedia(record).length, 0);
  const notice = searchParams.get("created")
    ? "Project created successfully."
    : searchParams.get("updated")
      ? "Project updated successfully."
      : null;

  function handleSearchChange(value: string) {
    setIsLoading(true);
    setError(null);
    setPage(1);
    setQuery(value);
  }

  function handlePageChange(nextPage: number) {
    setIsLoading(true);
    setError(null);
    setPage(nextPage);
  }

  async function handleDelete(record: InstallationRecord) {
    try {
      await deleteInstallation(record.id);
      toast({
        title: "Project deleted",
        description: `${projectTitle(record)} was removed successfully.`,
        variant: "success",
      });

      if (rows.length === 1 && page > 1) {
        setIsLoading(true);
        setPage((current) => current - 1);
      } else {
        setIsLoading(true);
        setRefreshKey((current) => current + 1);
      }
    } catch (deleteError) {
      if (isDashboardActionCancelledError(deleteError) || isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The project could not be deleted."),
        variant: "error",
      });
    }
  }

  return (
    <div className="dashboard-stack">
      <section className="stats-grid--four">
        <MetricCardSecondary title="Total Projects" value={pagination.total.toLocaleString()} icon="products" spark={[12, 18, 24, 30, 36, 42]} />
        <MetricCardSecondary title="Most Used Package" value={mostUsedPackage} icon="bundles" spark={[10, 18, 22, 30, 36, 44]} />
        <MetricCardSecondary title="Published On This Page" value={publishedCount.toLocaleString()} icon="verification" spark={[12, 16, 22, 28, 36, 40]} />
        <MetricCardSecondary title="Media Assets" value={mediaCount.toLocaleString()} icon="calendar" spark={[8, 14, 18, 24, 30, 34]} />
      </section>

      {notice ? <InlineCallout>{notice}</InlineCallout> : null}

      <Panel className="overflow-hidden">
        <div className="management-surface__body">
          <div className="section-header content-section-header">
            <div>
              <h2 className="section-title">Projects</h2>
              <p className="section-description">Manage the portfolio content that powers the public Projects pages and homepage cards.</p>
            </div>
            {canCreateProjects ? (
              <ActionLink href="/projects/new" leadingIcon={<PlusIcon className="mini-icon" />}>
                Add New Project
              </ActionLink>
            ) : null}
          </div>

          <DirectoryToolbar
            searchValue={query}
            onSearchChange={handleSearchChange}
            searchPlaceholder="Search projects..."
            filters={
              <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                Filter
              </Button>
            }
          />

          <div className="management-surface__filters is-inline">
            <Tabs value={status} onChange={setStatus} options={projectStatusTabs} compact />
          </div>
        </div>

        <ErrorMessage title="Project load failed" message={error} />

        {isLoading && !rows.length ? (
          <div className="p-6">
            <p className="section-description">Loading projects...</p>
          </div>
        ) : !isLoading && !rows.length && !error ? (
          <div className="p-6">
            <EmptyScaffold title="No projects found" description="No record found on the database" />
          </div>
        ) : (
          <>
            <div className="installation-grid">
              {filteredRows.length ? (
                filteredRows.map((record) => (
                  <ProjectCard key={record.id} record={record} canDelete={canDeleteProjects} onDelete={handleDelete} />
                ))
              ) : (
                <div className="p-6">
                  <EmptyScaffold title="No projects matched" description="No record found on the database" />
                </div>
              )}
            </div>
            <Pagination page={page} totalPages={Math.max(pagination.totalPages, 1)} onChange={handlePageChange} />
          </>
        )}

        {!isLoading && rows.length ? (
          <div className="px-6 pb-6">
            <InlineCallout tone="warning">
              Draft projects currently visible here: {draftCount.toLocaleString()}.
            </InlineCallout>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

export function InstallationFormScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const projectId = searchParams.get("projectId");
  const isEditing = Boolean(projectId);
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [isLoadingReferences, setIsLoadingReferences] = useState(true);
  const [isLoadingProject, setIsLoadingProject] = useState(Boolean(projectId));
  const [packageId, setPackageId] = useState("none");
  const [existingTitle, setExistingTitle] = useState("");
  const [existingSummary, setExistingSummary] = useState("");
  const [overview, setOverview] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [installationTimeLabel, setInstallationTimeLabel] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [status, setStatus] = useState("published");
  const [highlightsText, setHighlightsText] = useState("");
  const [whatItPowers, setWhatItPowers] = useState<string[]>([]);
  const [whatItPowersInput, setWhatItPowersInput] = useState("");
  const [inverterSize, setInverterSize] = useState("");
  const [pvSize, setPvSize] = useState("");
  const [batterySize, setBatterySize] = useState("");
  const [existingMedia, setExistingMedia] = useState<ManagedMediaAsset[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<ProjectValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mediaPreviewUrls = useObjectUrls(mediaFiles);

  useEffect(() => {
    let cancelled = false;

    getPackages({
      page: 1,
      limit: 100,
      fields: ["id", "name", "description", "overview", "system_details", "what_it_powers", "system_size_kw"],
    })
      .then((payload) => {
        if (!cancelled) {
          setPackages(payload.data);
        }
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        if (!isDashboardSessionExpiredError(loadError)) {
          setReferenceError(getErrorMessage(loadError, "Package options could not be loaded."));
          setPackages([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingReferences(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!projectId) {
      setIsLoadingProject(false);
      return;
    }

    let cancelled = false;

    setIsLoadingProject(true);

    getInstallation(projectId)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        const detail = payload.data;
        const systemDetails = detail.system_details;
        setPackageId(detail.package_id || "none");
        setExistingTitle(detail.title || "");
        setExistingSummary(detail.summary || "");
        setOverview(detail.overview || "");
        setAddress(detail.address || "");
        setCity(detail.city || "");
        setState(detail.state || "");
        setCountry(detail.country || "Nigeria");
        setInstallationTimeLabel(detail.installation_time_label || "");
        setScheduledDate(detail.scheduled_date || "");
        setStatus(detail.status || "published");
        setHighlightsText((detail.highlights ?? []).join("\n"));
        setWhatItPowers(detail.what_it_powers ?? []);
        setInverterSize(systemDetails?.inverter_size || detail.inverter_type || "");
        setPvSize(systemDetails?.pv_size || (detail.system_size_kw ? String(detail.system_size_kw) : ""));
        setBatterySize(systemDetails?.battery_size || "");
        setExistingMedia(normalizeProjectMedia(detail));
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        if (isDashboardSessionExpiredError(loadError)) {
          return;
        }

        toast({
          title: "Project load failed",
          description: getErrorMessage(loadError, "The project could not be loaded."),
          variant: "error",
        });
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingProject(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, toast]);

  const packageOptions = useMemo(
    () =>
      withSelectedOption(
        [
          { value: "none", label: "None" },
          ...packages.map((pkg) => ({
            value: pkg.id,
            label: pkg.name,
          })),
        ],
        packageId,
        `Selected package (${packageId})`,
      ),
    [packageId, packages],
  );
  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === packageId) ?? null,
    [packageId, packages],
  );
  const combinedMediaPreview = useMemo(
    () => [
      ...existingMedia.map((media) => ({
        key: `existing-${media.id ?? media.url}`,
        name: media.name,
        url: media.url,
        kind: media.kind ?? inferMediaKind(media.url, media.mime_type),
        isExisting: true,
        fileIndex: null,
      })),
      ...mediaFiles.map((file, index) => ({
        key: `new-${file.name}-${index}`,
        name: file.name,
        url: mediaPreviewUrls[index] ?? "",
        kind: fileMediaKind(file),
        isExisting: false,
        fileIndex: index,
      })),
    ],
    [existingMedia, mediaFiles, mediaPreviewUrls],
  );

  function clearFieldError(field: keyof ProjectValidationErrors) {
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handlePackageChange(nextPackageId: string) {
    setPackageId(nextPackageId);

    const nextPackage = packages.find((pkg) => pkg.id === nextPackageId);

    if (!nextPackage || nextPackageId === "none") {
      return;
    }

    setOverview((current) => current || nextPackage.overview || nextPackage.description || "");
    setHighlightsText((current) => current);
    setWhatItPowers((current) => (current.length ? current : nextPackage.what_it_powers ?? []));
    setInverterSize((current) => current || nextPackage.system_details?.inverter_size || "");
    setPvSize((current) => current || nextPackage.system_details?.pv_size || (nextPackage.system_size_kw ? String(nextPackage.system_size_kw) : ""));
    setBatterySize((current) => current || nextPackage.system_details?.battery_size || "");
  }

  function handleMediaFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    if (!nextFiles.length) {
      return;
    }

    setMediaFiles((current) => mergeSelectedFiles(current, nextFiles));
    clearFieldError("media");
    event.target.value = "";
  }

  function removeMediaFile(index: number) {
    setMediaFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  function addWhatItPowers() {
    const nextValue = whatItPowersInput.trim();

    if (!nextValue) {
      return;
    }

    if (!whatItPowers.some((item) => item.toLowerCase() === nextValue.toLowerCase())) {
      setWhatItPowers((current) => [...current, nextValue]);
      clearFieldError("whatItPowers");
    }

    setWhatItPowersInput("");
  }

  function removeWhatItPowers(index: number) {
    setWhatItPowers((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function validateForm() {
    const nextErrors: ProjectValidationErrors = {};
    const highlights = highlightsText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const hasMedia = combinedMediaPreview.some((media) => media.kind === "image" || media.kind === "video");

    if (!overview.trim()) {
      nextErrors.overview = "Enter the project overview.";
    }

    if (![address.trim(), city.trim(), state.trim()].some(Boolean)) {
      nextErrors.location = "Add the project location.";
    }

    if (!highlights.length) {
      nextErrors.highlights = "Add at least one project highlight.";
    }

    if (!whatItPowers.length) {
      nextErrors.whatItPowers = "Add at least one What It Powers item.";
    }

    if (!inverterSize.trim() && !pvSize.trim() && !batterySize.trim()) {
      nextErrors.systemDetails = "Add at least one system detail value.";
    }

    if (!hasMedia) {
      nextErrors.media = "Upload at least one image or video.";
    }

    setErrors(nextErrors);

    return {
      isValid: Object.keys(nextErrors).length === 0,
      highlights,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const validation = validateForm();

    if (!validation.isValid) {
      setIsSubmitting(false);
      return;
    }

    try {
      const normalizedPackageId = packageId === "none" ? null : packageId.trim() || null;
      const derivedTitle = buildProjectTitle({
        packageName: selectedPackage?.name,
        address,
        city,
        state,
        country,
        fallbackTitle: existingTitle,
      });
      const derivedSummary = buildProjectSummary(overview, existingSummary);
      const normalizedAddress = address.trim() || [city.trim(), state.trim()].filter(Boolean).join(", ") || country.trim() || "Nigeria";
      const normalizedCity = city.trim();
      const normalizedState = state.trim();
      const normalizedCountry = country.trim() || "Nigeria";
      const systemDetails = {
        inverter_size: inverterSize.trim(),
        inverter_label: inverterSize.trim() ? `${inverterSize.trim()}kVA` : "",
        pv_size: pvSize.trim(),
        pv_label: pvSize.trim() ? `${pvSize.trim()}kWp` : "",
        battery_size: batterySize.trim(),
        battery_label: batterySize.trim() ? `${batterySize.trim()}kWh` : "",
      };
      const payload = buildMultipartFormData({
        package_id: normalizedPackageId,
        title: derivedTitle,
        slug: slugify(derivedTitle),
        summary: derivedSummary,
        overview: overview.trim(),
        address: normalizedAddress,
        city: normalizedCity,
        state: normalizedState,
        country: normalizedCountry,
        installation_time_label: installationTimeLabel.trim() || undefined,
        scheduled_date: scheduledDate.trim() || new Date().toISOString(),
        highlights: validation.highlights,
        what_it_powers: whatItPowers,
        system_details: systemDetails,
        status,
        system_size_kw: Number(pvSize.trim() || inverterSize.trim() || 0) || 0,
        number_of_panels: 0,
        panel_type: "",
        inverter_type: inverterSize.trim() ? `${inverterSize.trim()}kVA` : "",
      });

      mediaFiles.forEach((file) => {
        payload.append("media", file, file.name);
        if (fileMediaKind(file) === "image") {
          payload.append("images", file, file.name);
        }
      });

      const primaryImage = mediaFiles.find((file) => fileMediaKind(file) === "image");
      if (primaryImage) {
        payload.append("image", primaryImage, primaryImage.name);
      }

      if (isEditing && projectId) {
        await updateInstallation(projectId, payload);
      } else {
        await createInstallation(payload);
      }

      router.push(`/projects?${isEditing ? "updated=1" : "created=1"}`);
    } catch (saveError) {
      if (isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: `${isEditing ? "Update" : "Create"} project failed`,
        description: getErrorMessage(saveError, `The project could not be ${isEditing ? "updated" : "created"}.`),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dashboard-stack">
      <Panel className="product-form-shell">
        <form id={projectFormId} onSubmit={handleSubmit}>
          <div className="product-form-shell__header">
            <div>
              <h2 className="section-title">{isEditing ? "Edit Project" : "Add A New Project"}</h2>
              <p className="section-description">Capture the public project content exactly once here, then reuse it across the homepage and Projects page.</p>
            </div>
            <FormSubmitter
              formId={projectFormId}
              cancelLabel="Cancel"
              onCancel={() => router.push("/projects")}
              primaryLabel={isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Finish"}
              disabled={isSubmitting || isLoadingProject}
            />
          </div>

          <div className="product-form-grid">
            <DetailPanel title="Project Information" description="Set the package source, overview, location, and installation timing for this project.">
              <div className="detail-panel__stack">
                <FormField
                  label="Project Package"
                  hint={isLoadingReferences ? "Loading packages..." : referenceError || "Select the package this project came from, or choose None."}
                >
                  <SelectField
                    value={packageId}
                    onChange={handlePackageChange}
                    options={packageOptions}
                    placeholder="Select package"
                    disabled={isLoadingReferences || isLoadingProject}
                  />
                </FormField>

                <FormField label="Project Overview" error={errors.overview}>
                  <TextAreaField
                    value={overview}
                    onChange={(value) => {
                      setOverview(value);
                      clearFieldError("overview");
                    }}
                    placeholder="Describe the project in more detail."
                    rows={6}
                    invalid={Boolean(errors.overview)}
                  />
                </FormField>

                <FormField label="Location" error={errors.location}>
                  <div className="detail-panel__stack">
                    <TextAreaField
                      value={address}
                      onChange={(value) => {
                        setAddress(value);
                        clearFieldError("location");
                      }}
                      placeholder="Community, estate, street, or site address"
                      rows={4}
                      invalid={Boolean(errors.location)}
                    />
                    <div className="product-inline-row is-three">
                      <TextField
                        value={city}
                        onChange={(event) => {
                          setCity(event.target.value);
                          clearFieldError("location");
                        }}
                        placeholder="City"
                        invalid={Boolean(errors.location)}
                      />
                      <TextField
                        value={state}
                        onChange={(event) => {
                          setState(event.target.value);
                          clearFieldError("location");
                        }}
                        placeholder="State"
                        invalid={Boolean(errors.location)}
                      />
                      <TextField
                        value={country}
                        onChange={(event) => {
                          setCountry(event.target.value);
                          clearFieldError("location");
                        }}
                        placeholder="Country"
                        invalid={Boolean(errors.location)}
                      />
                    </div>
                  </div>
                </FormField>

                <div className="product-inline-row is-two">
                  <FormField label="Installation Time">
                    <TextField
                      value={installationTimeLabel}
                      onChange={(event) => setInstallationTimeLabel(event.target.value)}
                      placeholder="48 hrs"
                    />
                  </FormField>
                </div>
              </div>
            </DetailPanel>

            <DetailPanel title="Highlights" description="Enter the portfolio highlights, system sizing, and what this installation can power.">
              <div className="detail-panel__stack">
                <FormField label="Highlights" hint="Use one highlight per line." error={errors.highlights}>
                  <TextAreaField
                    value={highlightsText}
                    onChange={(value) => {
                      setHighlightsText(value);
                      clearFieldError("highlights");
                    }}
                    placeholder={"24/7 uninterrupted power support\nReduced generator costs by over 70%"}
                    rows={8}
                    invalid={Boolean(errors.highlights)}
                  />
                </FormField>

                <FormField label="System Details" error={errors.systemDetails}>
                  <div className="detail-panel__stack">
                    <div className="product-inline-row is-two">
                      <TextField
                        value={inverterSize}
                        onChange={(event) => {
                          setInverterSize(event.target.value);
                          clearFieldError("systemDetails");
                        }}
                        placeholder="Inverter Size"
                        invalid={Boolean(errors.systemDetails)}
                      />
                      <TextField
                        value={pvSize}
                        onChange={(event) => {
                          setPvSize(event.target.value);
                          clearFieldError("systemDetails");
                        }}
                        placeholder="PV Size"
                        invalid={Boolean(errors.systemDetails)}
                      />
                    </div>
                    <TextField
                      value={batterySize}
                      onChange={(event) => {
                        setBatterySize(event.target.value);
                        clearFieldError("systemDetails");
                      }}
                      placeholder="Battery Size"
                      invalid={Boolean(errors.systemDetails)}
                    />
                  </div>
                </FormField>

                <FormField label="What It Powers" error={errors.whatItPowers}>
                  <div className="detail-panel__stack">
                    <div className="product-inline-row">
                      <TextField
                        value={whatItPowersInput}
                        onChange={(event) => setWhatItPowersInput(event.target.value)}
                        placeholder="Add an appliance or load item"
                        invalid={Boolean(errors.whatItPowers)}
                      />
                      <Button type="button" variant="secondary" size="md" onClick={addWhatItPowers}>
                        Add
                      </Button>
                    </div>

                    {whatItPowers.length ? (
                      <div className="project-chip-list">
                        {whatItPowers.map((item, index) => (
                          <button key={`${item}-${index}`} type="button" className="chip-pill is-active" onClick={() => removeWhatItPowers(index)}>
                            {item}
                            <span aria-hidden="true">×</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="form-repeat-row is-readonly">
                        <span>No load items added yet.</span>
                      </div>
                    )}
                  </div>
                </FormField>
              </div>
            </DetailPanel>

            <DetailPanel title="Project Media" description="Upload multiple images and videos. The public slider will use only the first 4 images in order.">
              <div className="detail-panel__stack">
                <FormField label="Project Images / Videos" error={errors.media}>
                  <div className={cx("project-upload-dropzone", errors.media && "is-invalid")}>
                    <input type="file" accept="image/*,video/*" multiple onChange={handleMediaFilesChange} />
                    <strong>Upload project media</strong>
                    <span>Images and videos are allowed. Select several at once or add more later. The first image becomes the primary project card image.</span>
                  </div>
                </FormField>

                {combinedMediaPreview.length ? (
                  <div className="detail-panel__stack">
                    <div className="project-media-grid">
                      {combinedMediaPreview.map((media) => (
                        <article key={media.key} className="project-media-card">
                          <div className="project-media-card__surface">
                            {!media.isExisting && media.fileIndex !== null ? (
                              <button
                                type="button"
                                className="media-preview-dismiss"
                                aria-label={`Remove ${media.name}`}
                                onClick={() => removeMediaFile(media.fileIndex)}
                              >
                                <span aria-hidden="true">×</span>
                              </button>
                            ) : null}
                            {media.kind === "image" ? (
                              <img src={media.url} alt={media.name} />
                            ) : media.kind === "video" ? (
                              <video src={media.url} muted controls />
                            ) : (
                              <div className="project-media-card__file">
                                <strong>{media.kind?.toUpperCase() || "FILE"}</strong>
                              </div>
                            )}
                          </div>
                          <div className="project-media-card__footer">
                            <div>
                              <strong>{media.name}</strong>
                              <span>{media.isExisting ? "Existing media" : "New upload"}</span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>

                    {mediaFiles.length ? (
                      <button type="button" className="upload-preview-card__reset" onClick={() => setMediaFiles([])}>
                        {existingMedia.length ? "Use existing media instead" : "Clear selected media"}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="upload-showcase-empty">
                    <PlusIcon className="mini-icon" />
                    <p>No media uploaded yet. Add at least one image or video for this project.</p>
                  </div>
                )}

                {selectedPackage ? (
                  <InlineCallout>
                    Package prefill active: {selectedPackage.name}. Blank system-detail and power fields are seeded from the selected package where available.
                  </InlineCallout>
                ) : null}
              </div>
            </DetailPanel>
          </div>
        </form>
      </Panel>
    </div>
  );
}
