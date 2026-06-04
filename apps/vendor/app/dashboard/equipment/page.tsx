"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "../../../components/layout/Header";
import { api, type Facility, type VendorEquipment as Equipment } from "../../../lib/api";

const SPORT_EMOJI: Record<string, string> = {
  BADMINTON: "🏸", TENNIS: "🎾", BASKETBALL: "🏀", SOCCER: "⚽",
  PICKLEBALL: "🏓", VOLLEYBALL: "🏐", HOCKEY: "🏒", CRICKET: "🏏",
  BASEBALL: "⚾", SQUASH: "🎾",
};

interface EquipmentFormData {
  name: string;
  description: string;
  sport: string;
  priceCAD: string;
  quantity: string;
}

const EMPTY_FORM: EquipmentFormData = {
  name: "", description: "", sport: "", priceCAD: "", quantity: "",
};

function EquipmentModal({
  facilityId,
  facilities,
  initial,
  onSave,
  onClose,
}: {
  facilityId: string;
  facilities: Facility[];
  initial?: Equipment;
  onSave: (facilityId: string, data: EquipmentFormData, id?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EquipmentFormData>(
    initial
      ? { name: initial.name, description: initial.description ?? "", sport: initial.sport, priceCAD: String(initial.priceCAD), quantity: String(initial.quantity) }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selFacilityId, setSelFacilityId] = useState(initial?.facilityId ?? facilityId);

  const allSports = Object.keys(SPORT_EMOJI);

  async function handleSave() {
    if (!form.name.trim() || !form.sport || !form.priceCAD || !form.quantity) {
      setError("Name, sport, price, and quantity are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(selFacilityId, form, initial?.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[#111] border border-border rounded-2xl p-6 w-full max-w-md flex flex-col gap-4">
        <h3 className="text-lg font-bold text-white">
          {initial ? "Edit Equipment" : "Add Equipment"}
        </h3>

        {/* Facility */}
        <div>
          <label className="text-xs text-muted uppercase tracking-wide mb-1 block">Facility</label>
          <select
            value={selFacilityId}
            onChange={(e) => setSelFacilityId(e.target.value)}
            className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
          >
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs text-muted uppercase tracking-wide mb-1 block">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Badminton Racket"
            className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-muted uppercase tracking-wide mb-1 block">Description (optional)</label>
          <input
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Short description"
            className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
          />
        </div>

        {/* Sport */}
        <div>
          <label className="text-xs text-muted uppercase tracking-wide mb-1 block">Sport</label>
          <select
            value={form.sport}
            onChange={(e) => setForm((p) => ({ ...p, sport: e.target.value }))}
            className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
          >
            <option value="">Select sport…</option>
            {allSports.map((s) => (
              <option key={s} value={s}>{SPORT_EMOJI[s]} {s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>

        {/* Price + Quantity */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted uppercase tracking-wide mb-1 block">Price (C$)</label>
            <input
              type="number"
              min="0.50"
              step="0.50"
              value={form.priceCAD}
              onChange={(e) => setForm((p) => ({ ...p, priceCAD: e.target.value }))}
              placeholder="5.00"
              className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted uppercase tracking-wide mb-1 block">Quantity</label>
            <input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              placeholder="10"
              className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted border border-border rounded-dome hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm text-white bg-primary rounded-dome disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Equipment | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eqRes, facRes] = await Promise.all([
        api.equipment.list(),
        api.vendor.facilities(),
      ]);
      setEquipment(eqRes.data ?? []);
      setFacilities(facRes.data ?? []);
    } catch { /* handled by empty state */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(facilityId: string, form: EquipmentFormData, id?: string) {
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      sport: form.sport,
      priceCAD: Number(form.priceCAD),
      quantity: Number(form.quantity),
    };
    if (id) {
      await api.equipment.update(id, body);
    } else {
      await api.equipment.create(facilityId, body);
    }
    await load();
  }

  async function handleToggleActive(item: Equipment) {
    await api.equipment.update(item.id, { isActive: !item.isActive });
    await load();
  }

  // Group by facility
  const grouped = equipment.reduce<Record<string, Equipment[]>>((acc, e) => {
    const key = e.facilityId;
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(e);
    return acc;
  }, {});

  const totalItems = equipment.length;
  const totalRentals = equipment.reduce((s, e) => s + e._count.rentals, 0);

  const defaultFacilityId = facilities[0]?.id ?? "";

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header title="Equipment" />
      <main className="flex-1 px-6 py-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#111] border border-border rounded-xl p-4">
            <p className="text-2xl font-black text-white">{totalItems}</p>
            <p className="text-xs text-muted mt-0.5">Equipment items</p>
          </div>
          <div className="bg-[#111] border border-border rounded-xl p-4">
            <p className="text-2xl font-black text-amber-400">{totalRentals}</p>
            <p className="text-xs text-muted mt-0.5">Total rentals</p>
          </div>
        </div>

        {/* Add button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => { setEditing(undefined); setShowModal(true); }}
            className="px-4 py-2 text-sm font-bold text-white bg-primary rounded-dome hover:bg-primary/90 transition-colors"
          >
            + Add Equipment
          </button>
        </div>

        {/* Equipment table per facility */}
        {loading ? (
          <p className="text-muted text-sm py-12 text-center">Loading…</p>
        ) : equipment.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🎒</p>
            <p className="text-white font-semibold mb-2">No equipment yet</p>
            <p className="text-muted text-sm">Add equipment items that players can rent with their booking.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([facId, items]) => {
            const facName = items[0]?.facility.name ?? facId;
            return (
              <div key={facId} className="mb-8">
                <p className="text-sm font-bold text-muted uppercase tracking-wide mb-3">
                  🏟 {facName}
                </p>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-left bg-[#111]">
                    <thead>
                      <tr className="text-xs text-muted border-b border-border">
                        <th className="px-4 py-3 font-semibold">Item</th>
                        <th className="px-4 py-3 font-semibold">Sport</th>
                        <th className="px-4 py-3 font-semibold">Price</th>
                        <th className="px-4 py-3 font-semibold">Qty</th>
                        <th className="px-4 py-3 font-semibold">Rentals</th>
                        <th className="px-4 py-3 font-semibold">Revenue</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const emoji = SPORT_EMOJI[item.sport.toUpperCase()] ?? "🎒";
                        const revenue = item._count.rentals * item.priceCAD;
                        return (
                          <tr key={item.id} className="border-t border-border hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <p className="text-sm text-white font-medium">{item.name}</p>
                              {item.description && <p className="text-xs text-muted">{item.description}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm">{emoji} {item.sport.charAt(0) + item.sport.slice(1).toLowerCase()}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-white font-semibold">C${item.priceCAD.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-white">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm text-amber-400 font-semibold">{item._count.rentals}</td>
                            <td className="px-4 py-3 text-sm text-green-400 font-semibold">C${revenue.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleToggleActive(item)}
                                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                  item.isActive
                                    ? "bg-green-400/10 text-green-400"
                                    : "bg-border text-muted"
                                }`}
                              >
                                {item.isActive ? "Active" : "Hidden"}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => { setEditing(item); setShowModal(true); }}
                                className="text-xs text-primary hover:underline"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </main>

      {showModal && (
        <EquipmentModal
          facilityId={editing?.facilityId ?? defaultFacilityId}
          facilities={facilities}
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
        />
      )}
    </div>
  );
}
