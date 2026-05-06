"use client";

import Link from "next/link";
import { type FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { EyeIcon, FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { ActionLink, DetailPanel, DirectoryToolbar, InlineCallout, ManagementBackLink, TagList } from "@/components/dashboard/management-primitives";
import { FormField, Modal, ModalFooterActions, ModalSelect, ModalTextArea } from "@/components/dashboard/modals";
import { FormSubmitter } from "@/components/dashboard/form-submitter";
import { Button, EmptyScaffold, MetricCardSecondary, Panel, Pagination, SelectField, StatusPill, TableActionsMenu, Tabs, TextAreaField, TextField } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { createJob, DEFAULT_PAGE_SIZE, deleteJob, formatCurrencyLabel, formatDateLabel, formatDateTimeLabel, formatEnumLabel, getJobApplicants, getJobBySlug, getJobs, updateJob, updateJobApplicant } from "@/lib/admin-api";
import { isDashboardSessionExpiredError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { JobApiRecord, JobApplicantRecord, PaginationMeta } from "@/types/api.types";

const jobStatusTabs = ["All", "Open", "Assigned", "In Progress", "Completed", "Verified"] as const;
const jobStatusOptions = [
  { label: "Open", value: "open" },
  { label: "Assigned", value: "assigned" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Verified", value: "verified" },
  { label: "Cancelled", value: "cancelled" },
] as const;
const applicantStatusOptions = [
  { label: "Pending", value: "pending" },
  { label: "Reviewed", value: "reviewed" },
  { label: "Shortlisted", value: "shortlisted" },
  { label: "Accepted", value: "accepted" },
  { label: "Rejected", value: "rejected" },
] as const;
const jobFormId = "job-board-form";
const applicantReviewFormId = "job-applicant-review-form";

type JobStatusFilter = (typeof jobStatusTabs)[number];

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

function matchesJobStatus(status: string, filter: JobStatusFilter) {
  if (filter === "All") {
    return true;
  }

  const normalized = status.trim().toLowerCase();

  switch (filter) {
    case "Open":
      return normalized === "open";
    case "Assigned":
      return normalized === "assigned";
    case "In Progress":
      return normalized === "in_progress" || normalized === "in progress";
    case "Completed":
      return normalized === "completed";
    case "Verified":
      return normalized === "verified";
    default:
      return true;
  }
}

function buildStatusOptions(current?: string) {
  const normalizedCurrent = current?.trim().toLowerCase();

  if (!normalizedCurrent || jobStatusOptions.some((option) => option.value === normalizedCurrent)) {
    return [...jobStatusOptions];
  }

  return [{ label: formatEnumLabel(normalizedCurrent), value: normalizedCurrent }, ...jobStatusOptions];
}

function buildApplicantStatusOptions(current?: string) {
  const normalizedCurrent = current?.trim().toLowerCase();

  if (!normalizedCurrent || applicantStatusOptions.some((option) => option.value === normalizedCurrent)) {
    return [...applicantStatusOptions];
  }

  return [{ label: formatEnumLabel(normalizedCurrent), value: normalizedCurrent }, ...applicantStatusOptions];
}

function jobTagItems(job: JobApiRecord) {
  return [
    job.location,
    `${job.required_experience_years} yrs exp`,
    job.deadline ? `Due ${formatDateLabel(job.deadline)}` : "No deadline",
  ];
}

export function JobsManagementScreen() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<JobApiRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<JobStatusFilter>("All");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const canCreateJobs = can("jobs", "create");
  const canDeleteJobs = can("jobs", "delete");

  useEffect(() => {
    let cancelled = false;

    getJobs({
      page,
      limit: DEFAULT_PAGE_SIZE,
      search: deferredQuery.trim() || undefined,
      q: deferredQuery.trim() || undefined,
      fields: [
        "id",
        "slug",
        "title",
        "description",
        "location",
        "status",
        "budget",
        "deadline",
        "created_at",
        "required_experience_years",
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

        setError(getErrorMessage(loadError, "Jobs could not be loaded."));
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
    () => rows.filter((job) => matchesJobStatus(job.status, status)),
    [rows, status],
  );

  const openCount = rows.filter((job) => matchesJobStatus(job.status, "Open")).length;
  const assignedCount = rows.filter((job) => matchesJobStatus(job.status, "Assigned")).length;
  const completedCount = rows.filter((job) => matchesJobStatus(job.status, "Completed")).length;
  const notice = searchParams.get("created") ? "Job created successfully." : null;

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

  async function handleDelete(job: JobApiRecord) {
    try {
      await deleteJob(job.id);
      toast({
        title: "Job deleted",
        description: `${job.title} was removed successfully.`,
        variant: "success",
      });

      if (rows.length === 1 && page > 1) {
        setIsLoading(true);
        setError(null);
        setPage((current) => current - 1);
      } else {
        setIsLoading(true);
        setError(null);
        setRefreshKey((current) => current + 1);
      }
    } catch (deleteError) {
      if (isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The job could not be deleted."),
        variant: "error",
      });
    }
  }

  return (
    <div className="dashboard-stack">
      <section className="stats-grid--four">
        <MetricCardSecondary title="Total Jobs" value={pagination.total.toLocaleString()} icon="products" spark={[12, 16, 22, 30, 34, 40]} />
        <MetricCardSecondary title="Open On This Page" value={openCount.toLocaleString()} icon="calendar" spark={[18, 20, 24, 26, 34, 38]} />
        <MetricCardSecondary title="Assigned On This Page" value={assignedCount.toLocaleString()} icon="verification" spark={[10, 14, 18, 22, 26, 30]} />
        <MetricCardSecondary title="Completed On This Page" value={completedCount.toLocaleString()} icon="sales" spark={[16, 18, 24, 32, 42, 48]} />
      </section>

      {notice ? <InlineCallout>{notice}</InlineCallout> : null}

      <Panel className="overflow-hidden">
        <div className="management-surface__body">
          <div className="section-header content-section-header">
            <div>
              <h2 className="section-title">All Jobs</h2>
              <p className="section-description">Manage posted installation jobs and installer applications.</p>
            </div>
            {canCreateJobs ? (
              <ActionLink href="/jobs/new" leadingIcon={<PlusIcon className="mini-icon" />}>
                Add Job
              </ActionLink>
            ) : null}
          </div>
          <DirectoryToolbar
            searchValue={query}
            onSearchChange={handleSearchChange}
            searchPlaceholder="Search jobs..."
            filters={
              <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                Filter
              </Button>
            }
          />
          <div className="management-surface__filters is-inline">
            <Tabs value={status} onChange={setStatus} options={jobStatusTabs} compact />
          </div>
        </div>

        <ErrorMessage title="Job load failed" message={error} />

        {isLoading && !rows.length ? (
          <div className="p-6">
            <p className="section-description">Loading jobs...</p>
          </div>
        ) : !isLoading && !rows.length && !error ? (
          <div className="p-6">
            <EmptyScaffold title="No jobs found" description="No record found on the database" />
          </div>
        ) : (
          <>
            <div className="job-grid">
              {filteredRows.length ? (
                filteredRows.map((job) => (
                  <article key={job.id} className="job-card">
                    <div className="job-card__top">
                      <StatusPill label={formatEnumLabel(job.status)} tone={toneFromStatus(job.status)} solid={false} />
                      <TableActionsMenu
                        items={[
                          { label: "View Job", href: `/jobs/${job.slug}`, icon: <EyeIcon className="menu-icon" /> },
                          ...(canDeleteJobs
                            ? [
                                {
                                  label: "Delete Job",
                                  tone: "danger" as const,
                                  icon: <TrashIcon className="menu-icon" />,
                                  onSelect: () => void handleDelete(job),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                    <h3>{job.title}</h3>
                    <p>{job.description || "No job description provided."}</p>
                    <TagList items={jobTagItems(job)} />
                    <div className="job-card__footer">
                      <strong>{formatCurrencyLabel(job.budget)}</strong>
                      <span>Created {formatDateLabel(job.created_at)}</span>
                      <Link href={`/jobs/${job.slug}`} className="action-button is-secondary is-sm">
                        View
                      </Link>
                    </div>
                  </article>
                ))
              ) : (
                <div className="p-6">
                  <EmptyScaffold title="No jobs matched" description="No record found on the database" />
                </div>
              )}
            </div>
            <Pagination page={page} totalPages={Math.max(pagination.totalPages, 1)} onChange={handlePageChange} />
          </>
        )}
      </Panel>
    </div>
  );
}

export function JobDetailScreen({ slug }: { slug: string }) {
  const router = useRouter();
  const { can } = useAccessControl();
  const { toast } = useToast();
  const [job, setJob] = useState<JobApiRecord | null>(null);
  const [form, setForm] = useState({
    slug: "",
    title: "",
    description: "",
    location: "",
    status: "open",
    requiredExperienceYears: "0",
    budget: "",
    deadline: "",
    installationId: "",
    assignedTo: "",
  });
  const [applicants, setApplicants] = useState<JobApplicantRecord[]>([]);
  const [applicantQuery, setApplicantQuery] = useState("");
  const [reviewApplicant, setReviewApplicant] = useState<JobApplicantRecord | null>(null);
  const [reviewStatus, setReviewStatus] = useState("reviewed");
  const [reviewNotes, setReviewNotes] = useState("");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState(true);
  const [isSavingJob, setIsSavingJob] = useState(false);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(true);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicantError, setApplicantError] = useState<string | null>(null);
  const deferredApplicantQuery = useDeferredValue(applicantQuery);
  const canUpdateJobs = can("jobs", "update");
  const canDeleteJobs = can("jobs", "delete");
  const canReadInstallers = can("installers", "read");

  useEffect(() => {
    let cancelled = false;

    setIsLoadingJob(true);
    setError(null);

    getJobBySlug(slug)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        const detail = payload.data;
        setJob(detail);
        setForm({
          slug: detail.slug,
          title: detail.title,
          description: detail.description,
          location: detail.location,
          status: detail.status?.trim().toLowerCase() || "open",
          requiredExperienceYears: String(detail.required_experience_years ?? 0),
          budget: String(detail.budget ?? ""),
          deadline: detail.deadline ?? "",
          installationId: detail.installation_id ?? "",
          assignedTo: detail.assigned_to ?? "",
        });
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(loadError, "Job details could not be loaded."));
        setJob(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingJob(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!job?.id) {
      setApplicants([]);
      setIsLoadingApplicants(false);
      return;
    }

    let cancelled = false;

    setIsLoadingApplicants(true);
    setApplicantError(null);

    getJobApplicants(job.id)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setApplicants(payload.data);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setApplicantError(getErrorMessage(loadError, "Job applicants could not be loaded."));
        setApplicants([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingApplicants(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [job?.id]);

  const filteredApplicants = useMemo(
    () =>
      applicants.filter((applicant) =>
        `${applicant.installer_name} ${applicant.installer_email} ${applicant.status} ${applicant.proposal}`
          .toLowerCase()
          .includes(deferredApplicantQuery.toLowerCase()),
      ),
    [applicants, deferredApplicantQuery],
  );

  function openReviewModal(applicant: JobApplicantRecord) {
    setReviewApplicant(applicant);
    setReviewStatus(applicant.status?.trim().toLowerCase() || "reviewed");
    setReviewNotes(applicant.admin_notes ?? "");
    setIsReviewOpen(true);
  }

  function closeReviewModal() {
    if (isSavingReview) {
      return;
    }

    setIsReviewOpen(false);
    setReviewApplicant(null);
    setReviewStatus("reviewed");
    setReviewNotes("");
  }

  async function handleSaveJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!job) {
      return;
    }

    setIsSavingJob(true);

    try {
      await updateJob(job.id, {
        slug: form.slug.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        status: form.status,
        required_experience_years: Number(form.requiredExperienceYears) || 0,
        budget: Number(form.budget) || 0,
        deadline: form.deadline.trim(),
        installation_id: form.installationId.trim() || undefined,
        assigned_to: form.assignedTo.trim() || undefined,
      });

      const refreshed = await getJobBySlug(form.slug.trim() || slug);
      const nextJob = refreshed.data;
      setJob(nextJob);
      setForm({
        slug: nextJob.slug,
        title: nextJob.title,
        description: nextJob.description,
        location: nextJob.location,
        status: nextJob.status?.trim().toLowerCase() || "open",
        requiredExperienceYears: String(nextJob.required_experience_years ?? 0),
        budget: String(nextJob.budget ?? ""),
        deadline: nextJob.deadline ?? "",
        installationId: nextJob.installation_id ?? "",
        assignedTo: nextJob.assigned_to ?? "",
      });

      if (nextJob.slug !== slug) {
        router.replace(`/jobs/${nextJob.slug}`);
      }

      toast({
        title: "Job updated",
        description: `${nextJob.title} was updated successfully.`,
        variant: "success",
      });
    } catch (saveError) {
      if (isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: "Update failed",
        description: getErrorMessage(saveError, "The job could not be updated."),
        variant: "error",
      });
    } finally {
      setIsSavingJob(false);
    }
  }

  async function handleDeleteJob() {
    if (!job) {
      return;
    }

    try {
      await deleteJob(job.id);
      toast({
        title: "Job deleted",
        description: `${job.title} was removed successfully.`,
        variant: "success",
      });
      router.push("/jobs");
    } catch (deleteError) {
      if (isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The job could not be deleted."),
        variant: "error",
      });
    }
  }

  async function handleApplicantReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!job || !reviewApplicant) {
      return;
    }

    setIsSavingReview(true);

    try {
      await updateJobApplicant(job.id, reviewApplicant.id, {
        status: reviewStatus,
        admin_notes: reviewNotes.trim(),
      });

      const refreshed = await getJobApplicants(job.id);
      setApplicants(refreshed.data);
      toast({
        title: "Applicant updated",
        description: `${reviewApplicant.installer_name} was updated successfully.`,
        variant: "success",
      });
      closeReviewModal();
    } catch (saveError) {
      if (isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: "Applicant update failed",
        description: getErrorMessage(saveError, "The applicant could not be updated."),
        variant: "error",
      });
    } finally {
      setIsSavingReview(false);
    }
  }

  if (!job && !isLoadingJob) {
    return (
      <Panel className="p-6">
        <ErrorMessage title="Job load failed" message={error} />
        <EmptyScaffold title="No job found" description="No record found on the database" />
      </Panel>
    );
  }

  return (
    <>
      <div className="dashboard-stack">
        <Panel className="job-detail-hero">
          <div className="job-detail-hero__main">
            <ManagementBackLink href="/jobs" label={job?.title || "Loading job..."} meta={job ? `Created ${formatDateLabel(job.created_at)}` : undefined} />
            {job ? <StatusPill label={formatEnumLabel(job.status)} tone={toneFromStatus(job.status)} solid={false} /> : null}
            <h2>{job?.title || "Loading job..."}</h2>
            <div className="job-location-box">
              <strong>{job?.location || "N/A"}</strong>
              <span>{job?.deadline ? `Deadline ${formatDateTimeLabel(job.deadline)}` : "No deadline provided"}</span>
            </div>
            <p>{job?.description || "Loading job details..."}</p>
          </div>
          <div className="job-detail-hero__meta">
            <div className="job-meta-row">
              <span>Total Applications</span>
              <strong>{applicants.length}</strong>
            </div>
            <div className="job-meta-row">
              <span>Budget</span>
              <strong>{job ? formatCurrencyLabel(job.budget) : "N/A"}</strong>
            </div>
            <div className="job-meta-band is-blue">
              <span>Experience</span>
              <strong>{job ? `${job.required_experience_years} years` : "N/A"}</strong>
            </div>
            <div className="job-meta-band is-green">
              <span>Status</span>
              <strong>{job ? formatEnumLabel(job.status) : "N/A"}</strong>
            </div>
            <div className="job-meta-band">
              <span>Slug</span>
              <strong>{job?.slug || "N/A"}</strong>
            </div>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 pb-4 pt-6">
            <div>
              <h3 className="m-0 text-sm font-bold sm:text-[15px]">Applicants</h3>
              <p className="mt-2 text-sm text-[var(--text-soft)]">Review proposals, update applicant decisions, and assign installers from the live job applicants endpoint.</p>
            </div>
            {job && canDeleteJobs ? (
              <Button variant="danger" size="sm" leadingIcon={<TrashIcon className="mini-icon" />} onClick={() => void handleDeleteJob()}>
                Delete Job
              </Button>
            ) : null}
          </div>

          <ErrorMessage title="Job load failed" message={error} />
          <ErrorMessage title="Applicant load failed" message={applicantError} />

          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
            <div className="border-b border-[var(--border)] xl:border-b-0 xl:border-r">
              <div className="management-surface__body">
                <DirectoryToolbar
                  searchValue={applicantQuery}
                  onSearchChange={setApplicantQuery}
                  searchPlaceholder="Search applicants..."
                  filters={
                    <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                      Filter
                    </Button>
                  }
                />
              </div>

              {isLoadingApplicants && !applicants.length ? (
                <div className="p-6">
                  <p className="section-description">Loading applicants...</p>
                </div>
              ) : (
                <div className="table-scroll pt-2">
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Installer</th>
                        <th>Status</th>
                        <th>Proposal</th>
                        <th>Proposed Budget</th>
                        <th>Submitted</th>
                        <th>Admin Notes</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApplicants.length ? (
                        filteredApplicants.map((applicant) => (
                          <tr key={applicant.id}>
                            <td>
                              <div className="product-cell__text">
                                <strong>{applicant.installer_name}</strong>
                                <span>{applicant.installer_email}</span>
                                <span>{applicant.installer_id}</span>
                              </div>
                            </td>
                            <td>
                              <StatusPill label={formatEnumLabel(applicant.status)} tone={toneFromStatus(applicant.status)} solid={false} />
                            </td>
                            <td>{applicant.proposal || "No proposal provided."}</td>
                            <td>{applicant.proposed_budget ? formatCurrencyLabel(applicant.proposed_budget) : "N/A"}</td>
                            <td>{formatDateTimeLabel(applicant.created_at)}</td>
                            <td>{applicant.admin_notes || "No admin notes"}</td>
                            <td>
                              <TableActionsMenu
                                items={[
                                  ...(canUpdateJobs
                                    ? [
                                        {
                                          label: "Review Application",
                                          onSelect: () => openReviewModal(applicant),
                                        },
                                      ]
                                    : []),
                                  ...(canReadInstallers
                                    ? [
                                        {
                                          label: "View Profile",
                                          href: `/users/installers/${applicant.installer_user_id}`,
                                        },
                                      ]
                                    : []),
                                ]}
                              />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7}>
                            <div className="p-6">
                              <EmptyScaffold title="No applicants found" description="No installer applications were returned for this job" />
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-6">
              <h3 className="m-0 text-sm font-bold sm:text-[15px]">Update Job</h3>
              <form className="mt-5 flex flex-col gap-4" onSubmit={handleSaveJob}>
                <FormField label="Slug">
                  <TextField value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="job-slug" />
                </FormField>
                <FormField label="Title">
                  <TextField value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Job title" />
                </FormField>
                <FormField label="Location">
                  <TextField value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Lagos" />
                </FormField>
                <FormField label="Status">
                  <SelectField value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={buildStatusOptions(form.status)} />
                </FormField>
                <div className="product-inline-row is-two">
                  <FormField label="Required Experience (Years)">
                    <TextField value={form.requiredExperienceYears} onChange={(event) => setForm((current) => ({ ...current, requiredExperienceYears: event.target.value }))} placeholder="3" />
                  </FormField>
                  <FormField label="Budget">
                    <TextField value={form.budget} onChange={(event) => setForm((current) => ({ ...current, budget: event.target.value }))} placeholder="250000" />
                  </FormField>
                </div>
                <FormField label="Deadline">
                  <TextField value={form.deadline} onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))} placeholder="2026-05-05T19:07:37.714Z" />
                </FormField>
                <FormField label="Installation ID">
                  <TextField value={form.installationId} onChange={(event) => setForm((current) => ({ ...current, installationId: event.target.value }))} placeholder="Optional installation UUID" />
                </FormField>
                <FormField label="Assigned To">
                  <TextField value={form.assignedTo} onChange={(event) => setForm((current) => ({ ...current, assignedTo: event.target.value }))} placeholder="Optional installer UUID" />
                </FormField>
                <FormField label="Description">
                  <TextAreaField value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} rows={6} placeholder="Job description" />
                </FormField>
                <Button type="submit" variant="primary" disabled={isLoadingJob || isSavingJob || !job || !canUpdateJobs}>
                  {isSavingJob ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </div>
          </div>
        </Panel>
      </div>

      <Modal
        open={isReviewOpen}
        onClose={closeReviewModal}
        title={reviewApplicant ? `Review ${reviewApplicant.installer_name}` : "Review Applicant"}
        footer={
          <ModalFooterActions
            formId={applicantReviewFormId}
            cancelLabel="Cancel"
            submitLabel={isSavingReview ? "Saving..." : "Save Review"}
            onCancel={closeReviewModal}
            disabled={isSavingReview}
          />
        }
      >
        <form id={applicantReviewFormId} className="notification-wizard" onSubmit={handleApplicantReviewSubmit}>
          <div className="notification-wizard__heading">
            <span>Update the application decision and leave notes for this installer.</span>
          </div>
          <FormField label="Status">
            <ModalSelect value={reviewStatus} onChange={setReviewStatus} options={buildApplicantStatusOptions(reviewStatus)} />
          </FormField>
          <FormField label="Admin Notes">
            <ModalTextArea value={reviewNotes} onChange={setReviewNotes} placeholder="Review notes for this applicant" />
          </FormField>
        </form>
      </Modal>
    </>
  );
}

export function JobFormScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("open");
  const [requiredExperienceYears, setRequiredExperienceYears] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [installationId, setInstallationId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await createJob({
        slug: slug.trim(),
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        status,
        required_experience_years: Number(requiredExperienceYears) || 0,
        budget: Number(budget) || 0,
        deadline: deadline.trim(),
        installation_id: installationId.trim(),
        assigned_to: assignedTo.trim(),
      });

      router.push("/jobs?created=1");
    } catch (saveError) {
      if (isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: "Create job failed",
        description: getErrorMessage(saveError, "The job could not be created."),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dashboard-stack">
      <Panel className="product-form-shell">
        <form id={jobFormId} onSubmit={handleSubmit}>
          <div className="product-form-shell__header">
            <div>
              <h2 className="section-title">Add A New Job</h2>
              <p className="section-description">Post installation jobs through the admin jobs endpoint.</p>
            </div>
            <FormSubmitter formId={jobFormId} cancelLabel="Cancel" onCancel={() => router.push("/jobs")} primaryLabel={isSubmitting ? "Saving..." : "Finish"} disabled={isSubmitting} />
          </div>
          <div className="product-form-grid">
            <DetailPanel title="Job Information" description="Core job metadata, assignment details, and publishing status.">
              <div className="detail-panel__stack">
                <FormField label="Slug">
                  <TextField value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="3kva-solar-inverter-aa1-installation" />
                </FormField>
                <FormField label="Title">
                  <TextField value={title} onChange={(event) => setTitle(event.target.value)} placeholder="3kVA Solar/Inverter AA1 Installation" />
                </FormField>
                <div className="product-inline-row is-two">
                  <FormField label="Location">
                    <TextField value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Port Harcourt" />
                  </FormField>
                  <FormField label="Status">
                    <SelectField value={status} onChange={setStatus} options={jobStatusOptions.map((option) => ({ label: option.label, value: option.value }))} />
                  </FormField>
                </div>
                <div className="product-inline-row is-two">
                  <FormField label="Required Experience (Years)">
                    <TextField value={requiredExperienceYears} onChange={(event) => setRequiredExperienceYears(event.target.value)} placeholder="3" />
                  </FormField>
                  <FormField label="Budget">
                    <TextField value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="250000" />
                  </FormField>
                </div>
                <FormField label="Deadline">
                  <TextField value={deadline} onChange={(event) => setDeadline(event.target.value)} placeholder="2026-05-05T19:07:37.714Z" />
                </FormField>
              </div>
            </DetailPanel>

            <DetailPanel title="Assignment" description="Optional installation and installer references for the job posting.">
              <div className="detail-panel__stack">
                <FormField label="Installation ID">
                  <TextField value={installationId} onChange={(event) => setInstallationId(event.target.value)} placeholder="Installation UUID" />
                </FormField>
                <FormField label="Assigned To">
                  <TextField value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="Installer UUID" />
                </FormField>
              </div>
            </DetailPanel>

            <DetailPanel title="Description" description="Describe the work scope installers should see when applying.">
              <div className="detail-panel__stack">
                <FormField label="Job Description">
                  <TextAreaField value={description} onChange={setDescription} rows={8} placeholder="Describe the job scope, context, and expectations" />
                </FormField>
              </div>
            </DetailPanel>
          </div>
        </form>
      </Panel>
    </div>
  );
}
