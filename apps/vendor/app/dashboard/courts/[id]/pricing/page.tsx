"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../../components/layout/Header";
import Modal from "../../../../../components/ui/Modal";
import { apiFetch } from "../../../../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdjType = "PERCENTAGE_INCREASE" | "PERCENTAGE_DECREASE" | "FIXED_INCREASE" | "FIXED_DECREASE" | "FIXED_PRICE";
type RuleType = "TIME_OF_DAY" | "DAY_OF_WEEK" | "PEAK_HOURS" | "SEASONAL" | "EARLY_BIRD";
type OverrideType = "CUSTOM_PRICE" | "BLOCKED" | "FREE";

interface PricingRule {
  id: string;
  name: string;
  type: RuleType;
  daysOfWeek: number[];
  startTime: string | null;
  endTime: string | null;
  adjustmentType: AdjType;
  adjustmentValue: number;
  priority: number;
  isActive: boolean;
  description: string;
}

interface DateOverride {
  id: string;
  date: string;
  type: OverrideType;
  customPriceCAD: number | null;
  reason: string | null;
}

interface PreviewSlot {
  startTime: string;
  endTime: string;
  basePriceCAD: number;
  finalPriceCAD: number;
  appliedRule: string | null;
  isBlocked: boolean;
}

interface PreviewDay { date: string; slots: PreviewSlot[] }

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const QUICK_TEMPLATES = [
  {
    id: "weekday_peak",
    icon: "⚡",
    label: "Weekday Peak",
    description: "Mon–Fri 5PM–11PM",
    name: "Weekday Peak",
    type: "PEAK_HOURS" as RuleType,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: "17:00",
    endTime: "23:00",
    adjustmentType: "PERCENTAGE_INCREASE" as AdjType,
    priority: 5,
    presets: [10, 20, 30, 50],
  },
  {
    id: "weekend_premium",
    icon: "🌅",
    label: "Weekend Premium",
    description: "Sat–Sun all day",
    name: "Weekend Premium",
    type: "DAY_OF_WEEK" as RuleType,
    daysOfWeek: [0, 6],
    startTime: "",
    endTime: "",
    adjustmentType: "PERCENTAGE_INCREASE" as AdjType,
    priority: 4,
    presets: [10, 20, 30, 50],
  },
  {
    id: "early_bird",
    icon: "🌙",
    label: "Early Bird Discount",
    description: "Mon–Sun 6AM–9AM",
    name: "Early Bird Discount",
    type: "EARLY_BIRD" as RuleType,
    daysOfWeek: [],
    startTime: "06:00",
    endTime: "09:00",
    adjustmentType: "PERCENTAGE_DECREASE" as AdjType,
    priority: 3,
    presets: [10, 15, 20, 25],
  },
  {
    id: "off_peak",
    icon: "☀️",
    label: "Off-Peak Discount",
    description: "Mon–Fri 10AM–4PM",
    name: "Off-Peak Discount",
    type: "TIME_OF_DAY" as RuleType,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: "10:00",
    endTime: "16:00",
    adjustmentType: "PERCENTAGE_DECREASE" as AdjType,
    priority: 2,
    presets: [10, 15, 20],
  },
] as const;

type QuickTemplate = typeof QUICK_TEMPLATES[number];

const adjTypeLabels: Record<AdjType, string> = {
  PERCENTAGE_INCREASE: "% Increase",
  PERCENTAGE_DECREASE: "% Decrease",
  FIXED_INCREASE: "Fixed +",
  FIXED_DECREASE: "Fixed -",
  FIXED_PRICE: "Override to",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rulePreview(base: number, adjType: AdjType, adjValue: number): string {
  if (!adjValue || !base) return "";
  let final = base;
  if (adjType === "PERCENTAGE_INCREASE") final = base * (1 + adjValue / 100);
  else if (adjType === "PERCENTAGE_DECREASE") final = Math.max(0, base * (1 - adjValue / 100));
  else if (adjType === "FIXED_INCREASE") final = base + adjValue;
  else if (adjType === "FIXED_DECREASE") final = Math.max(0, base - adjValue);
  else if (adjType === "FIXED_PRICE") final = adjValue;
  const sign = final >= base ? "+" : "";
  const diff = final - base;
  return `C$${base.toFixed(2)} → C$${final.toFixed(2)} (${sign}${diff >= 0 ? "" : ""}${((diff / base) * 100).toFixed(0)}%)`;
}

function adjLabel(adjType: AdjType, value: number): string {
  if (adjType === "PERCENTAGE_INCREASE") return `+${value}%`;
  if (adjType === "PERCENTAGE_DECREASE") return `-${value}%`;
  if (adjType === "FIXED_INCREASE") return `+C$${value}`;
  if (adjType === "FIXED_DECREASE") return `-C$${value}`;
  return `C$${value}`;
}

function previewSlotColor(slot: PreviewSlot): string {
  if (slot.isBlocked) return "bg-zinc-800 text-zinc-500";
  if (slot.finalPriceCAD < slot.basePriceCAD) return "bg-green-900/40 text-green-300";
  if (slot.finalPriceCAD > slot.basePriceCAD) return "bg-amber-900/40 text-amber-300";
  return "bg-surface-2 text-muted";
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={enabled}
      className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled ? "bg-primary" : "bg-gray-700"
      }`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : ""}`} />
    </button>
  );
}

