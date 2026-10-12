"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, Panel, PanelHeader, cx } from "@/components/dashboard/ui";
import { CheckCircleIcon, SearchIcon, TruckIcon } from "@/components/dashboard/icons";
import { useToast } from "@/components/ui/toast";
import { dashboardGet, submitDashboardForm } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";

type StateRule = {
  all_cities_free: boolean;
  free_cities: string[];
};

type WeightTier = {
  name: string;
  max_kg: number | null;
  surcharge: number;
};

type DeliverySettings = {
  universal_fee: number;
  currency: string;
  free_shipping_threshold?: number;
  weight_tiers?: Record<string, WeightTier>;
  state_rules: Record<string, StateRule>;
};

const DEFAULT_WEIGHT_TIERS: Record<string, WeightTier> = {
  under_5kg: { name: "Small Item (Under 5kg)", max_kg: 5, surcharge: 0 },
  "5_15kg": { name: "Medium Parcel (5kg – 15kg)", max_kg: 15, surcharge: 4000 },
  "15_30kg": { name: "Heavy Parcel (15kg – 30kg)", max_kg: 30, surcharge: 9000 },
  over_30kg: { name: "Freight / Oversized (> 30kg)", max_kg: null, surcharge: 18000 },
};

const INITIAL_SETTINGS: DeliverySettings = {
  universal_fee: 16000,
  currency: "NGN",
  free_shipping_threshold: 1500000,
  weight_tiers: DEFAULT_WEIGHT_TIERS,
  state_rules: {
    Lagos: { all_cities_free: true, free_cities: [] },
    "Federal Capital Territory": { all_cities_free: true, free_cities: [] },
  },
};

const FALLBACK_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Federal Capital Territory",
  "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers",
  "Sokoto", "Taraba", "Yobe", "Zamfara",
];

const FALLBACK_CITIES: Record<string, string[]> = {
  Lagos: ["Agege", "Ajah", "Alimosho", "Badagry", "Epe", "Ibeju-Lekki", "Ikeja", "Ikorodu", "Lekki", "Surulere", "Victoria Island"],
  "Federal Capital Territory": ["Abaji", "Abuja", "Bwari", "Gwagwalada", "Kuje", "Kwali", "Maitama", "Wuse"],
};

function money(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value || 0);
}

function stateRuleKey(state: string, rules: Record<string, StateRule>) {
  if (rules[state]) return state;

  const withoutSuffix = state.replace(/\s+State$/i, "");
  if (rules[withoutSuffix]) return withoutSuffix;

  const withSuffix = `${state} State`;
  if (rules[withSuffix]) return withSuffix;

  return withoutSuffix;
}

function displayStateName(state: string) {
  if (state === "Federal Capital Territory") return "Abuja (FCT)";
  return state.replace(/\s+State$/i, "");
}

