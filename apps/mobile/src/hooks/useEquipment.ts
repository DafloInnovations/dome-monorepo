import { useCallback, useEffect, useState } from "react";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface EquipmentItem {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  priceCAD: number;
  quantity: number;
  availableQuantity: number;
  isActive: boolean;
  imageUrl: string | null;
}

export interface SelectedEquipment {
  equipmentId: string;
  quantity: number;
}

export function useEquipment(facilityId: string, sport?: string) {
  const { getValidToken } = useAuthToken();
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, number>>({});

  const fetchEquipment = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = sport ? `?sport=${encodeURIComponent(sport)}` : "";
      const res = await fetch(`${API_URL}/facilities/${facilityId}/equipment${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: EquipmentItem[] };
      setEquipment(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load equipment");
    } finally {
      setLoading(false);
    }
  }, [facilityId, sport]);

  useEffect(() => { fetchEquipment(); }, [fetchEquipment]);

  function setQuantity(equipmentId: string, qty: number) {
    setSelected((prev) => {
      if (qty <= 0) {
        const next = { ...prev };
        delete next[equipmentId];
        return next;
      }
      return { ...prev, [equipmentId]: qty };
    });
  }

  const selectedItems: SelectedEquipment[] = Object.entries(selected).map(
    ([equipmentId, quantity]) => ({ equipmentId, quantity })
  );

  const equipmentTotalCAD = selectedItems.reduce((sum, item) => {
    const eq = equipment.find((e) => e.id === item.equipmentId);
    return sum + (eq ? eq.priceCAD * item.quantity : 0);
  }, 0);

  async function addToBooking(bookingId: string): Promise<void> {
    if (!selectedItems.length) return;
    const token = await getValidToken();
    const res = await fetch(`${API_URL}/bookings/${bookingId}/equipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: selectedItems }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(json.message ?? `HTTP ${res.status}`);
    }
  }

  function clearSelection() { setSelected({}); }

  return {
    equipment,
    loading,
    error,
    selected,
    selectedItems,
    equipmentTotalCAD,
    setQuantity,
    addToBooking,
    clearSelection,
  };
}
