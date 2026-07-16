"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { ChevronLeftIcon } from "@/components/dashboard/icons";
import { Button, InfoRow, Panel, SelectField, StatusPill, TextAreaField, TextField } from "@/components/dashboard/ui";
import { Modal, FormField, ModalTextInput, ModalTextArea } from "@/components/dashboard/modals";
import { useToast } from "@/components/ui/toast";
import { useAccessControl } from "@/components/auth/use-access-control";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { formatCurrencyLabel, formatDateTimeLabel, formatEnumLabel, getOrder, updateOrder, createCustomerInstallation, createJob } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { OrderDetail } from "@/types/api.types";

const orderStatusOptions = ["pending", "processing", "completed", "cancelled"];

function renderFormattedNotes(notes: string) {
  if (!notes) return <span className="text-gray-400">N/A</span>;
  
  if (notes.includes("[Professional Installation Site Details]")) {
    const parts = notes.split("[Professional Installation Site Details]");
    const generalNote = parts[0]?.trim();
    const siteDetailsRaw = parts[1]?.trim() || "";
    
    const keys = [
      "Roof Type:",
      "Roof Orientation:",
      "Shading Level:",
      "Estimated Roof Size:",
      "Monthly Bill:",
      "Daily Usage:",
    ];
    
    const details: Array<{ label: string; value: string }> = [];
    let currentText = siteDetailsRaw;
    
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (currentText.includes(key)) {
        const nextKey = keys.find(k => currentText.indexOf(k) > currentText.indexOf(key));
        const start = currentText.indexOf(key) + key.length;
        const end = nextKey ? currentText.indexOf(nextKey) : currentText.length;
        const value = currentText.substring(start, end).trim();
        details.push({
          label: key.replace(":", ""),
          value: value || "Not specified",
        });
      }
    }
    
    return (
      <div className="space-y-3 mt-2">
        {generalNote && (
          <div className="bg-gray-50/50 p-2.5 rounded-lg border border-[var(--border)]">
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">General Notes</span>
            <p className="text-xs text-gray-700 whitespace-pre-wrap">{generalNote}</p>
          </div>
        )}
        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="bg-gray-50/50 px-3 py-1.5 border-b border-[var(--border)]">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Site Details</span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-gray-200">
            {details.map((detail) => (
              <div key={detail.label} className="bg-white p-2">
                <span className="block text-[10px] font-medium text-gray-400 mb-0.5">{detail.label}</span>
                <span className="text-xs font-semibold text-gray-700 capitalize">{detail.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  return <p className="text-xs text-gray-700 whitespace-pre-wrap mt-1">{notes}</p>;
}

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const { can } = useAccessControl();
  const canCreateInstallations = can("installations", "create");
  
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [form, setForm] = useState({
    status: "pending",
    currency: "NGN",
    totalAmount: "0",
    notes: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingInstallation, setIsCreatingInstallation] = useState(false);
  const [isSpawnModalOpen, setIsSpawnModalOpen] = useState(false);
  const [spawnForm, setSpawnForm] = useState({
    title: "",
    description: "",
    location: "",
    budget: "120000",
    systemSize: "5",
    numberOfPanels: "0",
    panelType: "",
    inverterType: "",
    inverterSize: "",
    panelSize: "",
    batteryType: "Lithium",
    batteryEnergy: "",
    city: "",
    state: "",
    country: "Nigeria",
  });
  const [error, setError] = useState<string | null>(null);

  function openSpawnModal() {
    if (!detail) return;
    const br = detail.bundleRequests?.[0];
    const systemSize = Number(br?.system_size_kw) || 5.0;
    const address = br?.address || "";
    const city = br?.city || "";
    const state = br?.state || "";
    const country = br?.country || "Nigeria";
    const computedLocation = [address, city, state, country].filter(Boolean).join(", ") || "Lagos, Nigeria";
    
    let generalNote = "";
    if (detail.order.notes) {
      if (detail.order.notes.includes("[Professional Installation Site Details]")) {
        generalNote = detail.order.notes.split("[Professional Installation Site Details]")[0]?.trim();
      } else {
        generalNote = detail.order.notes.trim();
      }
    }

    const price = detail.order.total_amount ? Number(detail.order.total_amount) : 1500000.0;
    const installerBudget = Math.max(120000, Math.round(price * 0.08));

    setSpawnForm({
      title: `Solar Installation for ${detail.order.customer_name}`,
      location: computedLocation,
      budget: String(installerBudget),
      description: `Standard ${systemSize}kW Solar Panel + Inverter installation.\n\nCustomer Notes: ${generalNote || "None"}`,
      systemSize: String(systemSize),
      numberOfPanels: String(br?.number_of_panels || 6),
      panelType: br?.panel_type || "Mono 550W",
      inverterType: br?.inverter_type || "Hybrid 5kVA",
      inverterSize: br?.inverter_type || `${systemSize}kW`,
      panelSize: br?.panel_type || "550W",
      batteryType: "Lithium",
      batteryEnergy: `${Math.round(systemSize * 2)}kWh`,
      city,
      state,
      country,
    });
    setIsSpawnModalOpen(true);
  }

  async function handleSpawnJob(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setIsCreatingInstallation(true);
    try {
      const br = detail.bundleRequests?.[0];
      const address = br?.address || spawnForm.location || "Lagos, Nigeria";

      const insRes = await createCustomerInstallation({
        user_id: detail.order.customer_user_id,
        order_id: detail.order.id,
        address,
        status: "scheduled",
        city: spawnForm.city || br?.city || "",
        state: spawnForm.state || br?.state || "",
        country: spawnForm.country || br?.country || "Nigeria",
        system_size_kw: Number(spawnForm.systemSize) || 5.0,
        number_of_panels: Number(spawnForm.numberOfPanels) || 0,
        panel_type: spawnForm.panelType,
        inverter_type: spawnForm.inverterType,
      });

      const installationId = insRes?.data?.id;

      await createJob({
        slug: "",
        title: spawnForm.title.trim(),
        description: spawnForm.description.trim(),
        location: spawnForm.location.trim(),
        budget: Number(spawnForm.budget) || 120000,
        required_experience_years: 1,
        package_request_id: br?.id || undefined,
        installation_id: installationId || undefined,
        status: "open",
        inverter_size: spawnForm.inverterSize.trim() || undefined,
        panel_size: spawnForm.panelSize.trim() || undefined,
        number_of_panels: Number(spawnForm.numberOfPanels) || 0,
        battery_type: spawnForm.batteryType,
        battery_energy: spawnForm.batteryEnergy.trim() || undefined,
        city: spawnForm.city.trim() || undefined,
        state: spawnForm.state.trim() || undefined,
        country: spawnForm.country.trim() || undefined,
      });

      const refreshed = await getOrder(id);
      setDetail(refreshed.data);
      setIsSpawnModalOpen(false);

      toast({
        title: "Installation Job Spawned",
        description: "Customer installation created and job board posting published successfully.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Failed to spawn installation job",
        description: getErrorMessage(err, "An error occurred while spawning installation job."),
        variant: "error",
      });
    } finally {
      setIsCreatingInstallation(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getOrder(id)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setDetail(payload.data);
        setForm({
          status: payload.data.order.status,
          currency: payload.data.order.currency,
          totalAmount: payload.data.order.total_amount,
          notes: payload.data.order.notes ?? "",
        });
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(loadError, "Order details could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!detail) {
      return;
    }

    setIsSaving(true);

    try {
      await updateOrder(detail.order.id, {
        status: form.status,
        currency: form.currency,
        total_amount: Number(form.totalAmount) || 0,
        notes: form.notes,
      });

      const refreshed = await getOrder(detail.order.id);
      setDetail(refreshed.data);
      setForm({
        status: refreshed.data.order.status,
        currency: refreshed.data.order.currency,
        totalAmount: refreshed.data.order.total_amount,
        notes: refreshed.data.order.notes ?? "",
      });

      toast({
        title: "Order updated",
        description: `Order ${refreshed.data.order.id} was updated successfully.`,
        variant: "success",
      });
    } catch (saveError) {
      if (isDashboardActionCancelledError(saveError) || isDashboardSessionExpiredError(saveError)) {
        return;
      }

      toast({
        title: "Update failed",
        description: getErrorMessage(saveError, "The order could not be updated."),
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="dashboard-stack">
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 pb-4 pt-6">
          <div className="inline-actions">
            <Link href="/orders" className="icon-button" aria-label="Back to orders">
              <ChevronLeftIcon className="menu-icon" />
            </Link>
            <h2 className="m-0 text-lg font-extrabold sm:text-[20px]">{detail ? `#${detail.order.id}` : isLoading ? "Loading order..." : "Order"}</h2>
          </div>
          {detail ? <StatusPill label={formatEnumLabel(detail.order.status)} tone={toneFromStatus(detail.order.status)} /> : null}
        </div>

        <ErrorMessage title="Order load failed" message={error} className="mx-6 mb-4" />

        <Panel className="mx-6 mb-6 border border-[var(--border)] shadow-none">
          <div className="grid gap-0 xl:grid-cols-3">
            <div className="border-b border-[var(--border)] p-6 xl:border-b-0 xl:border-r">
              <h3 className="m-0 text-sm font-bold sm:text-[15px]">Order Information</h3>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                <InfoRow label="Order ID" value={detail?.order.id || "N/A"} />
                <InfoRow label="Customer" value={detail?.order.customer_name || "N/A"} />
                <InfoRow label="Customer Email" value={detail?.order.customer_email || "N/A"} />
                <InfoRow label="Created" value={formatDateTimeLabel(detail?.order.created_at)} />
                <InfoRow label="Updated" value={formatDateTimeLabel(detail?.order.updated_at)} />
                <InfoRow label="Total Amount" value={detail ? formatCurrencyLabel(detail.order.total_amount, detail.order.currency) : "N/A"} />
                <InfoRow label="Currency" value={detail?.order.currency || "N/A"} />
                {detail?.order.notes ? (
                  <div className="mt-4 pt-4 border-t border-[var(--border)]">
                    <span className="block text-xs font-semibold text-gray-400 mb-1">Order Notes</span>
                    {renderFormattedNotes(detail.order.notes)}
                  </div>
                ) : (
                  <InfoRow label="Notes" value="N/A" />
                )}
              </div>
            </div>

            <div className="border-b border-[var(--border)] p-6 xl:border-b-0 xl:border-r">
              <h3 className="m-0 text-sm font-bold sm:text-[15px]">Order Items</h3>
              <div className="mt-5 flex flex-col gap-4">
                {detail?.items.length ? (
                  detail.items.map((item) => (
                    <div key={item.id} className="rounded-[16px] border border-[var(--border)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <strong>{item.name}</strong>
                        <span>{formatCurrencyLabel(item.unit_price, detail.order.currency)}</span>
                      </div>
                      <p className="mb-0 mt-2 text-sm text-[var(--text-soft)]">
                        {formatEnumLabel(item.item_type)} • Quantity {item.quantity}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="mt-4 text-sm text-[var(--text-soft)]">{isLoading ? "Loading items..." : "No order items were returned."}</p>
                )}
              </div>

              <div className="mt-8">
                <h4 className="m-0 text-sm font-bold sm:text-[15px]">Package Requests</h4>
                <div className="mt-4 flex flex-col gap-4">
                  {detail?.bundleRequests.length ? (
                    detail.bundleRequests.map((request) => (
                      <div key={request.id} className="rounded-[16px] border border-[var(--border)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <strong>{request.bundle_name}</strong>
                          <StatusPill label={formatEnumLabel(request.status)} tone={toneFromStatus(request.status)} solid={false} />
                        </div>
                        <p className="mb-0 mt-2 text-sm text-[var(--text-soft)]">{request.admin_note || "No admin note provided."}</p>
                      </div>
                    ))
                  ) : (
                    <p className="mt-4 text-sm text-[var(--text-soft)]">{isLoading ? "Loading package requests..." : "No package requests were returned for this order."}</p>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <h4 className="m-0 text-sm font-bold sm:text-[15px]">Installations</h4>
                <div className="mt-4 flex flex-col gap-4">
                  {detail?.installations && detail.installations.length ? (
                    detail.installations.map((installation) => (
                      <div key={installation.id} className="rounded-[16px] border border-[var(--border)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <strong>{installation.installer_company || "FortSolar Fleet"}</strong>
                          <StatusPill label={formatEnumLabel(installation.status)} tone={toneFromStatus(installation.status)} solid={false} />
                        </div>
                        <p className="mb-0 mt-2 text-sm text-[var(--text-soft)]">
                          Address: {installation.address} <br />
                          Size: {installation.system_size_kw ? `${installation.system_size_kw} kW` : "N/A"} <br />
                          Installer: {installation.installer_name || "Unassigned"}
                        </p>
                        <div className="mt-3">
                          <Link href="/jobs" className="text-xs font-semibold text-[#168416] hover:underline">
                            Manage Installation in Jobs
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div>
                      <p className="text-sm text-[var(--text-soft)]">No installations spawned for this order.</p>
                      {canCreateInstallations && detail?.order.status === "processing" && (
                        <Button
                          onClick={openSpawnModal}
                          variant="secondary"
                          className="mt-3 w-full"
                          disabled={isCreatingInstallation}
                        >
                          Spawn Installation
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6">
              <h3 className="m-0 text-sm font-bold sm:text-[15px]">Update Order</h3>
              <form className="mt-5 flex flex-col gap-4" onSubmit={handleSave}>
                <label className="form-field">
                  <span className="form-field__label">
                    <span>Status</span>
                  </span>
                  <SelectField value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={orderStatusOptions} />
                </label>

                <label className="form-field">
                  <span className="form-field__label">
                    <span>Currency</span>
                  </span>
                  <TextField value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))} placeholder="NGN" />
                </label>

                <label className="form-field">
                  <span className="form-field__label">
                    <span>Total Amount</span>
                  </span>
                  <TextField value={form.totalAmount} onChange={(event) => setForm((current) => ({ ...current, totalAmount: event.target.value }))} placeholder="250000" />
                </label>

                <label className="form-field">
                  <span className="form-field__label">
                    <span>Notes</span>
                  </span>
                  <TextAreaField value={form.notes} onChange={(value) => setForm((current) => ({ ...current, notes: value }))} placeholder="Order notes" rows={5} />
                </label>

                <Button type="submit" variant="primary" disabled={isLoading || isSaving || !detail}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </form>

              <div className="mt-8">
                <h4 className="m-0 text-sm font-bold sm:text-[15px]">Order Events</h4>
                <div className="mt-4 flex flex-col gap-4">
                  {detail?.events.length ? (
                    detail.events.map((event) => (
                      <div key={event.id} className="rounded-[16px] border border-[var(--border)] p-4">
                        <strong>{formatEnumLabel(event.kind)}</strong>
                        <p className="mb-0 mt-2 text-sm text-[var(--text-soft)]">{event.message}</p>
                        <small className="text-[var(--text-faint)]">{formatDateTimeLabel(event.created_at)}</small>
                      </div>
                    ))
                  ) : (
                    <p className="mt-4 text-sm text-[var(--text-soft)]">{isLoading ? "Loading events..." : "No order events were returned."}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </Panel>

      <Modal
        open={isSpawnModalOpen}
        title="Spawn Installation Job"
        onClose={() => setIsSpawnModalOpen(false)}
        size="lg"
      >
        <form onSubmit={handleSpawnJob} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Job Title">
              <ModalTextInput
                value={spawnForm.title}
                onChange={(e) => setSpawnForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Solar Installation for Customer"
              />
            </FormField>

            <FormField label="Combined Address">
              <ModalTextInput
                value={spawnForm.location}
                onChange={(e) => setSpawnForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g. 12 Main St, Lagos, Nigeria"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="City">
              <ModalTextInput
                value={spawnForm.city}
                onChange={(e) => setSpawnForm(prev => ({ ...prev, city: e.target.value }))}
                placeholder="e.g. Ikeja"
              />
            </FormField>

            <FormField label="State">
              <ModalTextInput
                value={spawnForm.state}
                onChange={(e) => setSpawnForm(prev => ({ ...prev, state: e.target.value }))}
                placeholder="e.g. Lagos"
              />
            </FormField>

            <FormField label="Country">
              <ModalTextInput
                value={spawnForm.country}
                onChange={(e) => setSpawnForm(prev => ({ ...prev, country: e.target.value }))}
                placeholder="e.g. Nigeria"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Installer Budget (NGN)">
              <ModalTextInput
                value={spawnForm.budget}
                onChange={(e) => setSpawnForm(prev => ({ ...prev, budget: e.target.value }))}
                placeholder="e.g. 120000"
                type="text"
              />
            </FormField>

            <FormField label="System Size (kW)">
              <ModalTextInput
                value={spawnForm.systemSize}
                onChange={(e) => setSpawnForm(prev => ({ ...prev, systemSize: e.target.value }))}
                placeholder="e.g. 5"
                type="text"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="Inverter Size">
              <ModalTextInput
                value={spawnForm.inverterSize}
                onChange={(e) => setSpawnForm(prev => ({ ...prev, inverterSize: e.target.value }))}
                placeholder="e.g. 6kW"
              />
            </FormField>

            <FormField label="Panel Size">
              <ModalTextInput
                value={spawnForm.panelSize}
                onChange={(e) => setSpawnForm(prev => ({ ...prev, panelSize: e.target.value }))}
                placeholder="e.g. 650W"
              />
            </FormField>

            <FormField label="Number of Panels">
              <ModalTextInput
                value={spawnForm.numberOfPanels}
                onChange={(e) => setSpawnForm(prev => ({ ...prev, numberOfPanels: e.target.value }))}
                placeholder="e.g. 6"
                type="text"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Battery Type">
              <select
                value={spawnForm.batteryType}
                onChange={(e) => setSpawnForm(prev => ({ ...prev, batteryType: e.target.value }))}
                className="w-full rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#168416] focus:ring-1 focus:ring-[#168416]"
              >
                <option value="Lithium">Lithium</option>
                <option value="Tubular">Tubular</option>
                <option value="Gel">Gel</option>
                <option value="Other">Other</option>
              </select>
            </FormField>

            <FormField label="Battery Energy (Capacity)">
              <ModalTextInput
                value={spawnForm.batteryEnergy}
                onChange={(e) => setSpawnForm(prev => ({ ...prev, batteryEnergy: e.target.value }))}
                placeholder="e.g. 5kWh"
              />
            </FormField>
          </div>

          <FormField label="Job Description (visible on Job Board)">
            <ModalTextArea
              value={spawnForm.description}
              onChange={(val) => setSpawnForm(prev => ({ ...prev, description: val }))}
              placeholder="Detailed description of the solar project requirements..."
            />
          </FormField>

          <div className="flex justify-end gap-3 mt-4">
            <Button type="button" variant="secondary" onClick={() => setIsSpawnModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isCreatingInstallation}>
              {isCreatingInstallation ? "Spawning..." : "Publish Job & Installation"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
