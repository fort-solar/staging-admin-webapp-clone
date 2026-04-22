"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { installationMetrics, installations } from "@/lib/operations-data";
import { Button, MetricCardSecondary, Panel, SelectField, TextAreaField, TextField } from "@/components/dashboard/ui";
import { FormField, UploadField } from "@/components/dashboard/modals";
import { FormSubmitter, getFormSubmitIntent } from "@/components/dashboard/form-submitter";
import { ActionLink, AttachmentItem, DetailPanel, TagList } from "@/components/dashboard/management-primitives";
import { CalendarIcon, PlusIcon } from "@/components/dashboard/icons";

const installationFormId = "installation-form";

function InstallationMetricsStrip() {
  return (
    <section className="stats-grid--three">
      {installationMetrics.map((metric) => (
        <MetricCardSecondary key={metric.title} {...metric} />
      ))}
    </section>
  );
}

export function InstallationsManagementScreen() {
  const [page, setPage] = useState(1);

  return (
    <div className="dashboard-stack">
      <InstallationMetricsStrip />
      <Panel className="overflow-hidden">
        <div className="section-header content-section-header">
          <div>
            <h2 className="section-title">Installations</h2>
            <p className="section-description">Publish visual case studies for completed Fortsolar installations.</p>
          </div>
          <ActionLink href="/installations/new" leadingIcon={<PlusIcon className="mini-icon" />}>
            Add New Installation
          </ActionLink>
        </div>
        <div className="installation-grid">
          {installations.concat(installations).map((installation, index) => (
            <article key={`${installation.id}-${index}`} className="installation-card">
              <span className="product-placeholder" aria-hidden="true" />
              <div className="installation-card__shade" />
              <div className="installation-card__top">
                <span>
                  <CalendarIcon className="mini-icon" />
                  {installation.date}
                </span>
                <span>{installation.location}</span>
              </div>
              <div className="installation-card__dots">
                <span />
                <span className="is-active" />
                <span />
              </div>
              <div className="installation-card__copy">
                <h3>{installation.title}</h3>
                <p>{installation.overview}</p>
              </div>
            </article>
          ))}
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

export function InstallationFormScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("5kVA Campus Bundle");
  const [overview, setOverview] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("Port Harcourt");
  const [duration, setDuration] = useState("48 hrs");
  const [datasheet, setDatasheet] = useState("");
  const [mediaFile, setMediaFile] = useState("");
  const [powers, setPowers] = useState(["Washing Machine", "Laptops", "Phones", "Fridge", "Microwave", "LED Bulbs", "Outlets"]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    getFormSubmitIntent(event, "finish");
    router.push("/installations?created=1");
  }

  return (
    <div className="dashboard-stack">
      <InstallationMetricsStrip />
      <Panel className="product-form-shell">
        <form id={installationFormId} onSubmit={handleSubmit}>
          <div className="product-form-shell__header">
            <div>
              <h2 className="section-title">Add A New Installation</h2>
              <p className="section-description">Create installation case studies for the public gallery.</p>
            </div>
            <FormSubmitter formId={installationFormId} cancelLabel="Cancel" onCancel={() => router.push("/installations")} primaryLabel="Finish" />
          </div>

          <div className="product-form-grid">
            <DetailPanel title="Installation Information" description="Core details shown in the installation gallery.">
              <div className="detail-panel__stack">
                <FormField label="Installation Title">
                  <SelectField value={title} onChange={setTitle} options={["5kVA Campus Bundle", "10kVA Commercial Installation", "Campus Bundle Hostel"]} />
                </FormField>
                <FormField label="Installation Overview">
                  <TextAreaField value={overview} onChange={setOverview} placeholder="Installation Overview" rows={6} />
                </FormField>
                <FormField label="Client">
                  <TextField value={client} onChange={(event) => setClient(event.target.value)} placeholder="Client/ Business Name" />
                </FormField>
                <div className="product-inline-row is-two">
                  <FormField label="Location">
                    <SelectField value={location} onChange={setLocation} options={["Port Harcourt", "Lagos", "Abuja"]} />
                  </FormField>
                  <FormField label="Installation Time">
                    <SelectField value={duration} onChange={setDuration} options={["48 hrs", "6 - 8 hrs", "1 Day", "3 Days"]} />
                  </FormField>
                </div>
              </div>
            </DetailPanel>

            <DetailPanel title="Highlights" description="Describe the outcomes, system details, and powered appliances.">
              <div className="detail-panel__stack">
                <div className="copy-box">
                  <ul>
                    <li>24/7 Uninterrupted power supply</li>
                  </ul>
                </div>
                <div>
                  <p className="section-description">System Details</p>
                  <div className="form-repeat-row is-readonly">
                    <span>Inverter Size</span>
                    <strong>12kV</strong>
                  </div>
                  <div className="form-repeat-row is-readonly">
                    <span>PV Size</span>
                    <strong>12kWp</strong>
                  </div>
                  <div className="form-repeat-row is-readonly">
                    <span>Battery Size</span>
                    <strong>15kWh</strong>
                  </div>
                </div>
                <FormField label="What it Powers">
                  <TagList items={powers} />
                  <Button variant="secondary" size="sm" leadingIcon={<PlusIcon className="mini-icon" />} onClick={() => setPowers((current) => [...current, "Outlets"])}>
                    Add powered item
                  </Button>
                </FormField>
              </div>
            </DetailPanel>

            <DetailPanel title="Product Media" description="Upload public media and support files for the installation page.">
              <div className="detail-panel__stack">
                <div className="upload-showcase-empty">
                  <PlusIcon className="mini-icon" />
                  <p>Upload product images or videos (JPG, PNG, MP4) to display on the installation page.</p>
                </div>
                <div className="thumbnail-strip">
                  {[0, 1, 2, 3].map((item) => (
                    <span key={item} className="thumbnail-strip__item" aria-hidden="true">
                      <span className="product-placeholder" />
                    </span>
                  ))}
                </div>
                <FormField label="Product img/ video">
                  <UploadField value={mediaFile} onChange={setMediaFile} buttonLabel="Upload media" accept=".jpg,.jpeg,.png,.mp4" />
                </FormField>
                <FormField label="Add Data sheet">
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
