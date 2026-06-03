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

const TEMPLATES = [
  { label: "Weekday Peak", name: "Weekday Peak", type: "PEAK_HOURS" as RuleType, daysOfWeek: [1,2,3,4,5], startTime: "17:00", endTime: "23:00", adjustmentType: "PERCENTAGE_INCREASE" as AdjType, adjustmentValue: 50, priority: 5 },
  { label: "Weekend Premium", name: "Weekend Premium", type: "DAY_OF_WEEK" as RuleType, daysOfWeek: [0,6], startTime: "", endTime: "", adjustmentType: "PERCENTAGE_INCREASE" as AdjType, adjustmentValue: 40, priority: 4 },
  { label: "Early Bird", name: "Early Bird Discount", type: "EARLY_BIRD" as RuleType, daysOfWeek: [], startTime: "06:00", endTime: "09:00", adjustmentType: "PERCENTAGE_DECREASE" as AdjType, adjustmentValue: 20, priority: 3 },
  { label: "Off-Peak Discount", name: "Off-Peak Discount", type: "TIME_OF_DAY" as RuleType, daysOfWeek: [1,2,3,4,5], startTime: "10:00", endTime: "16:00", adjustmentType: "PERCENTAGE_DECREASE" as AdjType, adjustmentValue: 15, priority: 2 },
];

const adjTypeLabels: Record<AdjType, string> = {
  PERCENTAGE_INCREASE: "% Increase",
  PERCENTAGE_DECREASE: "% Decrease",
  FIXED_INCREASE: "Fixed +",
  FIXED_DECREASE: "Fixed -",
  FIXED_PRICE: "Override to",
};

const adjTypeSuffix: Record<AdjType, string> = {
  PERCENTAGE_INCREASE: "%",
  PERCENTAGE_DECREASE: "%",
  FIXED_INCREASE: "C$",
  FIXED_DECREASE: "C$",
  FIXED_PRICE: "C$",
};

function rulePreview(base: number, adjType: AdjType, adjValue: number): string {
  if (!adjValue || !base) return "";
  let final = base;
  if (adjType === "PERCENTAGE_INCREASE") final = base * (1 + adjValue / 100);
  else if (adjType === "PERCENTAGE_DECREASE") final = Math.max(0, base * (1 - adjValue / 100));
  else if (adjType === "FIXED_INCREASE") final = base + adjValue;
  else if (adjType === "FIXED_DECREASE") final = Math.max(0, base - adjValue);
  else if (adjType === "FIXED_PRICE") final = adjValue;
  return `C$${base.toFixed(2)} → C$${final.toFixed(2)}`;
}

