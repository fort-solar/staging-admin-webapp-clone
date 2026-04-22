"use client";

import Link from "next/link";
import { type FormEvent, useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { jobApplicants, jobMetrics, jobs, type JobRecord } from "@/lib/operations-data";
import {
  Button,
  Avatar,
  MetricCardSecondary,
  Pagination,
  Panel,
  RatingStars,
  SelectField,
  StatusPill,
  TableActionsMenu,
  Tabs,
  TextAreaField,
  TextField,
} from "@/components/dashboard/ui";
import { FormField } from "@/components/dashboard/modals";
import { FormSubmitter, getFormSubmitIntent } from "@/components/dashboard/form-submitter";
import { ActionLink, DirectoryToolbar, TagList } from "@/components/dashboard/management-primitives";
import { EyeIcon, FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";

const jobStatusTabs = ["All", "Open", "Assigned", "In Progress", "Completed", "Verified"] as const;
const jobFormId = "job-board-form";

type JobStatusFilter = (typeof jobStatusTabs)[number];

function JobMetricsStrip() {
  return (
    <section className="stats-grid--four">
      {jobMetrics.map((metric) => (
        <MetricCardSecondary key={metric.title} {...metric} />
      ))}
    </section>
  );
}

function jobMatchesQuery(job: JobRecord, query: string) {
  const haystack = `${job.title} ${job.location} ${job.type} ${job.difficulty} ${job.status}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function JobsManagementScreen() {
  const [rows, setRows] = useState(jobs);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<JobStatusFilter>("All");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);

  const filteredRows = useMemo(
    () =>
      rows.filter((job) => {
        const matchesStatus = status === "All" || job.status === status;
        return matchesStatus && jobMatchesQuery(job, deferredQuery);
      }),
    [deferredQuery, rows, status],
  );

  return (
    <div className="dashboard-stack">
      <JobMetricsStrip />
      <Panel className="overflow-hidden">
        <div className="management-surface__body">
          <div className="section-header content-section-header">
            <div>
              <h2 className="section-title">All Jobs</h2>
              <p className="section-description">Manage posted installation jobs and installer applications.</p>
            </div>
            <ActionLink href="/jobs/new" leadingIcon={<PlusIcon className="mini-icon" />}>
              Add Job
            </ActionLink>
          </div>
          <DirectoryToolbar
            searchValue={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search Jobs..."
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
        <div className="job-grid">
          {filteredRows.concat(filteredRows).map((job, index) => (
            <article key={`${job.id}-${index}`} className="job-card">
              <div className="job-card__top">
                <StatusPill label={job.assigned ? "Assigned" : "Not Assigned"} tone={job.assigned ? "warning" : "success"} solid={false} />
                <TableActionsMenu
                  items={[
                    { label: "View Job", href: `/jobs/${job.slug}`, icon: <EyeIcon className="menu-icon" /> },
                    {
                      label: "Delete Job",
                      tone: "danger",
                      icon: <TrashIcon className="menu-icon" />,
                      onSelect: () => setRows((current) => current.filter((item) => item.id !== job.id)),
                    },
                  ]}
                />
              </div>
              <h3>{job.title}</h3>
              <p>{job.description}</p>
              <TagList items={[job.type, job.difficulty, job.duration]} />
              <div className="job-card__footer">
                <strong>{job.budget}</strong>
                <span>{job.applications} applications</span>
                <Link href={`/jobs/${job.slug}`} className="action-button is-secondary is-sm">
                  View
                </Link>
              </div>
            </article>
          ))}
        </div>
        <Pagination page={page} totalPages={24} onChange={setPage} />
      </Panel>
    </div>
  );
}

export function JobDetailScreen({ job }: { job: JobRecord }) {
  const [applicants, setApplicants] = useState(jobApplicants);
  const [page, setPage] = useState(1);

  return (
    <div className="dashboard-stack">
      <Panel className="job-detail-hero">
        <div className="job-detail-hero__main">
          <StatusPill label={job.assigned ? "Assigned" : "Not Assigned"} tone={job.assigned ? "warning" : "success"} solid={false} />
          <h2>{job.title}</h2>
          <div className="job-location-box">
            <strong>{job.location}</strong>
            <span>{job.address}</span>
          </div>
          <p>{job.description}</p>
        </div>
        <div className="job-detail-hero__meta">
          <div className="job-meta-row">
            <span>Total Applications</span>
            <strong>{job.applications}</strong>
          </div>
          <div className="job-meta-row">
            <span>Budget</span>
            <strong>{job.budget}</strong>
          </div>
          <div className="job-meta-band is-blue">
            <span>Type</span>
            <strong>{job.type}</strong>
          </div>
          <div className="job-meta-band is-green">
            <span>Difficulty</span>
            <strong>{job.difficulty}</strong>
          </div>
          <div className="job-meta-band">
            <span>Duration</span>
            <strong>{job.duration}</strong>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="management-surface__body">
          <DirectoryToolbar
            searchValue=""
            onSearchChange={() => undefined}
            searchPlaceholder="Search by user..."
            filters={
              <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                Filter
              </Button>
            }
          />
        </div>
        <div className="table-scroll pt-2">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Installer</th>
                <th>Experience</th>
                <th>Rating & Performance</th>
                <th>Location</th>
                <th>Finished Jobs</th>
                <th>Installer Note</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((applicant) => (
                <tr key={applicant.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar src={applicant.avatar} alt={applicant.name} size="sm" />
                      <div className="person-cell__text">
                        <strong>{applicant.name}</strong>
                        <span>{applicant.phone}</span>
                        <span>{applicant.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusPill label={applicant.experience} tone="neutral" />
                  </td>
                  <td>
                    <RatingStars rating={applicant.rating} />
                  </td>
                  <td>{applicant.location}</td>
                  <td>{applicant.finishedJobs}</td>
                  <td>
                    <span className="note-pill">{applicant.note}</span>
                  </td>
                  <td>
                    <TableActionsMenu
                      items={[
                        { label: "Assign Installer", onSelect: () => setApplicants((current) => current.filter((item) => item.id !== applicant.id)) },
                        { label: "View Profile", href: `/users/installers/${applicant.id}` },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={24} onChange={setPage} />
      </Panel>
    </div>
  );
}

export function JobFormScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("3kVA Solar/ Inverter AA1 Installation");
  const [location, setLocation] = useState("Port Harcourt");
  const [address, setAddress] = useState("24 Odum street");
  const [budget, setBudget] = useState("");
  const [systemSize, setSystemSize] = useState("");
  const [startDate, setStartDate] = useState("May 10, 2025");
  const [duration, setDuration] = useState("1 Day");
  const [installationType, setInstallationType] = useState("Residential");
  const [difficulty, setDifficulty] = useState("Standard");
  const [description, setDescription] = useState("uu");
  const [scope, setScope] = useState("Inverter Installation of 1x 5kVA Hybrid Inverter (Wall-mounted).");
  const [components, setComponents] = useState("600W Jwinco Solar Panels (4 units).");
  const [requirements, setRequirements] = useState("Must possess valid FortSolar Installer ID.");
  const [siteConditions, setSiteConditions] = useState("Building Type: 2-Storey Duplex.");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    getFormSubmitIntent(event, "finish");
    router.push("/jobs?created=1");
  }

  return (
    <div className="dashboard-stack">
      <JobMetricsStrip />
      <Panel className="product-form-shell">
        <form id={jobFormId} onSubmit={handleSubmit}>
          <div className="product-form-shell__header">
            <div>
              <h2 className="section-title">Add A New Job</h2>
              <p className="section-description">Post installation jobs for installer applications.</p>
            </div>
            <FormSubmitter formId={jobFormId} cancelLabel="Cancel" onCancel={() => router.push("/jobs")} primaryLabel="Finish" />
          </div>
          <div className="product-form-grid">
            <section className="detail-panel">
              <div className="detail-panel__header">
                <h3>Job Information</h3>
                <p>Core job details, budget, and location.</p>
              </div>
              <div className="detail-panel__stack">
                <FormField label="Job Title">
                  <TextField value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Eg 3kVA Solar/Inverter AA1 Installation" />
                </FormField>
                <FormField label="Job Location (City)">
                  <SelectField value={location} onChange={setLocation} options={["Port Harcourt", "Lagos", "Abuja"]} />
                </FormField>
                <FormField label="House Address">
                  <TextField value={address} onChange={(event) => setAddress(event.target.value)} placeholder="no 24. odum street" />
                </FormField>
                <div className="product-inline-row is-two">
                  <FormField label="Budget">
                    <TextField value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="(₦)" />
                  </FormField>
                  <FormField label="System Size">
                    <TextField value={systemSize} onChange={(event) => setSystemSize(event.target.value)} placeholder="5kVA" />
                  </FormField>
                </div>
                <div className="product-inline-row is-two">
                  <FormField label="Est Duration">
                    <SelectField value={duration} onChange={setDuration} options={["1 Day", "6 - 8 Hrs", "2 Days", "3 Days"]} />
                  </FormField>
                  <FormField label="Start Date">
                    <TextField value={startDate} onChange={(event) => setStartDate(event.target.value)} placeholder="May 10, 2025" />
                  </FormField>
                </div>
                <FormField label="Installation Type">
                  <SelectField value={installationType} onChange={setInstallationType} options={["Residential", "Commercial", "Upgrade"]} />
                </FormField>
              </div>
            </section>
            <section className="detail-panel">
              <div className="detail-panel__stack">
                <FormField label="Difficulty Level">
                  <SelectField value={difficulty} onChange={setDifficulty} options={["Standard", "Intermediate", "Expert"]} />
                </FormField>
                <FormField label="Job Description">
                  <TextAreaField value={description} onChange={setDescription} rows={6} />
                </FormField>
                <FormField label="Requirements">
                  <TextAreaField value={requirements} onChange={setRequirements} rows={5} />
                </FormField>
                <FormField label="Site Conditions">
                  <TextAreaField value={siteConditions} onChange={setSiteConditions} rows={5} />
                </FormField>
              </div>
            </section>
            <section className="detail-panel">
              <div className="detail-panel__stack">
                <FormField label="Scope Of Work">
                  <TextAreaField value={scope} onChange={setScope} rows={6} />
                </FormField>
                <FormField label="Installation Components">
                  <TextAreaField value={components} onChange={setComponents} rows={7} />
                </FormField>
              </div>
            </section>
          </div>
        </form>
      </Panel>
    </div>
  );
}
