"use client";

import Link from "next/link";
import { type Dispatch, type FormEvent, type SetStateAction, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { EyeIcon, FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { ActionLink, DetailPanel, DirectoryToolbar, InlineCallout, ManagementBackLink } from "@/components/dashboard/management-primitives";
import { FormField, Modal, ModalFooterActions, ModalSelect, ModalTextArea } from "@/components/dashboard/modals";
import { FormSubmitter } from "@/components/dashboard/form-submitter";
import { Button, EmptyScaffold, MetricCardSecondary, Pagination, Panel, SelectField, StatusPill, TableActionsMenu, Tabs, TextAreaField, TextField } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import {
  createJob,
  DEFAULT_PAGE_SIZE,
  deleteJob,
  formatCurrencyLabel,
  formatDateLabel,
  formatDateTimeLabel,
  formatEnumLabel,
  getBundleRequests,
  getCustomers,
  getInstallers,
  getJobApplicants,
  getJobBySlug,
  getJobs,
  updateBundleRequest,
  updateJob,
  updateJobApplicant,
} from "@/lib/admin-api";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type {
  BundleRequestRecord,
  CustomerRecord,
  InstallerRecord,
  JobApiRecord,
  JobApplicantRecord,
  PaginationMeta,
} from "@/types/api.types";

const jobStatusTabs = ["All", "Open", "Assigned", "In Progress", "Completed", "Verified", "Closed", "Cancelled"] as const;
const jobStatusOptions = [
  { label: "Open", value: "open" },
  { label: "Assigned", value: "assigned" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Verified", value: "verified" },
  { label: "Closed", value: "closed" },
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
type JobFormState = {
  slug: string;
  title: string;
  description: string;
  status: string;
  requiredExperienceYears: string;
  budget: string;
  scheduledDate: string;
  packageRequestId: string;
  assignedTo: string;
  customerUserId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  systemSizeKw: string;
  notes: string;
};
type JobValidationErrors = Partial<Record<
  | "title"
  | "description"
  | "scheduledDate"
  | "customerName"
  | "city"
  | "state"
  | "country"
  | "systemSizeKw",
  string
>>;

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

const emptyJobForm: JobFormState = {
  slug: "",
  title: "",
  description: "",
  status: "open",
  requiredExperienceYears: "",
  budget: "",
  scheduledDate: "",
  packageRequestId: "",
  assignedTo: "",
  customerUserId: "",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  address: "",
  city: "",
  state: "",
  country: "Nigeria",
  systemSizeKw: "",
  notes: "",
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
    case "Closed":
      return normalized === "closed";
    case "Cancelled":
      return normalized === "cancelled" || normalized === "canceled";
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

function withSelectedOption(options: Array<{ label: string; value: string }>, value: string, fallbackLabel: string) {
  if (!value || options.some((option) => option.value === value)) {
    return options;
  }

  return [{ value, label: fallbackLabel }, ...options];
}

function formatInstallerOption(installer: InstallerRecord) {
  const name = installer.user.fullName || installer.user.name || installer.user.email;
  const company = installer.installerProfile.companyName ? ` • ${installer.installerProfile.companyName}` : "";
  return `${name} (${installer.user.email})${company}`;
}

function formatCustomerOption(customer: CustomerRecord) {
  const name = customer.fullName || customer.name || customer.email;
  return `${name} (${customer.email})`;
}

function formatPackageRequestOption(request: BundleRequestRecord) {
  const customer = request.customer_name || request.customer_email || "Unknown customer";
  const location = [request.city, request.state].filter(Boolean).join(", ");
  return [request.bundle_name, customer, location, formatEnumLabel(request.status)].filter(Boolean).join(" • ");
}

function locationLabel(job: Pick<JobApiRecord, "address" | "city" | "state" | "country" | "location">) {
  return [job.address, job.city, job.state, job.country].filter(Boolean).join(", ") || job.location || "N/A";
}

function formLocationLabel(form: JobFormState) {
  return [form.address, form.city, form.state, form.country].filter(Boolean).join(", ");
}

function jobScheduleValue(job: JobApiRecord) {
  return job.scheduled_date || job.deadline || null;
}

function jobTagItems(job: JobApiRecord) {
  return [
    job.package_request_name || "No package request linked",
    `${job.required_experience_years} yrs exp`,
    jobScheduleValue(job) ? `Schedule ${formatDateTimeLabel(jobScheduleValue(job))}` : "No schedule",
  ];
}

function prefillFromPackageRequest(current: JobFormState, request: BundleRequestRecord) {
  return {
    ...current,
    packageRequestId: request.id,
    title: current.title || `${request.bundle_name} Installation`,
    description: current.description || "Installation delivery for the linked package request.",
    customerUserId: current.customerUserId || request.customer_user_id || "",
    customerName: request.customer_name || current.customerName,
    customerEmail: request.customer_email || current.customerEmail,
    customerPhone: request.customer_phone || current.customerPhone,
    address: request.address || current.address,
    city: request.city || current.city,
    state: request.state || current.state,
    country: request.country || current.country || "Nigeria",
    systemSizeKw: request.system_size_kw ? String(request.system_size_kw) : current.systemSizeKw,
  };
}

function prefillFromCustomer(current: JobFormState, customer: CustomerRecord) {
  return {
    ...current,
    customerUserId: customer.id,
    customerName: customer.fullName || customer.name || current.customerName,
    customerEmail: customer.email || current.customerEmail,
    customerPhone: customer.phone || current.customerPhone,
  };
}

function mapJobStatusToPackageStatus(status: string, currentStatus?: string | null) {
  const normalized = status.trim().toLowerCase();

  switch (normalized) {
    case "assigned":
      return "installer_assigned";
    case "in_progress":
    case "in progress":
      return "installer_in_transit";
    case "completed":
      return "system_installed";
    case "verified":
      return "installation_verified";
    case "closed":
      return "closed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "open":
      return currentStatus?.trim().toLowerCase() || null;
    default:
      return currentStatus?.trim().toLowerCase() || null;
  }
}

function jobFormFromRecord(job: JobApiRecord): JobFormState {
  return {
    slug: job.slug || "",
    title: job.title || "",
    description: job.description || "",
    status: job.status?.trim().toLowerCase() || "open",
    requiredExperienceYears: String(job.required_experience_years ?? 0),
    budget: String(job.budget ?? ""),
    scheduledDate: (job.scheduled_date || job.deadline || "").slice(0, 16),
    packageRequestId: job.package_request_id || "",
    assignedTo: job.assigned_to || "",
    customerUserId: job.customer_user_id || "",
    customerName: job.customer_name || "",
    customerEmail: job.customer_email || "",
    customerPhone: job.customer_phone || "",
    address: job.address || "",
    city: job.city || "",
    state: job.state || "",
    country: job.country || "Nigeria",
    systemSizeKw: job.system_size_kw ? String(job.system_size_kw) : "",
    notes: job.notes || "",
  };
}

function validateJobForm(form: JobFormState) {
  const errors: JobValidationErrors = {};

  if (!form.title.trim()) {
    errors.title = "Enter the job title.";
  }

  if (!form.description.trim()) {
    errors.description = "Enter the job description.";
  }

  if (!form.scheduledDate.trim()) {
    errors.scheduledDate = "Select the scheduled date and time.";
  }

  if (!form.customerName.trim()) {
    errors.customerName = "Add the customer name or select a customer.";
  }

  if (!form.city.trim()) {
    errors.city = "Enter the city.";
  }

  if (!form.state.trim()) {
    errors.state = "Enter the state.";
  }

  if (!form.country.trim()) {
    errors.country = "Enter the country.";
  }

  if (!form.systemSizeKw.trim()) {
    errors.systemSizeKw = "Enter the system size.";
  }

  return errors;
}

function buildJobPayload(form: JobFormState, selectedPackageRequest: BundleRequestRecord | null) {
  const slug = slugify(form.slug || form.title || selectedPackageRequest?.bundle_name || "job");

  return {
    slug,
    title: form.title.trim(),
    description: form.description.trim(),
    status: form.status,
    required_experience_years: Number(form.requiredExperienceYears) || 0,
    budget: Number(form.budget) || 0,
    scheduled_date: form.scheduledDate.trim(),
    deadline: form.scheduledDate.trim(),
    location: formLocationLabel(form),
    package_request_id: form.packageRequestId.trim() || undefined,
    package_request_name: selectedPackageRequest?.bundle_name || undefined,
    package_request_status: selectedPackageRequest?.status || undefined,
    assigned_to: form.assignedTo.trim() || undefined,
    customer_user_id: form.customerUserId.trim() || undefined,
    customer_name: form.customerName.trim() || undefined,
    customer_email: form.customerEmail.trim() || undefined,
    customer_phone: form.customerPhone.trim() || undefined,
    address: form.address.trim() || undefined,
    city: form.city.trim() || undefined,
    state: form.state.trim() || undefined,
    country: form.country.trim() || undefined,
    system_size_kw: Number(form.systemSizeKw) || 0,
    notes: form.notes.trim() || undefined,
  };
}

function useJobReferenceOptions() {
  const [packageRequests, setPackageRequests] = useState<BundleRequestRecord[]>([]);
  const [installers, setInstallers] = useState<InstallerRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      getBundleRequests({
        page: 1,
        limit: 100,
        fields: [
          "id",
          "bundle_name",
          "status",
          "customer_user_id",
          "customer_name",
          "customer_email",
          "customer_phone",
          "address",
          "city",
          "state",
          "country",
          "system_size_kw",
          "job_id",
          "job_slug",
          "job_status",
        ],
      }),
      getInstallers({ page: 1, limit: 100 }),
      getCustomers({ page: 1, limit: 100, fields: ["id", "name", "fullName", "email", "phone"] }),
    ])
      .then(([packageRequestsResult, installersResult, customersResult]) => {
        if (cancelled) {
          return;
        }

        const errors: string[] = [];

        if (packageRequestsResult.status === "fulfilled") {
          setPackageRequests(packageRequestsResult.value.data);
        } else if (!isDashboardSessionExpiredError(packageRequestsResult.reason)) {
          errors.push(getErrorMessage(packageRequestsResult.reason, "Package requests could not be loaded."));
        }

        if (installersResult.status === "fulfilled") {
          setInstallers(installersResult.value.data);
        } else if (!isDashboardSessionExpiredError(installersResult.reason)) {
          errors.push(getErrorMessage(installersResult.reason, "Installers could not be loaded."));
        }

        if (customersResult.status === "fulfilled") {
          setCustomers(customersResult.value.data);
        } else if (!isDashboardSessionExpiredError(customersResult.reason)) {
          errors.push(getErrorMessage(customersResult.reason, "Customers could not be loaded."));
        }

        setError(errors[0] ?? null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { packageRequests, installers, customers, isLoading, error };
}

function JobEditor({
  form,
  setForm,
  errors,
  clearFieldError,
  packageRequestOptions,
  customerOptions,
  installerOptions,
  isLoadingReferences,
  referenceError,
  onPackageRequestChange,
  onCustomerChange,
}: {
  form: JobFormState;
  setForm: Dispatch<SetStateAction<JobFormState>>;
  errors: JobValidationErrors;
  clearFieldError: (field: keyof JobValidationErrors) => void;
  packageRequestOptions: Array<{ label: string; value: string }>;
  customerOptions: Array<{ label: string; value: string }>;
  installerOptions: Array<{ label: string; value: string }>;
  isLoadingReferences: boolean;
  referenceError: string | null;
  onPackageRequestChange: (value: string) => void;
  onCustomerChange: (value: string) => void;
}) {
  return (
    <div className="job-editor-grid">
      <DetailPanel title="Job Information" description="Link the job to a packed package request, then confirm the installer and schedule.">
        <div className="detail-panel__stack">
          <FormField label="Package Request" hint={isLoadingReferences ? "Loading package requests..." : referenceError || "Only packed package requests are selectable for new jobs."}>
            <SelectField
              value={form.packageRequestId}
              onChange={onPackageRequestChange}
              options={packageRequestOptions}
              placeholder="Select package request"
              disabled={isLoadingReferences}
            />
          </FormField>

          <FormField label="Customer" hint={isLoadingReferences ? "Loading customers..." : "Select a customer if you want to prefill customer contact details manually."}>
            <SelectField
              value={form.customerUserId}
              onChange={onCustomerChange}
              options={customerOptions}
              placeholder="Select customer"
              disabled={isLoadingReferences}
            />
          </FormField>

          <FormField label="Slug">
            <TextField value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="business-solar-package-lagos-installation" />
          </FormField>

          <FormField label="Job Title" error={errors.title}>
            <TextField
              value={form.title}
              onChange={(event) => {
                setForm((current) => ({ ...current, title: event.target.value }));
                clearFieldError("title");
              }}
              placeholder="Business Solar Package Installation"
              invalid={Boolean(errors.title)}
            />
          </FormField>

          <div className="product-inline-row is-two">
            <FormField label="Status">
              <SelectField value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={buildStatusOptions(form.status)} />
            </FormField>
            <FormField label="Assigned Installer" hint={isLoadingReferences ? "Loading installers..." : "Leave blank to keep the job open."}>
              <SelectField
                value={form.assignedTo}
                onChange={(value) => setForm((current) => ({ ...current, assignedTo: value }))}
                options={installerOptions}
                placeholder="Select installer"
                disabled={isLoadingReferences}
              />
            </FormField>
          </div>

          <div className="product-inline-row is-two">
            <FormField label="Scheduled Date & Time" error={errors.scheduledDate}>
              <TextField
                value={form.scheduledDate}
                onChange={(event) => {
                  setForm((current) => ({ ...current, scheduledDate: event.target.value }));
                  clearFieldError("scheduledDate");
                }}
                placeholder="2026-06-02T09:30"
                type="datetime-local"
                invalid={Boolean(errors.scheduledDate)}
              />
            </FormField>
            <FormField label="System Size (kW)" error={errors.systemSizeKw}>
              <TextField
                value={form.systemSizeKw}
                onChange={(event) => {
                  setForm((current) => ({ ...current, systemSizeKw: event.target.value }));
                  clearFieldError("systemSizeKw");
                }}
                placeholder="10"
                invalid={Boolean(errors.systemSizeKw)}
              />
            </FormField>
          </div>

          <div className="product-inline-row is-two">
            <FormField label="Required Experience (Years)">
              <TextField
                value={form.requiredExperienceYears}
                onChange={(event) => setForm((current) => ({ ...current, requiredExperienceYears: event.target.value }))}
                placeholder="3"
              />
            </FormField>
            <FormField label="Budget">
              <TextField value={form.budget} onChange={(event) => setForm((current) => ({ ...current, budget: event.target.value }))} placeholder="250000" />
            </FormField>
          </div>
        </div>
      </DetailPanel>

      <DetailPanel title="Customer & Location" description="Package request selection prefills these values. If no package is linked, complete them manually.">
        <div className="detail-panel__stack">
          <FormField label="Customer Name" error={errors.customerName}>
            <TextField
              value={form.customerName}
              onChange={(event) => {
                setForm((current) => ({ ...current, customerName: event.target.value }));
                clearFieldError("customerName");
              }}
              placeholder="Amina Yusuf"
              invalid={Boolean(errors.customerName)}
            />
          </FormField>

          <div className="product-inline-row is-two">
            <FormField label="Customer Email">
              <TextField value={form.customerEmail} onChange={(event) => setForm((current) => ({ ...current, customerEmail: event.target.value }))} placeholder="amina@example.com" type="email" />
            </FormField>
            <FormField label="Customer Phone">
              <TextField value={form.customerPhone} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} placeholder="+2348012345678" />
            </FormField>
          </div>

          <FormField label="Address">
            <TextAreaField value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} placeholder="Lekki Phase 1" rows={4} />
          </FormField>

          <div className="product-inline-row is-three">
            <FormField label="City" error={errors.city}>
              <TextField
                value={form.city}
                onChange={(event) => {
                  setForm((current) => ({ ...current, city: event.target.value }));
                  clearFieldError("city");
                }}
                placeholder="Lagos"
                invalid={Boolean(errors.city)}
              />
            </FormField>
            <FormField label="State" error={errors.state}>
              <TextField
                value={form.state}
                onChange={(event) => {
                  setForm((current) => ({ ...current, state: event.target.value }));
                  clearFieldError("state");
                }}
                placeholder="Lagos"
                invalid={Boolean(errors.state)}
              />
            </FormField>
            <FormField label="Country" error={errors.country}>
              <TextField
                value={form.country}
                onChange={(event) => {
                  setForm((current) => ({ ...current, country: event.target.value }));
                  clearFieldError("country");
                }}
                placeholder="Nigeria"
                invalid={Boolean(errors.country)}
              />
            </FormField>
          </div>
        </div>
      </DetailPanel>

      <DetailPanel title="Description" description="Describe the scope clearly for the installer. Package-linked jobs can still be adjusted before publishing.">
        <div className="detail-panel__stack">
          <FormField label="Job Description" error={errors.description}>
            <TextAreaField
              value={form.description}
              onChange={(value) => {
                setForm((current) => ({ ...current, description: value }));
                clearFieldError("description");
              }}
              rows={8}
              placeholder="Describe the work scope, context, and expectations."
              invalid={Boolean(errors.description)}
            />
          </FormField>

          <FormField label="Internal Notes">
            <TextAreaField value={form.notes} onChange={(value) => setForm((current) => ({ ...current, notes: value }))} rows={6} placeholder="Any internal note for the ops team." />
          </FormField>

          <InlineCallout>
            Compatibility fields are still sent alongside the new package-request payload: `deadline` mirrors the scheduled date and `location` is derived from address, city, state, and country.
          </InlineCallout>
        </div>
      </DetailPanel>
    </div>
  );
}

async function syncPackageRequestFromJob(jobStatus: string, packageRequestId: string, packageRequests: BundleRequestRecord[]) {
  const request = packageRequests.find((item) => item.id === packageRequestId);

  if (!request) {
    return;
  }

  const nextStatus = mapJobStatusToPackageStatus(jobStatus, request.status);

  if (!nextStatus || nextStatus === request.status) {
    return;
  }

  await updateBundleRequest(request.id, {
    status: nextStatus,
    admin_note: request.admin_note ?? "",
  });
}

export function JobsManagementScreen() {
  const { can } = useAccessControl();
  const { toast } = useToast();
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
        "status",
        "budget",
        "deadline",
        "scheduled_date",
        "created_at",
        "required_experience_years",
        "package_request_id",
        "package_request_name",
        "customer_name",
        "address",
        "city",
        "state",
        "country",
        "system_size_kw",
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
  const inProgressCount = rows.filter((job) => matchesJobStatus(job.status, "In Progress")).length;
  const verifiedCount = rows.filter((job) => matchesJobStatus(job.status, "Verified")).length;

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
      if (isDashboardActionCancelledError(deleteError) || isDashboardSessionExpiredError(deleteError)) {
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
        <MetricCardSecondary title="Total Jobs" value={pagination.total.toLocaleString()} icon="products" spark={[12, 18, 22, 28, 34, 40]} />
        <MetricCardSecondary title="Open On This Page" value={openCount.toLocaleString()} icon="calendar" spark={[14, 18, 24, 28, 32, 38]} />
        <MetricCardSecondary title="Assigned On This Page" value={assignedCount.toLocaleString()} icon="verification" spark={[10, 16, 22, 28, 34, 40]} />
        <MetricCardSecondary title="In Progress / Verified" value={`${inProgressCount.toLocaleString()} / ${verifiedCount.toLocaleString()}`} icon="sales" spark={[8, 14, 18, 26, 32, 40]} />
      </section>

      <Panel className="overflow-hidden">
        <div className="management-surface__body">
          <div className="section-header content-section-header">
            <div>
              <h2 className="section-title">Job Board</h2>
              <p className="section-description">Create operational jobs from package requests and keep their delivery statuses aligned while the backend sync is being finalized.</p>
            </div>
            {canCreateJobs ? (
              <ActionLink href="/jobs/new" leadingIcon={<PlusIcon className="mini-icon" />}>
                Add Job
              </ActionLink>
            ) : null}
          </div>

          <DirectoryToolbar
            searchValue={query}
            onSearchChange={(value) => {
              setIsLoading(true);
              setError(null);
              setPage(1);
              setQuery(value);
            }}
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
                    <div className="tag-list">
                      {jobTagItems(job).map((item) => (
                        <span key={`${job.id}-${item}`} className="tag-list__item">
                          {item}
                        </span>
                      ))}
                    </div>
                    <div className="job-card__footer">
                      <strong>{formatCurrencyLabel(job.budget)}</strong>
                      <span>{locationLabel(job)}</span>
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
            <Pagination
              page={page}
              totalPages={Math.max(pagination.totalPages, 1)}
              onChange={(nextPage) => {
                setIsLoading(true);
                setError(null);
                setPage(nextPage);
              }}
            />
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
  const { packageRequests, installers, customers, isLoading: isLoadingReferences, error: referenceError } = useJobReferenceOptions();
  const [job, setJob] = useState<JobApiRecord | null>(null);
  const [form, setForm] = useState<JobFormState>(emptyJobForm);
  const [errors, setErrors] = useState<JobValidationErrors>({});
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
        setForm(jobFormFromRecord(detail));
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
  const selectedPackageRequest = useMemo(
    () => packageRequests.find((request) => request.id === form.packageRequestId) ?? null,
    [form.packageRequestId, packageRequests],
  );
  const packageRequestOptions = useMemo(
    () =>
      withSelectedOption(
        [
          { value: "", label: "No package request linked" },
          ...packageRequests
            .filter((request) => request.status.toLowerCase() === "packed" || request.id === form.packageRequestId)
            .map((request) => ({
              value: request.id,
              label: formatPackageRequestOption(request),
            })),
        ],
        form.packageRequestId,
        `Selected package request (${form.packageRequestId})`,
      ),
    [form.packageRequestId, packageRequests],
  );
  const customerOptions = useMemo(
    () =>
      withSelectedOption(
        [
          { value: "", label: "No customer selected" },
          ...customers.map((customer) => ({
            value: customer.id,
            label: formatCustomerOption(customer),
          })),
        ],
        form.customerUserId,
        `Selected customer (${form.customerUserId})`,
      ),
    [customers, form.customerUserId],
  );
  const installerOptions = useMemo(
    () =>
      withSelectedOption(
        [
          { value: "", label: "No installer assigned" },
          ...installers.map((installer) => ({
            value: installer.user.id,
            label: formatInstallerOption(installer),
          })),
        ],
        form.assignedTo,
        `Selected installer (${form.assignedTo})`,
      ),
    [form.assignedTo, installers],
  );

  function clearFieldError(field: keyof JobValidationErrors) {
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handlePackageRequestChange(value: string) {
    if (!value) {
      setForm((current) => ({ ...current, packageRequestId: "" }));
      return;
    }

    const request = packageRequests.find((item) => item.id === value);

    if (!request) {
      setForm((current) => ({ ...current, packageRequestId: value }));
      return;
    }

    setForm((current) => prefillFromPackageRequest(current, request));
  }

  function handleCustomerChange(value: string) {
    if (!value) {
      setForm((current) => ({ ...current, customerUserId: "" }));
      return;
    }

    const customer = customers.find((item) => item.id === value);

    if (!customer) {
      setForm((current) => ({ ...current, customerUserId: value }));
      return;
    }

    setForm((current) => prefillFromCustomer(current, customer));
  }

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

    const nextErrors = validateJobForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    setIsSavingJob(true);

    try {
      const payload = buildJobPayload(form, selectedPackageRequest);
      await updateJob(job.id, payload);

      if (form.packageRequestId) {
        await syncPackageRequestFromJob(form.status, form.packageRequestId, packageRequests);
      }

      const refreshed = await getJobBySlug(payload.slug);
      const nextJob = refreshed.data;
      setJob(nextJob);
      setForm(jobFormFromRecord(nextJob));

      if (nextJob.slug !== slug) {
        router.replace(`/jobs/${nextJob.slug}`);
      }

      toast({
        title: "Job updated",
        description: `${nextJob.title} was updated successfully.`,
        variant: "success",
      });
    } catch (saveError) {
      if (isDashboardActionCancelledError(saveError) || isDashboardSessionExpiredError(saveError)) {
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
      if (isDashboardActionCancelledError(deleteError) || isDashboardSessionExpiredError(deleteError)) {
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
      if (isDashboardActionCancelledError(saveError) || isDashboardSessionExpiredError(saveError)) {
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
              <strong>{job ? locationLabel(job) : "N/A"}</strong>
              <span>{job && jobScheduleValue(job) ? `Scheduled ${formatDateTimeLabel(jobScheduleValue(job))}` : "No schedule provided"}</span>
            </div>
            <p>{job?.description || "Loading job details..."}</p>
          </div>
          <div className="job-detail-hero__meta">
            <div className="job-meta-row">
              <span>Linked Package Request</span>
              <strong>{job?.package_request_name || "None"}</strong>
            </div>
            <div className="job-meta-row">
              <span>Customer</span>
              <strong>{job?.customer_name || "N/A"}</strong>
            </div>
            <div className="job-meta-band is-blue">
              <span>Budget</span>
              <strong>{job ? formatCurrencyLabel(job.budget) : "N/A"}</strong>
            </div>
            <div className="job-meta-band is-green">
              <span>System Size</span>
              <strong>{job?.system_size_kw ? `${job.system_size_kw} kW` : "N/A"}</strong>
            </div>
            <div className="job-meta-band">
              <span>Status</span>
              <strong>{job ? formatEnumLabel(job.status) : "N/A"}</strong>
            </div>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 pb-4 pt-6">
            <div>
              <h3 className="m-0 text-sm font-bold sm:text-[15px]">Applicants</h3>
              <p className="mt-2 text-sm text-[var(--text-soft)]">Review proposals, update applicant decisions, and keep the assigned installer aligned with the active package request.</p>
            </div>
            {job && canDeleteJobs ? (
              <Button variant="danger" size="sm" leadingIcon={<TrashIcon className="mini-icon" />} onClick={() => void handleDeleteJob()}>
                Delete Job
              </Button>
            ) : null}
          </div>

          <ErrorMessage title="Job load failed" message={error} />
          <ErrorMessage title="Applicant load failed" message={applicantError} />

          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
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
                <JobEditor
                  form={form}
                  setForm={setForm}
                  errors={errors}
                  clearFieldError={clearFieldError}
                  packageRequestOptions={packageRequestOptions}
                  customerOptions={customerOptions}
                  installerOptions={installerOptions}
                  isLoadingReferences={isLoadingReferences}
                  referenceError={referenceError}
                  onPackageRequestChange={handlePackageRequestChange}
                  onCustomerChange={handleCustomerChange}
                />
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
  const { packageRequests, installers, customers, isLoading: isLoadingReferences, error: referenceError } = useJobReferenceOptions();
  const [form, setForm] = useState<JobFormState>(emptyJobForm);
  const [errors, setErrors] = useState<JobValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedPackageRequest = useMemo(
    () => packageRequests.find((request) => request.id === form.packageRequestId) ?? null,
    [form.packageRequestId, packageRequests],
  );
  const packageRequestOptions = useMemo(
    () =>
      withSelectedOption(
        [
          { value: "", label: "No package request linked" },
          ...packageRequests
            .filter((request) => request.status.toLowerCase() === "packed" || request.id === form.packageRequestId)
            .map((request) => ({
              value: request.id,
              label: formatPackageRequestOption(request),
            })),
        ],
        form.packageRequestId,
        `Selected package request (${form.packageRequestId})`,
      ),
    [form.packageRequestId, packageRequests],
  );
  const customerOptions = useMemo(
    () =>
      withSelectedOption(
        [
          { value: "", label: "No customer selected" },
          ...customers.map((customer) => ({
            value: customer.id,
            label: formatCustomerOption(customer),
          })),
        ],
        form.customerUserId,
        `Selected customer (${form.customerUserId})`,
      ),
    [customers, form.customerUserId],
  );
  const installerOptions = useMemo(
    () =>
      withSelectedOption(
        [
          { value: "", label: "No installer assigned" },
          ...installers.map((installer) => ({
            value: installer.user.id,
            label: formatInstallerOption(installer),
          })),
        ],
        form.assignedTo,
        `Selected installer (${form.assignedTo})`,
      ),
    [form.assignedTo, installers],
  );

  function clearFieldError(field: keyof JobValidationErrors) {
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handlePackageRequestChange(value: string) {
    if (!value) {
      setForm((current) => ({ ...current, packageRequestId: "" }));
      return;
    }

    const request = packageRequests.find((item) => item.id === value);

    if (!request) {
      setForm((current) => ({ ...current, packageRequestId: value }));
      return;
    }

    setForm((current) => prefillFromPackageRequest(current, request));
  }

  function handleCustomerChange(value: string) {
    if (!value) {
      setForm((current) => ({ ...current, customerUserId: "" }));
      return;
    }

    const customer = customers.find((item) => item.id === value);

    if (!customer) {
      setForm((current) => ({ ...current, customerUserId: value }));
      return;
    }

    setForm((current) => prefillFromCustomer(current, customer));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateJobForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = buildJobPayload(form, selectedPackageRequest);
      await createJob(payload);

      if (form.packageRequestId) {
        await syncPackageRequestFromJob(form.status, form.packageRequestId, packageRequests);
      }

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
              <p className="section-description">Create jobs from packed package requests, keep customer data prefilled where possible, and mirror lifecycle updates into the package flow until backend sync takes over.</p>
            </div>
            <FormSubmitter
              formId={jobFormId}
              cancelLabel="Cancel"
              onCancel={() => router.push("/jobs")}
              primaryLabel={isSubmitting ? "Saving..." : "Finish"}
              disabled={isSubmitting}
            />
          </div>

          <JobEditor
            form={form}
            setForm={setForm}
            errors={errors}
            clearFieldError={clearFieldError}
            packageRequestOptions={packageRequestOptions}
            customerOptions={customerOptions}
            installerOptions={installerOptions}
            isLoadingReferences={isLoadingReferences}
            referenceError={referenceError}
            onPackageRequestChange={handlePackageRequestChange}
            onCustomerChange={handleCustomerChange}
          />
        </form>
      </Panel>
    </div>
  );
}
