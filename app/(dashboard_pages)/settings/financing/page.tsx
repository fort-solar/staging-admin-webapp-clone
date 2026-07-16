"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel, PanelHeader } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { dashboardGet, submitDashboardForm } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { ChevronLeftIcon } from "@/components/dashboard/icons";

export default function FinancingSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Core Rates
  const [minDownpayment, setMinDownpayment] = useState<number>(30);
  const [shortTermRate, setShortTermRate] = useState<number>(25.2);
  const [longTermRate, setLongTermRate] = useState<number>(36.0);
  const [individualRate, setIndividualRate] = useState<number>(48.0);
  const [salaryEarnerRate, setSalaryEarnerRate] = useState<number>(20.0);
  const [businessRate, setBusinessRate] = useState<number>(18.0);
  const [tenuresInput, setTenuresInput] = useState<string>("3, 6, 12, 24");

  // Advanced Customizations
  const [maxFinanceAmount, setMaxFinanceAmount] = useState<number>(5000000);
  const [minSalaryAmount, setMinSalaryAmount] = useState<number>(150000);
  const [requireGuarantor, setRequireGuarantor] = useState<boolean>(true);
  const [guarantorMinSalary, setGuarantorMinSalary] = useState<number>(250000);
  const [adminFeePct, setAdminFeePct] = useState<number>(2.0);
  const [insuranceFeePct, setInsuranceFeePct] = useState<number>(1.5);
  const [latePaymentFeePct, setLatePaymentFeePct] = useState<number>(5.0);
  const [allowedCollateral, setAllowedCollateral] = useState<string>("Utility Bill, Vehicle Title, Land Certificate");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    dashboardGet("/admin/settings/financing")
      .then((res: any) => {
        if (cancelled) return;
        const data = res.data || {};
        if (data.minDownpayment !== undefined) setMinDownpayment(data.minDownpayment);
        if (data.shortTermRate !== undefined) setShortTermRate(data.shortTermRate);
        if (data.longTermRate !== undefined) setLongTermRate(data.longTermRate);
        if (data.individualRate !== undefined) setIndividualRate(data.individualRate);
        if (data.salaryEarnerRate !== undefined) setSalaryEarnerRate(data.salaryEarnerRate);
        if (data.businessRate !== undefined) setBusinessRate(data.businessRate);
        if (data.tenures && Array.isArray(data.tenures)) setTenuresInput(data.tenures.join(", "));
        if (data.maxFinanceAmount !== undefined) setMaxFinanceAmount(data.maxFinanceAmount);
        if (data.minSalaryAmount !== undefined) setMinSalaryAmount(data.minSalaryAmount);
        if (data.requireGuarantor !== undefined) setRequireGuarantor(data.requireGuarantor);
        if (data.guarantorMinSalary !== undefined) setGuarantorMinSalary(data.guarantorMinSalary);
        if (data.adminFeePct !== undefined) setAdminFeePct(data.adminFeePct);
        if (data.insuranceFeePct !== undefined) setInsuranceFeePct(data.insuranceFeePct);
        if (data.latePaymentFeePct !== undefined) setLatePaymentFeePct(data.latePaymentFeePct);
        if (data.allowedCollateral && Array.isArray(data.allowedCollateral)) {
          setAllowedCollateral(data.allowedCollateral.join(", "));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        toast({
          title: "Error loading financing settings",
          description: getErrorMessage(err),
          variant: "error",
        });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      minDownpayment,
      shortTermRate,
      longTermRate,
      individualRate,
      salaryEarnerRate,
      businessRate,
      tenures: tenuresInput.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n > 0),
      maxFinanceAmount,
      minSalaryAmount,
      requireGuarantor,
      guarantorMinSalary,
      adminFeePct,
      insuranceFeePct,
      latePaymentFeePct,
      allowedCollateral: allowedCollateral.split(",").map((s) => s.trim()).filter(Boolean),
    };

    try {
      await submitDashboardForm("/admin/settings/financing", payload);
      toast({
        title: "Financing settings updated",
        description: "Operations parameters saved successfully.",
      });
    } catch (err) {
      toast({
        title: "Failed to update settings",
        description: getErrorMessage(err),
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center text-sm text-[#667085]">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="dashboard-stack">
      <div className="product-form-shell__header mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="management-back-link p-1 hover:bg-gray-100 rounded-lg">
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h2 className="section-title">Financing & Operations Settings</h2>
            <p className="section-description">Configure rates, requirements, and parameters for customer credit applications.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Panel>
            <PanelHeader title="Interest Rates & Tenures" description="Configure APR rates and repayment durations." />
            <div className="detail-panel__stack">
              <label className="form-field">
                <span className="form-field__label">Minimum Downpayment (%)</span>
                <input
                  type="number"
                  className="dashboard-input"
                  value={minDownpayment}
                  onChange={(e) => setMinDownpayment(Number(e.target.value))}
                  min="0"
                  max="100"
                  required
                />
              </label>

              <div className="product-inline-row is-two">
                <label className="form-field">
                  <span className="form-field__label">Short-Term APR % (≤ 12m)</span>
                  <input
                    type="number"
                    step="0.01"
                    className="dashboard-input"
                    value={shortTermRate}
                    onChange={(e) => setShortTermRate(Number(e.target.value))}
                    min="0"
                    required
                  />
                </label>
                <label className="form-field">
                  <span className="form-field__label">Long-Term APR % (&gt; 12m)</span>
                  <input
                    type="number"
                    step="0.01"
                    className="dashboard-input"
                    value={longTermRate}
                    onChange={(e) => setLongTermRate(Number(e.target.value))}
                    min="0"
                    required
                  />
                </label>
              </div>

              <div className="product-inline-row is-three">
                <label className="form-field">
                  <span className="form-field__label">Individual Flat APR %</span>
                  <input
                    type="number"
                    step="0.01"
                    className="dashboard-input"
                    value={individualRate}
                    onChange={(e) => setIndividualRate(Number(e.target.value))}
                    min="0"
                    required
                  />
                </label>
                <label className="form-field">
                  <span className="form-field__label">Salary Earner APR %</span>
                  <input
                    type="number"
                    step="0.01"
                    className="dashboard-input"
                    value={salaryEarnerRate}
                    onChange={(e) => setSalaryEarnerRate(Number(e.target.value))}
                    min="0"
                    required
                  />
                </label>
                <label className="form-field">
                  <span className="form-field__label">Business APR %</span>
                  <input
                    type="number"
                    step="0.01"
                    className="dashboard-input"
                    value={businessRate}
                    onChange={(e) => setBusinessRate(Number(e.target.value))}
                    min="0"
                    required
                  />
                </label>
              </div>

              <label className="form-field">
                <span className="form-field__label">Available Tenures (Months, comma-separated)</span>
                <input
                  type="text"
                  className="dashboard-input"
                  value={tenuresInput}
                  onChange={(e) => setTenuresInput(e.target.value)}
                  placeholder="3, 6, 12, 24"
                  required
                />
              </label>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Advanced Operation Settings" description="Set credit policies, fees, and guarantor requirements." />
            <div className="detail-panel__stack">
              <div className="product-inline-row is-two">
                <label className="form-field">
                  <span className="form-field__label">Max Finance Amount (NGN)</span>
                  <input
                    type="number"
                    className="dashboard-input"
                    value={maxFinanceAmount}
                    onChange={(e) => setMaxFinanceAmount(Number(e.target.value))}
                    min="0"
                    required
                  />
                </label>
                <label className="form-field">
                  <span className="form-field__label">Min Salary (Monthly NGN)</span>
                  <input
                    type="number"
                    className="dashboard-input"
                    value={minSalaryAmount}
                    onChange={(e) => setMinSalaryAmount(Number(e.target.value))}
                    min="0"
                    required
                  />
                </label>
              </div>

              <div className="product-inline-row is-two">
                <label className="form-field">
                  <span className="form-field__label">Require Guarantor</span>
                  <select
                    className="dashboard-input"
                    value={requireGuarantor ? "true" : "false"}
                    onChange={(e) => setRequireGuarantor(e.target.value === "true")}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-field__label">Guarantor Min Salary (NGN)</span>
                  <input
                    type="number"
                    className="dashboard-input"
                    value={guarantorMinSalary}
                    onChange={(e) => setGuarantorMinSalary(Number(e.target.value))}
                    min="0"
                    disabled={!requireGuarantor}
                    required
                  />
                </label>
              </div>

              <div className="product-inline-row is-three">
                <label className="form-field">
                  <span className="form-field__label">Admin Fee (%)</span>
                  <input
                    type="number"
                    step="0.1"
                    className="dashboard-input"
                    value={adminFeePct}
                    onChange={(e) => setAdminFeePct(Number(e.target.value))}
                    min="0"
                    required
                  />
                </label>
                <label className="form-field">
                  <span className="form-field__label">Insurance Fee (%)</span>
                  <input
                    type="number"
                    step="0.1"
                    className="dashboard-input"
                    value={insuranceFeePct}
                    onChange={(e) => setInsuranceFeePct(Number(e.target.value))}
                    min="0"
                    required
                  />
                </label>
                <label className="form-field">
                  <span className="form-field__label">Late Payment Fee (%)</span>
                  <input
                    type="number"
                    step="0.1"
                    className="dashboard-input"
                    value={latePaymentFeePct}
                    onChange={(e) => setLatePaymentFeePct(Number(e.target.value))}
                    min="0"
                    required
                  />
                </label>
              </div>

              <label className="form-field">
                <span className="form-field__label">Allowed Collateral Types (Comma separated)</span>
                <input
                  type="text"
                  className="dashboard-input"
                  value={allowedCollateral}
                  onChange={(e) => setAllowedCollateral(e.target.value)}
                  required
                />
              </label>
            </div>
          </Panel>
        </div>

        <div className="mt-8 flex justify-end">
          <Button type="submit" variant="primary" size="md" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Financing Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
