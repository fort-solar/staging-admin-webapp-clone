"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { appliances as seedAppliances, quoteRequests, type ApplianceRecord, type QuoteRequestRecord } from "@/lib/operations-data";
import {
  Button,
  Pagination,
  Panel,
  SelectField,
  StatusPill,
  TableActionsMenu,
  Tabs,
  TextField,
} from "@/components/dashboard/ui";
import { FormField, UploadField } from "@/components/dashboard/modals";
import { AttachmentItem, DirectoryToolbar, DetailPanel, KeyValueList, TagList } from "@/components/dashboard/management-primitives";
import { EyeIcon, FilterIcon, PlusIcon, TrashIcon } from "@/components/dashboard/icons";

const auditTabs = ["Quote Request", "Appliances"] as const;

type AuditTab = (typeof auditTabs)[number];

function quoteMatchesQuery(record: QuoteRequestRecord, query: string) {
  const haystack = `${record.customer} ${record.email} ${record.phone} ${record.status} ${record.appliances.join(" ")}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function applianceMatchesQuery(record: ApplianceRecord, query: string) {
  return `${record.name} ${record.wattage}`.toLowerCase().includes(query.toLowerCase());
}

export function EnergyAuditManagementScreen() {
  const { can } = useAccessControl();
  const [activeTab, setActiveTab] = useState<AuditTab>("Quote Request");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [appliances, setAppliances] = useState(seedAppliances);
  const [selectedApplianceId, setSelectedApplianceId] = useState(seedAppliances[0]?.id ?? "");
  const deferredQuery = useDeferredValue(query);
  const selectedAppliance = appliances.find((appliance) => appliance.id === selectedApplianceId) ?? appliances[0];
  const canCreateAudits = can("energy_audits", "create");
  const canUpdateAudits = can("energy_audits", "update");
  const canDeleteAudits = can("energy_audits", "delete");

  const filteredQuotes = useMemo(() => quoteRequests.filter((quote) => quoteMatchesQuery(quote, deferredQuery)), [deferredQuery]);
  const filteredAppliances = useMemo(() => appliances.filter((appliance) => applianceMatchesQuery(appliance, deferredQuery)), [appliances, deferredQuery]);

  return (
    <div className="dashboard-stack">
      <div className="management-surface__tabs is-outside">
        <Tabs value={activeTab} onChange={setActiveTab} options={auditTabs} />
      </div>
      <Panel className="overflow-hidden">
        <div className="management-surface__body">
          <DirectoryToolbar
            searchValue={query}
            onSearchChange={setQuery}
            searchPlaceholder={activeTab === "Quote Request" ? "Search request..." : "Search appliances..."}
            filters={
              <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                Filter
              </Button>
            }
            action={
              activeTab === "Appliances" && canCreateAudits ? (
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon={<PlusIcon className="mini-icon" />}
                  onClick={() =>
                    setAppliances((current) => [{ id: `APL-${Date.now()}`, name: "New Appliance", wattage: "0.0" }, ...current])
                  }
                >
                  Add Appliance
                </Button>
              ) : null
            }
          />
        </div>

        {activeTab === "Quote Request" ? (
          <>
            <div className="table-scroll pt-2">
              <table className="dashboard-table audit-table">
                <thead>
                  <tr>
                    <th>User Information</th>
                    <th>Appliance</th>
                    <th>Estimated Calculations</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((quote) => (
                    <tr key={quote.id}>
                      <td>
                        <div className="product-cell__text">
                          <strong>{quote.customer}</strong>
                          <span>{quote.phone}</span>
                          <span>{quote.email}</span>
                        </div>
                      </td>
                      <td>
                        <TagList items={quote.appliances} />
                      </td>
                      <td>
                        <ul className="compact-list">
                          {quote.calculations.map((item) => (
                            <li key={item.label}>
                              <span>{item.label}</span>
                              <strong>{item.value}</strong>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>{quote.date}</td>
                      <td>
                        <StatusPill label={quote.status} tone={quote.statusTone} />
                      </td>
                      <td>
                        <div className="inline-actions">
                          <Link href={`/energy-audit/${quote.id}`} className="action-button is-secondary is-sm">
                            <EyeIcon className="mini-icon" />
                            <span>View</span>
                          </Link>
                          {canUpdateAudits ? <TableActionsMenu items={[{ label: "Mark as Quoted" }, { label: "Close Request" }]} /> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={24} onChange={setPage} />
          </>
        ) : (
          <div className="audit-appliance-layout">
            <div className="appliance-list">
              {filteredAppliances.map((appliance) => (
                <article key={appliance.id} className="appliance-row">
                  <button type="button" onClick={() => setSelectedApplianceId(appliance.id)}>
                    <strong>{appliance.name}</strong>
                    <span>{appliance.wattage}</span>
                  </button>
                  <div className="inline-actions">
                    {canUpdateAudits ? (
                      <Button variant="secondary" size="sm" onClick={() => setSelectedApplianceId(appliance.id)}>
                        Edit
                      </Button>
                    ) : null}
                    {canDeleteAudits ? (
                      <Button
                        variant="danger"
                        size="sm"
                        leadingIcon={<TrashIcon className="mini-icon" />}
                        onClick={() => setAppliances((current) => current.filter((item) => item.id !== appliance.id))}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            <aside className="side-edit-card">
              <h3>Edit Appliance</h3>
              <p>{selectedAppliance?.name ?? "Appliance"} - {selectedAppliance?.wattage ?? "0.0"}</p>
              <FormField label="Name">
                <TextField
                  value={selectedAppliance?.name ?? ""}
                  onChange={(event) =>
                    setAppliances((current) =>
                      current.map((item) => (item.id === selectedAppliance?.id ? { ...item, name: event.target.value } : item)),
                    )
                  }
                  placeholder="Appliance Name"
                />
              </FormField>
              <FormField label="Wattage">
                <SelectField
                  value={selectedAppliance?.wattage ?? "90.0"}
                  onChange={(value) =>
                    setAppliances((current) =>
                      current.map((item) => (item.id === selectedAppliance?.id ? { ...item, wattage: value } : item)),
                    )
                  }
                  options={["25.0", "90.0", "120.0", "350.0", "900.0"]}
                />
              </FormField>
              <Button variant="primary">Update Appliance</Button>
            </aside>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function EnergyAuditDetailScreen({ quote }: { quote: QuoteRequestRecord }) {
  const { can } = useAccessControl();
  const [datasheet, setDatasheet] = useState("");
  const canUpdateAudits = can("energy_audits", "update");

  return (
    <div className="dashboard-stack">
      <Panel className="quote-detail-shell">
        <div className="product-detail-shell__header">
          <div>
            <h2 className="section-title">Single Quote Request</h2>
            <p className="section-description">Review customer audit details and upload the final audited quote.</p>
          </div>
          <div className="inline-actions">
            <StatusPill label="Pending" tone="warning" />
            <StatusPill label="Quoted" tone="info" />
            <StatusPill label="Closed" tone="neutral" />
          </div>
        </div>
        <div className="quote-detail-grid">
          <DetailPanel title="Users Information" description="Customer details submitted from the public energy calculator.">
            <KeyValueList
              items={[
                { label: "Users Name", value: quote.customer },
                { label: "Phone Number", value: quote.phone },
                { label: "Email", value: quote.email },
                { label: "Location", value: quote.location },
                { label: "Address", value: quote.address },
              ]}
            />
            <div className="detail-panel__stack">
              <div>
                <p className="section-description">Added Appliances</p>
                <TagList items={quote.appliances} />
              </div>
            </div>
          </DetailPanel>
          <DetailPanel title="Estimated Calculations" description="System estimate generated by the calculator.">
            <KeyValueList items={quote.calculations.map((item) => ({ label: item.label, value: item.value }))} />
            {canUpdateAudits ? (
              <>
                <FormField label="Send Audited Quote">
                  <UploadField value={datasheet} onChange={setDatasheet} buttonLabel="Upload file" accept=".pdf,.doc,.docx" />
                </FormField>
                <AttachmentItem label={datasheet || "Quote/cameron_williamson.pdf"} helper="Preview" />
              </>
            ) : null}
          </DetailPanel>
          <aside className="side-edit-card is-action-card">
            {canUpdateAudits ? <Button variant="primary">Update</Button> : null}
          </aside>
        </div>
      </Panel>
    </div>
  );
}
