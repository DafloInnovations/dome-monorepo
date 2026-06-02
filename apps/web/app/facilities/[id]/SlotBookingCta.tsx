"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import SlotPicker from "../../../components/ui/SlotPicker";
import type { Slot } from "../../../lib/api";

interface Props {
  facilityId: string;
  facilityName: string;
}

export default function SlotBookingCta({ facilityId, facilityName }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Slot | null>(null);

  function handleBook() {
    if (!selected) return;
    router.push(
      `/book/${selected.id}?facilityId=${facilityId}&facilityName=${encodeURIComponent(facilityName)}&startTime=${selected.startTime}&endTime=${selected.endTime}&priceCAD=${selected.priceCAD}&date=${selected.date.split("T")[0]}`
    );
  }

  return (
    <div>
      <SlotPicker
        facilityId={facilityId}
        onSelect={setSelected}
        selectedSlotId={selected?.id}
      />

      {selected && (
        <div className="mt-5 border-t border-border pt-5">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted">Time</span>
            <span className="text-white font-medium">{selected.startTime} – {selected.endTime}</span>
          </div>
          <div className="flex justify-between text-sm mb-4">
            <span className="text-muted">Price</span>
            <span className="text-primary font-bold">C${Number(selected.priceCAD).toFixed(2)}</span>
          </div>
          <button
            onClick={handleBook}
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-dome transition-colors text-sm"
          >
            Book This Slot →
          </button>
        </div>
      )}
    </div>
  );
}