function previewSlotColor(slot: PreviewSlot): string {
  if (slot.isBlocked) return "bg-zinc-800 text-zinc-500";
  if (slot.finalPriceCAD < slot.basePriceCAD) return "bg-green-900/40 text-green-300";
  if (slot.finalPriceCAD > slot.basePriceCAD) return "bg-amber-900/40 text-amber-300";
  if (slot.appliedRule) return "bg-yellow-900/40 text-yellow-300";
  return "bg-surface-2 text-muted";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const params = useParams<{ id: string }>();
  const courtId = params?.id ?? "";
  const router = useRouter();

  const [rules, setRules] = useState<PricingRule[]>([]);
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [basePriceCAD, setBasePriceCAD] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");

  // Rule modal state
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

  const load = useCallback(async () => {
    if (!courtId) return;
    setIsLoading(true);
    try {
      const data = await apiFetch<{ data: { basePriceCAD: number | null; rules: PricingRule[]; overrides: DateOverride[] } }>(
        `/vendor/courts/${courtId}/pricing`
      );
      setBasePriceCAD(data.data.basePriceCAD);
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
      const data = await apiFetch<{ data: PreviewDay[] }>(`/vendor/courts/${courtId}/pricing/preview`, { method: "POST" });
      setPreview(data.data);
    } catch { /* preview is best-effort */ }
    finally { setPreviewLoading(false); }
  }, [courtId]);

  useEffect(() => { load(); loadPreview(); }, [load, loadPreview]);

  function openAddRule(template?: (typeof TEMPLATES)[number]) {
    setEditingRule(null);
    setRuleForm(template
      ? { name: template.name, type: template.type, daysOfWeek: template.daysOfWeek, startTime: template.startTime, endTime: template.endTime, adjustmentType: template.adjustmentType, adjustmentValue: template.adjustmentValue, priority: template.priority }
      : { name: "", type: "TIME_OF_DAY", daysOfWeek: [], startTime: "", endTime: "", adjustmentType: "PERCENTAGE_INCREASE", adjustmentValue: 0, priority: 0 }
    );
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
      } else {
        await apiFetch(`/vendor/courts/${courtId}/pricing/rules`, { method: "POST", body: JSON.stringify(body) });
      }
      setRuleModalOpen(false);
      await Promise.all([load(), loadPreview()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setRuleSaving(false);
    }
  }

  async function deleteRule(id: string) {
    if (!confirm("Delete this rule?")) return;
    try {
      await apiFetch(`/vendor/courts/${courtId}/pricing/rules/${id}`, { method: "DELETE" });
      await Promise.all([load(), loadPreview()]);
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  }

  async function toggleRule(id: string) {
    try {
      await apiFetch(`/vendor/courts/${courtId}/pricing/rules/${id}/toggle`, { method: "PATCH" });
      setRules((prev) => prev.map((r) => r.id === id ? { ...r, isActive: !r.isActive } : r));
    } catch (e) { setError(e instanceof Error ? e.message : "Toggle failed"); }
  }

  async function saveOverride() {
    setOverrideSaving(true);
    try {
      const body = {
        date: overrideDate,
        type: overrideType,
        customPriceCAD: overrideType === "CUSTOM_PRICE" && overridePrice ? Number(overridePrice) : undefined,
        reason: overrideReason || undefined,
      };
      await apiFetch(`/vendor/courts/${courtId}/pricing/overrides`, { method: "POST", body: JSON.stringify(body) });
      setOverrideModalOpen(false);
      setOverrideDate(""); setOverridePrice(""); setOverrideReason("");
      await Promise.all([load(), loadPreview()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setOverrideSaving(false);
    }
  }

  async function deleteOverride(id: string) {
    try {
      await apiFetch(`/vendor/courts/${courtId}/pricing/overrides/${id}`, { method: "DELETE" });
      await Promise.all([load(), loadPreview()]);
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  }

  function toggleDay(day: number) {
    setRuleForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day) ? f.daysOfWeek.filter((d) => d !== day) : [...f.daysOfWeek, day],
    }));
  }

  const inputCls = "w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary";
  const selectCls = inputCls + " cursor-pointer";

  if (isLoading) return (
    <>
      <Header title="Pricing" />
      <main className="flex-1 p-6">
        <div className="space-y-4">{[1,2,3].map((i) => <div key={i} className="h-24 bg-surface border border-border rounded-dome animate-pulse" />)}</div>
      </main>
    </>
  );

  return (
    <>
      <Header title="Dynamic Pricing" />
      <main className="flex-1 p-6 overflow-auto space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => router.back()} className="text-xs text-muted hover:text-white">← Back to Court</button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* ── Left: rules + overrides ── */}
          <div className="space-y-6">

            {/* Base price */}
            <div className="bg-surface border border-border rounded-dome p-5">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Base Price</h2>
              <p className="text-2xl font-black text-white">
                {basePriceCAD !== null ? `C$${basePriceCAD.toFixed(2)}` : "No slots found"}
                <span className="text-sm font-normal text-muted ml-2">/ slot</span>
              </p>
              <p className="text-xs text-muted mt-1">Set when generating slots. Rules are applied on top of this.</p>
            </div>

            {/* Quick templates */}
            <div className="bg-surface border border-border rounded-dome p-5">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Quick Add Rule</h2>
              <div className="flex flex-wrap gap-2 mb-3">
                {TEMPLATES.map((t) => (
                  <button key={t.label} onClick={() => openAddRule(t)}
                    className="px-3 py-1.5 text-xs font-semibold border border-border rounded-dome text-muted hover:text-white hover:border-primary/50 transition-colors">
                    ⚡ {t.label}
                  </button>
                ))}
                <button onClick={() => openAddRule()}
                  className="px-3 py-1.5 text-xs font-semibold border border-primary text-primary rounded-dome hover:bg-primary hover:text-white transition-colors">
                  + Custom Rule
                </button>
              </div>
            </div>

            {/* Rules list */}
            <div className="bg-surface border border-border rounded-dome p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Pricing Rules ({rules.length})</h2>
              </div>

              {rules.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">No rules yet. Add one above to get started.</p>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => {
                    const isIncrease = rule.adjustmentType.includes("INCREASE");
                    const adjStr = rule.adjustmentType === "PERCENTAGE_INCREASE" ? `+${rule.adjustmentValue}%`
                      : rule.adjustmentType === "PERCENTAGE_DECREASE" ? `-${rule.adjustmentValue}%`
                      : rule.adjustmentType === "FIXED_INCREASE" ? `+C$${rule.adjustmentValue}`
                      : rule.adjustmentType === "FIXED_DECREASE" ? `-C$${rule.adjustmentValue}`
                      : `= C$${rule.adjustmentValue}`;

                    return (
                      <div key={rule.id} className={`border rounded-dome p-4 transition-colors ${rule.isActive ? "border-border" : "border-border opacity-50"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-bold text-white">{rule.name}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isIncrease ? "bg-amber-900/40 text-amber-400" : "bg-green-900/40 text-green-400"}`}>
                                {adjStr}
                              </span>
                              {rule.priority > 0 && (
                                <span className="text-xs text-muted border border-border px-1.5 py-0.5 rounded">P{rule.priority}</span>
                              )}
                            </div>
                            <p className="text-xs text-muted">{rule.description}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Toggle */}
                            <button onClick={() => toggleRule(rule.id)}
                              className={`relative w-10 h-5 rounded-full transition-colors ${rule.isActive ? "bg-primary" : "bg-border"}`}>
                              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${rule.isActive ? "translate-x-5" : ""}`} />
                            </button>
                            <button onClick={() => openEditRule(rule)}
                              className="text-xs text-muted hover:text-white px-2 py-1 border border-border rounded hover:border-primary/50 transition-colors">
                              Edit
                            </button>
                            <button onClick={() => deleteRule(rule.id)}
                              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-900/50 rounded hover:border-red-700 transition-colors">
                              Del
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Date overrides */}
            <div className="bg-surface border border-border rounded-dome p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Date Overrides</h2>
                <button onClick={() => setOverrideModalOpen(true)}
                  className="text-xs text-primary border border-primary/40 hover:border-primary rounded-dome px-3 py-1.5 transition-colors">
                  + Add Override
                </button>
              </div>

              {overrides.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">No date overrides. Block holidays, set custom prices, or offer free slots.</p>
              ) : (
                <div className="divide-y divide-border">
                  {overrides.map((o) => (
                    <div key={o.id} className="flex items-center justify-between py-3 gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{o.date}</p>
                        <p className="text-xs text-muted">
                          {o.type === "BLOCKED" ? "🚫 Blocked" : o.type === "FREE" ? "🎁 Free" : `💰 C$${o.customPriceCAD?.toFixed(2)}`}
                          {o.reason ? ` — ${o.reason}` : ""}
                        </p>
                      </div>
                      <button onClick={() => deleteOverride(o.id)}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-900/50 rounded hover:border-red-700 transition-colors shrink-0">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: 7-day preview ── */}
          <div className="bg-surface border border-border rounded-dome p-5 h-fit">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">7-Day Price Preview</h2>
              {previewLoading && <span className="text-xs text-muted animate-pulse">Updating…</span>}
            </div>

            {/* Legend */}
            <div className="flex gap-3 mb-4 flex-wrap">
              {[["bg-surface-2 border border-border", "Base price"], ["bg-green-900/40 text-green-300", "Discount"], ["bg-amber-900/40 text-amber-300", "Premium"], ["bg-zinc-800 text-zinc-500", "Blocked"]].map(([cls, label]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded ${cls}`} />
                  <span className="text-xs text-muted">{label}</span>
                </div>
              ))}
            </div>

            {preview.length === 0 ? (
              <p className="text-sm text-muted py-8 text-center">No slots found. Generate slots first to preview pricing.</p>
            ) : (
              <div className="space-y-4">
                {preview.map((day) => (
                  <div key={day.date}>
                    <p className="text-xs font-semibold text-muted mb-2">{new Date(day.date + "T12:00:00Z").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}</p>
                    {day.slots.length === 0 ? (
                      <p className="text-xs text-muted italic pl-2">No slots</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {day.slots.map((slot) => (
                          <div key={slot.startTime} className={`px-2 py-1 rounded text-xs font-medium ${previewSlotColor(slot)}`}
                            title={slot.appliedRule ?? ""}>
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
      </main>

      {/* ── Rule modal ── */}
      <Modal
        open={ruleModalOpen}
        title={editingRule ? "Edit Pricing Rule" : "Add Pricing Rule"}
        confirmLabel={ruleSaving ? "Saving…" : editingRule ? "Save Changes" : "Create Rule"}
        isLoading={ruleSaving}
        onConfirm={saveRule}
        onCancel={() => setRuleModalOpen(false)}
      >
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-muted mb-1">Rule Name</label>
            <input type="text" value={ruleForm.name} onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Weekend Premium" className={inputCls} />
          </div>

          {/* Days */}
          <div>
            <label className="block text-xs text-muted mb-2">Days of Week (empty = all days)</label>
            <div className="flex gap-2 flex-wrap">
              {ALL_DAYS.map((d) => (
                <button key={d} type="button" onClick={() => toggleDay(d)}
                  className={`w-10 h-8 text-xs font-bold rounded transition-colors ${ruleForm.daysOfWeek.includes(d) ? "bg-primary text-white" : "bg-surface-2 border border-border text-muted hover:text-white"}`}>
                  {DAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Start Time</label>
              <input type="time" value={ruleForm.startTime} onChange={(e) => setRuleForm((f) => ({ ...f, startTime: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">End Time</label>
              <input type="time" value={ruleForm.endTime} onChange={(e) => setRuleForm((f) => ({ ...f, endTime: e.target.value }))} className={inputCls} />
            </div>
          </div>

          {/* Adjustment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Adjustment Type</label>
              <select value={ruleForm.adjustmentType} onChange={(e) => setRuleForm((f) => ({ ...f, adjustmentType: e.target.value as AdjType }))} className={selectCls}>
                {(Object.keys(adjTypeLabels) as AdjType[]).map((k) => (
                  <option key={k} value={k}>{adjTypeLabels[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">
                Value ({adjTypeSuffix[ruleForm.adjustmentType] === "%" ? "%" : "C$"})
              </label>
              <input type="number" min="0" step="0.01" value={ruleForm.adjustmentValue || ""}
                onChange={(e) => setRuleForm((f) => ({ ...f, adjustmentValue: Number(e.target.value) }))}
                className={inputCls} />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs text-muted mb-1">Priority (0–100, higher wins)</label>
            <input type="number" min="0" max="100" value={ruleForm.priority}
              onChange={(e) => setRuleForm((f) => ({ ...f, priority: Number(e.target.value) }))}
              className={inputCls} style={{ maxWidth: 80 }} />
          </div>

          {/* Preview */}
          {basePriceCAD !== null && ruleForm.adjustmentValue > 0 && (
            <div className="bg-surface-2 rounded-dome px-4 py-3 text-sm">
              <span className="text-muted">Preview: </span>
              <span className="text-white font-bold">{rulePreview(basePriceCAD, ruleForm.adjustmentType, ruleForm.adjustmentValue)}</span>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Override modal ── */}
      <Modal
        open={overrideModalOpen}
        title="Add Date Override"
        confirmLabel={overrideSaving ? "Saving…" : "Save Override"}
        isLoading={overrideSaving}
        onConfirm={saveOverride}
        onCancel={() => { setOverrideModalOpen(false); setOverrideDate(""); setOverridePrice(""); setOverrideReason(""); }}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Date</label>
            <input type="date" value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)}
              className={inputCls + " [color-scheme:dark]"} required />
          </div>
          <div>
            <label className="block text-xs text-muted mb-2">Override Type</label>
            <div className="flex gap-2">
              {(["CUSTOM_PRICE", "BLOCKED", "FREE"] as OverrideType[]).map((t) => (
                <button key={t} type="button" onClick={() => setOverrideType(t)}
                  className={`flex-1 py-2 text-xs font-bold rounded-dome border transition-colors ${overrideType === t ? "bg-primary border-primary text-white" : "border-border text-muted hover:text-white"}`}>
                  {t === "CUSTOM_PRICE" ? "💰 Custom Price" : t === "BLOCKED" ? "🚫 Block" : "🎁 Free"}
                </button>
              ))}
            </div>
          </div>
          {overrideType === "CUSTOM_PRICE" && (
            <div>
              <label className="block text-xs text-muted mb-1">Custom Price (C$)</label>
              <input type="number" min="0" step="0.01" value={overridePrice}
                onChange={(e) => setOverridePrice(e.target.value)}
                placeholder="e.g. 15.00" className={inputCls} />
            </div>
          )}
          <div>
            <label className="block text-xs text-muted mb-1">Reason (optional)</label>
            <input type="text" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}
              placeholder={overrideType === "BLOCKED" ? "e.g. Maintenance, Holiday" : "e.g. Grand opening"}
              className={inputCls} />
          </div>
        </div>
      </Modal>
    </>
  );
}
