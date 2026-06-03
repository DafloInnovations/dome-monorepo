"use client";

import { useEffect, useState } from "react";
import type { Slot } from "../../lib/api";
import { API_URL } from "../../lib/api";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getNext7Days(): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Props {
  facilityId: string;
  onSelect: (slot: Slot) => void;
  selectedSlotId?: string;
}

export default function SlotPicker({ facilityId, onSelect, selectedSlotId }: Props) {
  const days = getNext7Days();
  const [dayIdx, setDayIdx] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  const date = formatDate(days[dayIdx]!);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/facilities/${facilityId}/slots?date=${date}`)
      .then((r) => r.json())
      .then((json: { data: { slots?: Slot[] } }) => setSlots(json.data?.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [facilityId, date]);

  return (
    <div>
      {/* Date strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {days.map((day, i) => (
          <button
            key={i}
            onClick={() => setDayIdx(i)}
            className={`flex flex-col items-center min-w-[52px] py-3 rounded-dome border transition-colors ${
              dayIdx === i
                ? "bg-primary border-primary text-white"
                : "bg-surface border-border text-muted hover:text-white"
            }`}
          >
            <span className="text-[10px] font-semibold uppercase">{DAY_LABELS[day.getDay()]}</span>
            <span className="text-lg font-bold mt-0.5">{day.getDate()}</span>
          </button>
        ))}
      </div>

      {/* Slot grid */}
      <div className="mt-4">
        {loading ? (
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="w-24 h-14 bg-surface rounded-dome animate-pulse" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">No slots available for this date.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => {
              const available = slot.status === "AVAILABLE";
              const selected = slot.id === selectedSlotId;
              return (
                <button
                  key={slot.id}
                  disabled={!available}
                  onClick={() => onSelect({ ...slot, date })}
                  className={`flex flex-col items-center px-3 py-2 rounded-dome border text-xs font-medium transition-colors min-w-[80px] ${
                    selected
                      ? "bg-primary border-primary text-white"
                      : available
                      ? "bg-surface border-border text-white hover:border-primary/60"
                      : "bg-surface-2 border-border text-muted opacity-50 cursor-not-allowed"
                  }`}
                >
                  <span className="font-bold">{slot.startTime}</span>
                  <span className="mt-0.5">
                    {available ? `C$${Number(slot.priceCAD).toFixed(0)}` : slot.status === "BOOKED" ? "Booked" : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
