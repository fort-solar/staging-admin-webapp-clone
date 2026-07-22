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

type DeliverySettings = {
  universal_fee: number;
  currency: string;
  state_rules: Record<string, StateRule>;
};

const INITIAL_SETTINGS: DeliverySettings = {
  universal_fee: 16000,
  currency: "NGN",
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
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
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

    dashboardGet<{ data?: DeliverySettings }>("/admin/settings/delivery")
      .then((payload) => {
        if (payload.data) setSettings(payload.data);
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

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      await submitDashboardForm("/admin/settings/delivery", settings);
      toast({ title: "Delivery settings saved", description: "Free-delivery coverage and the universal fee were updated.", variant: "success" });
    } catch (error) {
      toast({ title: "Could not save delivery settings", description: getErrorMessage(error), variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="dashboard-stack" onSubmit={handleSave}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#edf8ed] px-3 py-1 text-xs font-bold text-[#168416]">
            <TruckIcon className="h-4 w-4" /> Delivery coverage
          </div>
          <h2 className="section-title">Delivery settings</h2>
          <p className="section-description">Choose where delivery is free. Every other city automatically uses the universal delivery fee.</p>
        </div>
        <Button type="submit" variant="primary" disabled={isSaving}>{isSaving ? "Saving..." : "Save changes"}</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel className="p-5">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Universal fee</p>
          <p className="mb-0 mt-2 text-2xl font-extrabold text-[var(--text)]">{money(settings.universal_fee)}</p>
          <p className="mb-0 mt-1 text-xs text-[var(--text-soft)]">Applied to every non-free city</p>
        </Panel>
        <Panel className="p-5">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">States fully covered</p>
          <p className="mb-0 mt-2 text-2xl font-extrabold text-[var(--text)]">{freeStateCount}</p>
          <p className="mb-0 mt-1 text-xs text-[var(--text-soft)]">All cities receive free delivery</p>
        </Panel>
        <Panel className="p-5">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Coverage rule</p>
          <p className="mb-0 mt-2 text-lg font-extrabold text-[var(--text)]">City-level control</p>
          <p className="mb-0 mt-1 text-xs text-[var(--text-soft)]">Changes apply at checkout</p>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Default delivery fee" description="This fee applies whenever the customer's city is not selected for free delivery." />
        <div className="max-w-md px-6 pb-6">
          <label className="form-field">
            <span className="form-field__label">Universal fee (NGN)</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--text-soft)]">₦</span>
              <input className="dashboard-input" style={{ paddingLeft: 40 }} type="number" min="0" step="100" value={settings.universal_fee} onChange={(event) => setSettings((current) => ({ ...current, universal_fee: Number(event.target.value) }))} />
            </div>
          </label>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="grid min-h-[570px] lg:grid-cols-[320px_1fr]">
          <aside className="border-b border-[var(--border)] bg-[var(--surface-muted)] p-5 lg:border-b-0 lg:border-r">
            <h3 className="m-0 text-base font-bold text-[var(--text)]">States</h3>
            <p className="mb-4 mt-1 text-xs text-[var(--text-soft)]">Select a state to manage its cities.</p>
            <div className="relative mb-4">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
              <input className="dashboard-input" style={{ paddingLeft: 40 }} value={stateSearch} onChange={(event) => setStateSearch(event.target.value)} placeholder="Search states" />
            </div>
            <div className="max-h-[440px] space-y-1 overflow-y-auto pr-1">
              {visibleStates.map((state) => {
                const rule = settings.state_rules[stateRuleKey(state, settings.state_rules)];
                const label = rule?.all_cities_free ? "All cities free" : rule?.free_cities.length ? `${rule.free_cities.length} cities free` : "Standard fee";
                return (
                  <button key={state} type="button" onClick={() => { setSelectedState(state); setCitySearch(""); }} className={cx("flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition", selectedStateRuleKey === stateRuleKey(state, settings.state_rules) ? "bg-[var(--surface)] shadow-sm ring-1 ring-[var(--field-border)]" : "hover:bg-[var(--surface)]")}>
                    <span className="text-sm font-semibold text-[var(--text)]">{displayStateName(state)}</span>
                    <span className={cx("text-[10px] font-bold", rule?.all_cities_free ? "text-[var(--brand)]" : "text-[var(--text-faint)]")}>{label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="p-5 sm:p-7">
            <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="m-0 text-lg font-extrabold text-[var(--text)]">{displayStateName(selectedState)}</h3>
                <p className="mb-0 mt-1 text-sm text-[var(--text-soft)]">Choose all cities or create a custom free-delivery list.</p>
              </div>
              <button type="button" role="switch" aria-checked={currentRule.all_cities_free} onClick={() => updateRule({ all_cities_free: !currentRule.all_cities_free, free_cities: currentRule.free_cities })} className="flex items-center gap-3 rounded-xl border border-[var(--field-border)] bg-[var(--surface)] px-4 py-3 text-left">
                <span className={cx("relative h-6 w-11 rounded-full transition", currentRule.all_cities_free ? "bg-[#168416]" : "bg-[#d0d5dd]")}><span className={cx("absolute top-1 h-4 w-4 rounded-full bg-white shadow transition", currentRule.all_cities_free ? "left-6" : "left-1")} /></span>
                <span><strong className="block text-sm text-[var(--text)]">All cities are free</strong><small className="text-[var(--text-soft)]">One switch for the entire state</small></span>
              </button>
            </div>

            {currentRule.all_cities_free ? (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[color:rgba(4,138,5,0.28)] bg-[var(--brand-soft)] p-5">
                <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
                <div><strong className="text-sm text-[var(--brand)]">Free delivery across {displayStateName(selectedState)}</strong><p className="mb-0 mt-1 text-sm text-[var(--text-soft)]">Every current and newly added city in this state will receive free delivery.</p></div>
              </div>
            ) : (
              <>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full max-w-md">
                    <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
                    <input className="dashboard-input" style={{ paddingLeft: 40 }} value={citySearch} onChange={(event) => setCitySearch(event.target.value)} placeholder={`Search cities in ${displayStateName(selectedState)}`} />
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-soft)]">{currentRule.free_cities.length} of {cities.length} cities free</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {isLoadingCities ? <p className="text-sm text-[var(--text-soft)]">Loading cities...</p> : visibleCities.map((city) => {
                    const checked = currentRule.free_cities.includes(city);
                    return <label key={city} className={cx("flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition", checked ? "border-[color:rgba(4,138,5,0.38)] bg-[var(--brand-soft)]" : "border-[var(--border)] hover:border-[var(--field-border-hover)]")}><input type="checkbox" className="h-4 w-4 accent-[#168416]" checked={checked} onChange={() => toggleCity(city)} /><span className="text-sm font-semibold text-[var(--text)]">{city}</span></label>;
                  })}
                </div>
                {!isLoadingCities && !visibleCities.length && <div className="mt-8 rounded-xl border border-dashed border-[var(--field-border)] p-8 text-center text-sm text-[var(--text-soft)]">No matching cities found.</div>}
              </>
            )}
          </section>
        </div>
      </Panel>
    </form>
  );
}