// ─── Toast component ──────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-dome shadow-lg text-sm font-medium text-white ${
      type === "success" ? "bg-green-600" : "bg-red-600"
    }`}>
      <span>{type === "success" ? "✓" : "✕"}</span>
      {message}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const params = useParams<{ id: string }>();
  const courtId = params?.id ?? "";
  const router = useRouter();

  const [rules, setRules] = useState<PricingRule[]>([]);
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [basePriceCAD, setBasePriceCAD] = useState<number | null>(null);
  const [dynamicEnabled, setDynamicEnabled] = useState(false);
  const [preview, setPreview] = useState<PreviewDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");

  // Base price editing
  const [editingBasePrice, setEditingBasePrice] = useState("");
  const [savingBasePrice, setSavingBasePrice] = useState(false);

  // Dynamic pricing toggle
  const [togglingDynamic, setTogglingDynamic] = useState(false);

  // Quick setup per-template custom values
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Rule modal
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    name: "", type: "TIME_OF_DAY" as RuleType,
    daysOfWeek: [] as number[], startTime: "", endTime: "",
    adjustmentType: "PERCENTAGE_INCREASE" as AdjType,
    adjustmentValue: 0, priority: 0,
  });

  // Override modal
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideType, setOverrideType] = useState<OverrideType>("CUSTOM_PRICE");
  const [overridePrice, setOverridePrice] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!courtId) return;
    setIsLoading(true);
    try {
      const data = await apiFetch<{
        data: {
          basePriceCAD: number | null;
          dynamicPricingEnabled: boolean;
          rules: PricingRule[];
          overrides: DateOverride[];
        };
      }>(`/vendor/courts/${courtId}/pricing`);
      setBasePriceCAD(data.data.basePriceCAD);
      setEditingBasePrice(data.data.basePriceCAD?.toFixed(2) ?? "");
      setDynamicEnabled(data.data.dynamicPricingEnabled);
      setRules(data.data.rules);
      setOverrides(data.data.overrides);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [courtId]);

  const loadPreview = useCallback(async () => {
    if (!courtId) return;
    setPreviewLoading(true);
    try {
      const data = await apiFetch<{ data: PreviewDay[] }>(
        `/vendor/courts/${courtId}/pricing/preview`,
        { method: "POST" }
      );
      setPreview(data.data);
    } catch { /* preview is best-effort */ }
    finally { setPreviewLoading(false); }
  }, [courtId]);

  useEffect(() => { load(); loadPreview(); }, [load, loadPreview]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function saveBasePrice() {
    const price = parseFloat(editingBasePrice);
    if (isNaN(price) || price <= 0) { showToast("Enter a valid price", "error"); return; }
    setSavingBasePrice(true);
    try {
      await apiFetch(`/vendor/courts/${courtId}/pricing/base-price`, {
        method: "PUT",
        body: JSON.stringify({ priceCAD: price }),
      });
      setBasePriceCAD(price);
      showToast("Base price saved");
      loadPreview();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSavingBasePrice(false);
    }
  }

  async function toggleDynamicPricing() {
    setTogglingDynamic(true);
    const next = !dynamicEnabled;
    try {
      await apiFetch(`/vendor/courts/${courtId}/pricing/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: next }),
      });
      setDynamicEnabled(next);
      showToast(`Dynamic pricing ${next ? "enabled" : "disabled"}`);
      loadPreview();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Toggle failed", "error");
    } finally {
      setTogglingDynamic(false);
    }
  }

  async function applyPreset(template: QuickTemplate, value: number) {
    if (!dynamicEnabled) return;
    const key = `${template.id}_${value}`;
    setApplyingPreset(key);
    const existing = rules.find((r) => r.name === template.name);
    try {
      if (existing && existing.adjustmentValue === value) {
        await apiFetch(`/vendor/courts/${courtId}/pricing/rules/${existing.id}`, { method: "DELETE" });
        showToast(`${template.label} rule removed`);
      } else if (existing) {
        await apiFetch(`/vendor/courts/${courtId}/pricing/rules/${existing.id}`, {
          method: "PUT",
          body: JSON.stringify({ adjustmentValue: value }),
        });
        showToast(`${template.label} set to ${adjLabel(template.adjustmentType, value)}`);
      } else {
        await apiFetch(`/vendor/courts/${courtId}/pricing/rules`, {
          method: "POST",
          body: JSON.stringify({
            name: template.name,
            type: template.type,
            daysOfWeek: template.daysOfWeek,
            startTime: template.startTime || undefined,
            endTime: template.endTime || undefined,
            adjustmentType: template.adjustmentType,
            adjustmentValue: value,
            priority: template.priority,
          }),
        });
        showToast(`${template.label} set to ${adjLabel(template.adjustmentType, value)}`);
      }
      await Promise.all([load(), loadPreview()]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to apply rule", "error");
    } finally {
      setApplyingPreset(null);
    }
  }

  async function applyCustomPreset(template: QuickTemplate) {
    const raw = customValues[template.id] ?? "";
    const value = parseFloat(raw);
    if (isNaN(value) || value <= 0 || value > 300) {
      showToast("Enter a value between 1 and 300", "error"); return;
    }
    await applyPreset(template, value);
    setCustomValues((prev) => ({ ...prev, [template.id]: "" }));
  }

  function openAddRule() {
    setEditingRule(null);
    setRuleForm({ name: "", type: "TIME_OF_DAY", daysOfWeek: [], startTime: "", endTime: "", adjustmentType: "PERCENTAGE_INCREASE", adjustmentValue: 0, priority: 0 });
    setRuleModalOpen(true);
  }

  function openEditRule(rule: PricingRule) {
    setEditingRule(rule);
    setRuleForm({ name: rule.name, type: rule.type, daysOfWeek: rule.daysOfWeek, startTime: rule.startTime ?? "", endTime: rule.endTime ?? "", adjustmentType: rule.adjustmentType, adjustmentValue: rule.adjustmentValue, priority: rule.priority });
    setRuleModalOpen(true);
  }

  async function saveRule() {
    setRuleSaving(true);
    try {
      const body = {
        name: ruleForm.name,
        type: ruleForm.type,
        daysOfWeek: ruleForm.daysOfWeek,
        startTime: ruleForm.startTime || undefined,
        endTime: ruleForm.endTime || undefined,
        adjustmentType: ruleForm.adjustmentType,
        adjustmentValue: ruleForm.adjustmentValue,
        priority: ruleForm.priority,
      };
      if (editingRule) {
        await apiFetch(`/vendor/courts/${courtId}/pricing/rules/${editingRule.id}`, { method: "PUT", body: JSON.stringify(body) });
        showToast("Rule updated");
      } else {
        await apiFetch(`/vendor/courts/${courtId}/pricing/rules`, { method: "POST", body: JSON.stringify(body) });
        showToast("Rule created");
      }
      setRuleModalOpen(false);
      await Promise.all([load(), loadPreview()]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setRuleSaving(false);
    }
  }

  async function deleteRule(id: string) {
    if (!confirm("Delete this pricing rule?")) return;
    try {
      await apiFetch(`/vendor/courts/${courtId}/pricing/rules/${id}`, { method: "DELETE" });
      showToast("Rule deleted");
      await Promise.all([load(), loadPreview()]);
    } catch (e) { showToast(e instanceof Error ? e.message : "Delete failed", "error"); }
  }

  async function toggleRule(id: string) {
    try {
      await apiFetch(`/vendor/courts/${courtId}/pricing/rules/${id}/toggle`, { method: "PATCH" });
      setRules((prev) => prev.map((r) => r.id === id ? { ...r, isActive: !r.isActive } : r));
    } catch (e) { showToast(e instanceof Error ? e.message : "Toggle failed", "error"); }
  }

  async function saveOverride() {
    setOverrideSaving(true);
    try {
      await apiFetch(`/vendor/courts/${courtId}/pricing/overrides`, {
        method: "POST",
        body: JSON.stringify({
          date: overrideDate,
          type: overrideType,
          customPriceCAD: overrideType === "CUSTOM_PRICE" && overridePrice ? Number(overridePrice) : undefined,
          reason: overrideReason || undefined,
        }),
      });
      showToast("Override saved");
      setOverrideModalOpen(false);
      setOverrideDate(""); setOverridePrice(""); setOverrideReason("");
      await Promise.all([load(), loadPreview()]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setOverrideSaving(false);
    }
  }

  async function deleteOverride(id: string) {
    try {
      await apiFetch(`/vendor/courts/${courtId}/pricing/overrides/${id}`, { method: "DELETE" });
      showToast("Override removed");
      await Promise.all([load(), loadPreview()]);
    } catch (e) { showToast(e instanceof Error ? e.message : "Delete failed", "error"); }
  }

  function toggleDay(day: number) {
    setRuleForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day) ? f.daysOfWeek.filter((d) => d !== day) : [...f.daysOfWeek, day],
    }));
  }

  // ─── Styles ────────────────────────────────────────────────────────────────

  const inputCls = "w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors";
  const selectCls = inputCls + " cursor-pointer";
  const cardCls = "bg-surface border border-border rounded-dome p-5";
  const sectionHeading = "text-xs font-semibold text-muted uppercase tracking-widest mb-4";

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) return (
    <>
      <Header title="Pricing" />
      <main className="flex-1 p-6">
        <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-surface border border-border rounded-dome animate-pulse" />)}</div>
      </main>
    </>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Header title="Court Pricing" />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-5">

          {/* Back + error */}
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="text-sm text-muted hover:text-white transition-colors">
              ← Back to Court
            </button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
            {/* ── Left column ── */}
            <div className="space-y-5">

              {/* BASE PRICE */}
              <div className={cardCls}>
                <h2 className={sectionHeading}>Base Price</h2>
                <div className="flex items-end gap-3">
                  <div className="flex-1 max-w-[180px]">
                    <label className="block text-xs text-muted mb-1">Price per slot</label>
                    <div className="flex items-center border border-border rounded-dome overflow-hidden bg-black focus-within:border-primary transition-colors">
                      <span className="px-3 text-sm text-muted bg-surface border-r border-border">C$</span>
                      <input
                        type="number" min="0.01" step="0.01"
                        value={editingBasePrice}
                        onChange={(e) => setEditingBasePrice(e.target.value)}
                        placeholder="25.00"
                        className="flex-1 bg-transparent px-3 py-2 text-sm text-white focus:outline-none"
                      />
                      <span className="px-3 text-xs text-muted">/hr</span>
                    </div>
                  </div>
                  <button
                    onClick={saveBasePrice}
                    disabled={savingBasePrice}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-semibold rounded-dome transition-colors"
                  >
                    {savingBasePrice ? "Saving…" : "Save Base Price"}
                  </button>
                </div>
                <p className="text-xs text-muted mt-2">
                  Updates all available slots for this court. Dynamic pricing rules apply on top of this.
                </p>
              </div>

              {/* DYNAMIC PRICING TOGGLE */}
              <div className={cardCls}>
                <h2 className={sectionHeading}>Dynamic Pricing</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Enable Dynamic Pricing</p>
                    <p className="text-xs text-muted mt-0.5">Charge more during peak hours, less during off-peak</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold ${dynamicEnabled ? "text-primary" : "text-muted"}`}>
                      {dynamicEnabled ? "ON" : "OFF"}
                    </span>
                    <Toggle enabled={dynamicEnabled} onToggle={toggleDynamicPricing} disabled={togglingDynamic} />
                  </div>
                </div>

                {/* Status banner */}
                <div className={`mt-4 rounded-dome px-4 py-3 text-sm ${
                  dynamicEnabled
                    ? "bg-primary/10 border border-primary/20 text-primary"
                    : "bg-surface border border-border text-muted"
                }`}>
                  {dynamicEnabled
                    ? `⚡ Dynamic pricing is ON. Rules below are being applied to slot prices.`
                    : `All slots charged at C$${basePriceCAD?.toFixed(2) ?? "—"}/hr. Enable dynamic pricing to activate rules.`
                  }
                </div>
              </div>

              {/* QUICK SETUP */}
              <div className={`${cardCls} ${!dynamicEnabled ? "opacity-40 pointer-events-none select-none" : ""}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={sectionHeading.replace("mb-4", "mb-0")}>Quick Setup</h2>
                  {!dynamicEnabled && <span className="text-xs text-muted border border-border rounded px-2 py-0.5">Enable dynamic pricing to use</span>}
                </div>

                <div className="space-y-3">
                  {QUICK_TEMPLATES.map((template) => {
                    const existing = rules.find((r) => r.name === template.name);
                    const activeValue = existing?.adjustmentValue ?? null;

                    return (
                      <div key={template.id} className="border border-border rounded-dome p-4 bg-surface">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{template.icon} {template.label}</p>
                            <p className="text-xs text-muted mt-0.5">{template.description}</p>
                          </div>
                          {existing && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              template.adjustmentType === "PERCENTAGE_INCREASE"
                                ? "bg-amber-900/40 text-amber-400"
                                : "bg-green-900/40 text-green-400"
                            }`}>
                              {adjLabel(template.adjustmentType, existing.adjustmentValue)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {template.presets.map((pct) => {
                            const isActive = activeValue === pct;
                            const isLoading = applyingPreset === `${template.id}_${pct}`;
                            return (
                              <button
                                key={pct}
                                onClick={() => applyPreset(template, pct)}
                                disabled={isLoading}
                                className={`px-3 py-1.5 text-xs font-bold rounded-dome border transition-colors ${
                                  isActive
                                    ? "bg-primary border-primary text-white"
                                    : "border-border text-muted hover:border-primary hover:text-white bg-surface-2"
                                }`}
                              >
                                {isLoading ? "…" : `${template.adjustmentType === "PERCENTAGE_INCREASE" ? "+" : "-"}${pct}%`}
                              </button>
                            );
                          })}
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number" min="1" max="300" step="1"
                              value={customValues[template.id] ?? ""}
                              onChange={(e) => setCustomValues((prev) => ({ ...prev, [template.id]: e.target.value }))}
                              placeholder="Custom"
                              className="w-20 bg-black border border-border rounded-dome px-2 py-1.5 text-xs text-white placeholder:text-muted focus:outline-none focus:border-primary"
                            />
                            <span className="text-xs text-muted">%</span>
                            <button
                              onClick={() => applyCustomPreset(template)}
                              disabled={!customValues[template.id]}
                              className="px-2.5 py-1.5 text-xs font-semibold border border-border rounded-dome text-muted hover:border-primary hover:text-white disabled:opacity-40 transition-colors bg-surface-2"
                            >
                              Apply
                            </button>
                          </div>
                        </div>

                        {basePriceCAD !== null && activeValue !== null && (
                          <p className="text-xs text-muted mt-2">
                            {basePriceCAD.toFixed(2)} → C${
                              template.adjustmentType === "PERCENTAGE_INCREASE"
                                ? (basePriceCAD * (1 + activeValue / 100)).toFixed(2)
                                : Math.max(0, basePriceCAD * (1 - activeValue / 100)).toFixed(2)
                            }
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ACTIVE RULES */}
              <div className={`${cardCls} ${!dynamicEnabled ? "opacity-40" : ""}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={sectionHeading.replace("mb-4", "mb-0")}>
                    Active Rules
                    <span className="ml-2 normal-case text-[10px] bg-surface-2 text-muted px-1.5 py-0.5 rounded-full font-normal">
                      {rules.length}
                    </span>
                  </h2>
                  <button
                    onClick={openAddRule}
                    disabled={!dynamicEnabled}
                    className="text-xs font-semibold text-primary border border-primary/40 hover:border-primary rounded-dome px-3 py-1.5 transition-colors disabled:opacity-40"
                  >
                    + Add Custom Rule
                  </button>
                </div>

                {rules.length === 0 ? (
                  <p className="text-sm text-muted py-6 text-center">
                    {dynamicEnabled ? "No rules yet. Use Quick Setup above or add a custom rule." : "Enable dynamic pricing to add rules."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule) => {
                      const isIncrease = rule.adjustmentType.includes("INCREASE");
                      const adjStr = adjLabel(rule.adjustmentType, rule.adjustmentValue);
                      const previewStr = basePriceCAD !== null ? rulePreview(basePriceCAD, rule.adjustmentType, rule.adjustmentValue) : null;

                      return (
                        <div
                          key={rule.id}
                          className={`border border-border rounded-dome p-4 bg-surface-2 transition-opacity ${!rule.isActive ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-sm font-semibold text-white">{rule.name}</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                  isIncrease ? "bg-amber-900/40 text-amber-400" : "bg-green-900/40 text-green-400"
                                }`}>
                                  {adjStr}
                                </span>
                                {rule.priority > 0 && (
                                  <span className="text-xs text-muted border border-border px-1.5 py-0.5 rounded">P{rule.priority}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted">{rule.description}</p>
                              {previewStr && (
                                <p className="text-xs text-muted mt-1">{previewStr}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Toggle
                                enabled={rule.isActive}
                                onToggle={() => toggleRule(rule.id)}
                                disabled={!dynamicEnabled}
                              />
                              <button
                                onClick={() => openEditRule(rule)}
                                className="text-xs text-muted hover:text-white px-2.5 py-1 border border-border rounded-dome hover:border-primary/50 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteRule(rule.id)}
                                className="text-xs text-red-400 hover:text-red-300 px-2.5 py-1 border border-red-900/50 rounded-dome hover:border-red-700 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* DATE OVERRIDES */}
              <div className={cardCls}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={sectionHeading.replace("mb-4", "mb-0")}>Date Overrides</h2>
                  <button
                    onClick={() => setOverrideModalOpen(true)}
                    className="text-xs font-semibold text-primary border border-primary/40 hover:border-primary rounded-dome px-3 py-1.5 transition-colors"
                  >
                    + Add Override
                  </button>
                </div>

                {overrides.length === 0 ? (
                  <p className="text-sm text-muted py-6 text-center">
                    No date overrides. Block holidays, set custom prices, or offer free slots.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {overrides.map((o) => (
                      <div key={o.id} className="flex items-center justify-between py-3 gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{o.date}</p>
                          <p className="text-xs text-muted">
                            {o.type === "BLOCKED" ? "🚫 Blocked"
                              : o.type === "FREE" ? "🎁 Free"
                              : `💰 C$${o.customPriceCAD?.toFixed(2)}`}
                            {o.reason ? ` — ${o.reason}` : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteOverride(o.id)}
                          className="text-xs text-red-400 hover:text-red-300 px-2.5 py-1 border border-red-900/50 rounded-dome hover:border-red-700 transition-colors shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right column: Price preview ── */}
            <div className={`${cardCls} h-fit xl:sticky xl:top-6`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={sectionHeading.replace("mb-4", "mb-0")}>Price Preview</h2>
                {previewLoading && <span className="text-xs text-muted animate-pulse">Updating…</span>}
              </div>
              <p className="text-xs text-muted mb-4">How rules affect the next 7 days of slots</p>

              {/* Legend */}
              <div className="flex gap-3 mb-4 flex-wrap">
                {[
                  ["bg-surface-2 border border-border", "Base"],
                  ["bg-green-900/40 text-green-400", "Discount"],
                  ["bg-amber-900/40 text-amber-400", "Premium"],
                  ["bg-zinc-800 text-zinc-500", "Blocked"],
                ].map(([cls, label]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded ${cls}`} />
                    <span className="text-xs text-muted">{label}</span>
                  </div>
                ))}
              </div>

              {preview.length === 0 ? (
                <p className="text-sm text-muted py-8 text-center">
                  No slots found. Generate slots first to preview pricing.
                </p>
              ) : (
                <div className="space-y-4">
                  {preview.map((day) => (
                    <div key={day.date}>
                      <p className="text-xs font-semibold text-muted mb-1.5">
                        {new Date(day.date + "T12:00:00Z").toLocaleDateString("en-CA", {
                          weekday: "short", month: "short", day: "numeric",
                        })}
                      </p>
                      {day.slots.length === 0 ? (
                        <p className="text-xs text-muted italic pl-2">No slots</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {day.slots.map((slot) => (
                            <div
                              key={slot.startTime}
                              className={`px-2 py-1 rounded text-xs font-medium ${previewSlotColor(slot)}`}
                              title={slot.appliedRule ?? "Base price"}
                            >
                              {slot.startTime}
                              <span className="ml-1 font-bold">
                                {slot.isBlocked ? "×" : `C$${slot.finalPriceCAD.toFixed(0)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Custom Rule Modal ── */}
      <Modal
        open={ruleModalOpen}
        title={editingRule ? "Edit Pricing Rule" : "Add Pricing Rule"}
        confirmLabel={ruleSaving ? "Saving…" : editingRule ? "Save Changes" : "Create Rule"}
        isLoading={ruleSaving}
        onConfirm={saveRule}
        onCancel={() => setRuleModalOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Rule Name</label>
            <input
              type="text" value={ruleForm.name}
              onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Tournament Weekend"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-2">Days (empty = all days)</label>
            <div className="flex gap-1.5 flex-wrap">
              {ALL_DAYS.map((d) => (
                <button
                  key={d} type="button" onClick={() => toggleDay(d)}
                  className={`w-10 h-8 text-xs font-bold rounded-dome transition-colors ${
                    ruleForm.daysOfWeek.includes(d)
                      ? "bg-primary text-white"
                      : "bg-surface border border-border text-muted hover:text-white"
                  }`}
                >
                  {DAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Start Time (optional)</label>
              <input type="time" value={ruleForm.startTime}
                onChange={(e) => setRuleForm((f) => ({ ...f, startTime: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">End Time (optional)</label>
              <input type="time" value={ruleForm.endTime}
                onChange={(e) => setRuleForm((f) => ({ ...f, endTime: e.target.value }))}
                className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Adjustment Type</label>
              <select
                value={ruleForm.adjustmentType}
                onChange={(e) => setRuleForm((f) => ({ ...f, adjustmentType: e.target.value as AdjType }))}
                className={selectCls}
              >
                {(Object.entries(adjTypeLabels) as [AdjType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">
                Value ({["PERCENTAGE_INCREASE", "PERCENTAGE_DECREASE"].includes(ruleForm.adjustmentType) ? "%" : "C$"})
              </label>
              <input
                type="number" min="0" step="0.01"
                value={ruleForm.adjustmentValue || ""}
                onChange={(e) => setRuleForm((f) => ({ ...f, adjustmentValue: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Priority (0–100, higher wins)</label>
            <input
              type="number" min="0" max="100"
              value={ruleForm.priority}
              onChange={(e) => setRuleForm((f) => ({ ...f, priority: Number(e.target.value) }))}
              className={inputCls}
              style={{ maxWidth: 80 }}
            />
          </div>

          {basePriceCAD !== null && ruleForm.adjustmentValue > 0 && (
            <div className="bg-surface rounded-dome px-4 py-3 text-sm border border-border">
              <span className="text-muted">Preview: </span>
              <span className="font-bold text-white">
                {rulePreview(basePriceCAD, ruleForm.adjustmentType, ruleForm.adjustmentValue)}
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Override Modal ── */}
      <Modal
        open={overrideModalOpen}
        title="Add Date Override"
        confirmLabel={overrideSaving ? "Saving…" : "Save Override"}
        isLoading={overrideSaving}
        onConfirm={saveOverride}
        onCancel={() => {
          setOverrideModalOpen(false);
          setOverrideDate(""); setOverridePrice(""); setOverrideReason("");
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Date</label>
            <input
              type="date" value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
              className={inputCls + " [color-scheme:dark]"}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-2">Override Type</label>
            <div className="flex gap-2">
              {(["CUSTOM_PRICE", "BLOCKED", "FREE"] as OverrideType[]).map((t) => (
                <button
                  key={t} type="button" onClick={() => setOverrideType(t)}
                  className={`flex-1 py-2 text-xs font-bold rounded-dome border transition-colors ${
                    overrideType === t
                      ? "bg-primary border-primary text-white"
                      : "border-border text-muted hover:text-white"
                  }`}
                >
                  {t === "CUSTOM_PRICE" ? "💰 Custom" : t === "BLOCKED" ? "🚫 Block" : "🎁 Free"}
                </button>
              ))}
            </div>
          </div>
          {overrideType === "CUSTOM_PRICE" && (
            <div>
              <label className="block text-xs text-muted mb-1">Custom Price (C$)</label>
              <input
                type="number" min="0" step="0.01"
                value={overridePrice}
                onChange={(e) => setOverridePrice(e.target.value)}
                placeholder="e.g. 15.00"
                className={inputCls}
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-muted mb-1">Reason (optional)</label>
            <input
              type="text" value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder={overrideType === "BLOCKED" ? "e.g. Maintenance, Holiday" : "e.g. Grand opening"}
              className={inputCls}
            />
          </div>
        </div>
      </Modal>

      {/* ── Toast ── */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}