export default function DeliverySettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<DeliverySettings>(INITIAL_SETTINGS);
  const [states, setStates] = useState(FALLBACK_STATES);
  const [selectedState, setSelectedState] = useState("Lagos");
  const [citiesByState, setCitiesByState] = useState<Record<string, string[]>>(FALLBACK_CITIES);
  const [stateSearch, setStateSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/locations/nigeria")
      .then((response) => response.json())
      .then((payload) => {
        if (Array.isArray(payload.data) && payload.data.length) setStates(payload.data);
      })
      .catch(() => undefined);

    dashboardGet<{ data?: DeliverySettings }>("/api/v1/admin/settings/delivery")
      .then((payload) => {
        if (payload.data) {
          setSettings({
            ...payload.data,
            weight_tiers: payload.data.weight_tiers || DEFAULT_WEIGHT_TIERS,
            free_shipping_threshold: payload.data.free_shipping_threshold ?? 1500000,
          });
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (citiesByState[selectedState]?.length) return;
    setIsLoadingCities(true);
    fetch(`/api/locations/nigeria?state=${encodeURIComponent(selectedState)}`)
      .then((response) => response.json())
      .then((payload) => {
        if (Array.isArray(payload.data)) {
          setCitiesByState((current) => ({ ...current, [selectedState]: payload.data }));
        }
      })
      .catch(() => undefined)
      .finally(() => setIsLoadingCities(false));
  }, [citiesByState, selectedState]);

  const selectedStateRuleKey = stateRuleKey(selectedState, settings.state_rules);
  const currentRule = settings.state_rules[selectedStateRuleKey] ?? { all_cities_free: false, free_cities: [] };
  const cities = citiesByState[selectedState] ?? [];
  const visibleStates = states.filter((state) => state.toLowerCase().includes(stateSearch.toLowerCase().trim()));
  const visibleCities = cities.filter((city) => city.toLowerCase().includes(citySearch.toLowerCase().trim()));
  const freeStateCount = useMemo(
    () => Object.values(settings.state_rules).filter((rule) => rule.all_cities_free).length,
    [settings.state_rules],
  );

  function updateRule(next: StateRule) {
    setSettings((current) => ({
      ...current,
      state_rules: { ...current.state_rules, [stateRuleKey(selectedState, current.state_rules)]: next },
    }));
  }

  function toggleCity(city: string) {
    const selected = currentRule.free_cities.includes(city);
    updateRule({
      all_cities_free: false,
      free_cities: selected
        ? currentRule.free_cities.filter((item) => item !== city)
        : [...currentRule.free_cities, city].sort(),
    });
  }

  function updateWeightTierSurcharge(key: string, surcharge: number) {
    setSettings((current) => ({
      ...current,
      weight_tiers: {
        ...(current.weight_tiers || DEFAULT_WEIGHT_TIERS),
        [key]: {
          ...(current.weight_tiers?.[key] || DEFAULT_WEIGHT_TIERS[key]!),
          surcharge,
        },
      },
    }));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      await submitDashboardForm("/api/v1/admin/settings/delivery", settings);
      toast({
        title: "Delivery settings saved",
        description: "Universal fee, weight-band surcharges, and state delivery rules were updated successfully.",
        variant: "success",
      });
    } catch (error) {
      toast({ title: "Could not save delivery settings", description: getErrorMessage(error), variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  const weightTiers = settings.weight_tiers || DEFAULT_WEIGHT_TIERS;

  return (
    <form className="dashboard-stack" onSubmit={handleSave}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#edf8ed] px-3 py-1 text-xs font-bold text-[#168416]">
            <TruckIcon className="h-4 w-4" /> Park-to-Park Waybill Logistics
          </div>
          <h2 className="section-title">Delivery & Logistics Settings</h2>
          <p className="section-description">
            Configure the universal waybill base rate, weight-band cargo surcharges, and free-delivery coverage rules.
          </p>
        </div>
        <Button type="submit" variant="primary" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Panel className="p-5">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Universal Base Fee</p>
          <p className="mb-0 mt-2 text-2xl font-extrabold text-[var(--text)]">{money(settings.universal_fee)}</p>
          <p className="mb-0 mt-1 text-xs text-[var(--text-soft)]">Standard inter-state terminal cargo</p>
        </Panel>
        <Panel className="p-5">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Free Shipping Order Cap</p>
          <p className="mb-0 mt-2 text-2xl font-extrabold text-[var(--text)]">
            {settings.free_shipping_threshold && settings.free_shipping_threshold > 0
              ? money(settings.free_shipping_threshold)
              : "Disabled"}
          </p>
          <p className="mb-0 mt-1 text-xs text-[var(--text-soft)]">Orders over this value ship free</p>
        </Panel>
        <Panel className="p-5">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">States Fully Exempt</p>
          <p className="mb-0 mt-2 text-2xl font-extrabold text-[var(--text)]">{freeStateCount}</p>
          <p className="mb-0 mt-1 text-xs text-[var(--text-soft)]">All cities receive complimentary delivery</p>
        </Panel>
        <Panel className="p-5">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Weight Tiers</p>
          <p className="mb-0 mt-2 text-lg font-extrabold text-[var(--text)]">4 Active Tiers</p>
          <p className="mb-0 mt-1 text-xs text-[var(--text-soft)]">Tiered by cargo weight band</p>
        </Panel>
      </div>

      {/* Universal Base Rate & Free Shipping Threshold */}
      <Panel>
        <PanelHeader
          title="Universal Rates & Promotion Thresholds"
          description="Base charges applied when a product is dispatched via commercial motor park waybill."
        />
        <div className="grid gap-6 p-6 sm:grid-cols-2">
          <label className="form-field">
            <span className="form-field__label font-semibold">Universal Base Waybill Fee (₦) *</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--text-soft)]">₦</span>
              <input
                className="dashboard-input"
                style={{ paddingLeft: 40 }}
                type="number"
                min="0"
                step="100"
                value={settings.universal_fee}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, universal_fee: Number(event.target.value) || 0 }))
                }
              />
            </div>
            <span className="mt-1 text-xs text-[var(--text-soft)]">
              The baseline waybill cargo fee charged for customer station pickup.
            </span>
          </label>

          <label className="form-field">
            <span className="form-field__label font-semibold">Free Delivery Order Threshold (₦)</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--text-soft)]">₦</span>
              <input
                className="dashboard-input"
                style={{ paddingLeft: 40 }}
                type="number"
                min="0"
                step="10000"
                value={settings.free_shipping_threshold ?? 0}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    free_shipping_threshold: Number(event.target.value) || 0,
                  }))
                }
              />
            </div>
            <span className="mt-1 text-xs text-[var(--text-soft)]">
              Orders whose subtotal meets or exceeds this amount automatically receive complimentary waybill delivery. Set to 0 to disable.
            </span>
          </label>
        </div>
      </Panel>

      {/* Weight Band Tiers & Cargo Surcharges */}
      <Panel>
        <PanelHeader
          title="Park-to-Park Weight Band Tiers"
          description="Surcharges added to the universal base rate according to the physical weight band of products in the basket."
        />
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(weightTiers).map(([key, tier]) => (
            <div key={key} className="rounded-xl border border-[var(--field-border)] bg-[var(--surface-muted)] p-4">
              <span className="block text-sm font-bold text-[var(--text)]">{tier.name}</span>
              <span className="text-xs text-[var(--text-soft)]">
                {tier.max_kg ? `Up to ${tier.max_kg}kg max parcel weight` : "Heavier than 30kg (Palletised / Freight)"}
              </span>
              <div className="mt-3">
                <label className="text-xs font-semibold text-[var(--text-soft)] block mb-1">
                  Tier Surcharge (₦)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--text-soft)]">₦</span>
                  <input
                    className="dashboard-input text-sm"
                    style={{ paddingLeft: 30 }}
                    type="number"
                    min="0"
                    step="500"
                    value={tier.surcharge}
                    onChange={(e) => updateWeightTierSurcharge(key, Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="mt-2 text-[11px] text-[var(--text-faint)]">
                Total for this tier: {money(settings.universal_fee + tier.surcharge)}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* State & City Free-Delivery Rules */}
      <Panel className="overflow-hidden">
        <PanelHeader
          title="State & Regional Free Delivery Coverage"
          description="Designate specific states or metropolitan cities where delivery is complimentary (e.g. local warehouse proximity)."
        />
        <div className="grid min-h-[570px] lg:grid-cols-[320px_1fr]">
          <aside className="border-b border-[var(--border)] bg-[var(--surface-muted)] p-5 lg:border-b-0 lg:border-r">
            <h3 className="m-0 text-base font-bold text-[var(--text)]">States</h3>
            <p className="mb-4 mt-1 text-xs text-[var(--text-soft)]">Select a state to manage its coverage.</p>
            <div className="relative mb-4">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
              <input
                className="dashboard-input"
                style={{ paddingLeft: 40 }}
                value={stateSearch}
                onChange={(event) => setStateSearch(event.target.value)}
                placeholder="Search states..."
              />
            </div>
            <div className="max-h-[440px] space-y-1 overflow-y-auto pr-1">
              {visibleStates.map((state) => {
                const rule = settings.state_rules[stateRuleKey(state, settings.state_rules)];
                const label = rule?.all_cities_free
                  ? "All cities free"
                  : rule?.free_cities.length
                    ? `${rule.free_cities.length} cities free`
                    : "Standard waybill";
                return (
                  <button
                    key={state}
                    type="button"
                    onClick={() => {
                      setSelectedState(state);
                      setCitySearch("");
                    }}
                    className={cx(
                      "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition",
                      selectedStateRuleKey === stateRuleKey(state, settings.state_rules)
                        ? "bg-[var(--surface)] shadow-sm ring-1 ring-[var(--field-border)]"
                        : "hover:bg-[var(--surface)]",
                    )}
                  >
                    <span className="text-sm font-semibold text-[var(--text)]">{displayStateName(state)}</span>
                    <span
                      className={cx(
                        "text-[10px] font-bold",
                        rule?.all_cities_free ? "text-[var(--brand)]" : "text-[var(--text-faint)]",
                      )}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="p-5 sm:p-7">
            <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="m-0 text-lg font-extrabold text-[var(--text)]">{displayStateName(selectedState)}</h3>
                <p className="mb-0 mt-1 text-sm text-[var(--text-soft)]">Choose all cities or customise specific free-delivery zones.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={currentRule.all_cities_free}
                onClick={() =>
                  updateRule({
                    all_cities_free: !currentRule.all_cities_free,
                    free_cities: currentRule.free_cities,
                  })
                }
                className="flex items-center gap-3 rounded-xl border border-[var(--field-border)] bg-[var(--surface)] px-4 py-3 text-left"
              >
                <span
                  className={cx(
                    "relative h-6 w-11 rounded-full transition",
                    currentRule.all_cities_free ? "bg-[#168416]" : "bg-[#d0d5dd]",
                  )}
                >
                  <span
                    className={cx(
                      "absolute top-1 h-4 w-4 rounded-full bg-white shadow transition",
                      currentRule.all_cities_free ? "left-6" : "left-1",
                    )}
                  />
                </span>
                <span>
                  <strong className="block text-sm text-[var(--text)]">All cities are free</strong>
                  <small className="text-[var(--text-soft)]">Complimentary delivery across the state</small>
                </span>
              </button>
            </div>

            {currentRule.all_cities_free ? (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[color:rgba(4,138,5,0.28)] bg-[var(--brand-soft)] p-5">
                <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
                <div>
                  <strong className="text-sm text-[var(--brand)]">
                    Complimentary delivery across {displayStateName(selectedState)}
                  </strong>
                  <p className="mb-0 mt-1 text-sm text-[var(--text-soft)]">
                    Every order destined for this state receives free delivery regardless of cargo weight band.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full max-w-md">
                    <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
                    <input
                      className="dashboard-input"
                      style={{ paddingLeft: 40 }}
                      value={citySearch}
                      onChange={(event) => setCitySearch(event.target.value)}
                      placeholder={`Search cities in ${displayStateName(selectedState)}`}
                    />
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-soft)]">
                    {currentRule.free_cities.length} of {cities.length} cities free
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {isLoadingCities ? (
                    <p className="text-sm text-[var(--text-soft)]">Loading cities...</p>
                  ) : (
                    visibleCities.map((city) => {
                      const checked = currentRule.free_cities.includes(city);
                      return (
                        <label
                          key={city}
                          className={cx(
                            "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition",
                            checked
                              ? "border-[color:rgba(4,138,5,0.38)] bg-[var(--brand-soft)]"
                              : "border-[var(--border)] hover:border-[var(--field-border-hover)]",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#168416]"
                            checked={checked}
                            onChange={() => toggleCity(city)}
                          />
                          <span className="text-sm font-semibold text-[var(--text)]">{city}</span>
                        </label>
                      );
                    })
                  )}
                </div>
                {!isLoadingCities && !visibleCities.length && (
                  <div className="mt-8 rounded-xl border border-dashed border-[var(--field-border)] p-8 text-center text-sm text-[var(--text-soft)]">
                    No matching cities found in {displayStateName(selectedState)}.
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </Panel>
    </form>
  );
}
