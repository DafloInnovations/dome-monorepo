import { useCallback, useEffect, useState } from "react";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface CreditTransaction {
  id: string;
  amountCAD: number;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
}

export function useCredits() {
  const { getValidToken } = useAuthToken();
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/users/me/credits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = (await res.json()) as { balance: number; credits: CreditTransaction[] };
      setBalance(json.balance);
      setHistory(json.credits);
    } catch {
      // non-fatal
    } finally {
      setIsLoading(false);
    }
  }, [getValidToken]);

  useEffect(() => { fetch_(); }, [fetch_]);

  // Non-expired balance available right now
  const availableBalance = balance ?? 0;

  // Expiry warning: oldest expiring credit within 30 days
  const soonExpiring = history
    .filter((c) => c.amountCAD > 0 && c.expiresAt)
    .filter((c) => {
      const exp = new Date(c.expiresAt!).getTime();
      return exp > Date.now() && exp - Date.now() < 30 * 24 * 3_600_000;
    })
    .sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime())[0];

  return { availableBalance, history, isLoading, refetch: fetch_, soonExpiring };
}

// Compute how much credit to apply and resulting card charge
export function calcCreditSplit(
  totalCAD: number,
  availableBalance: number,
  creditsToUse: number | null  // null = use max possible
): { creditsApplied: number; cardCharge: number } {
  if (availableBalance <= 0) return { creditsApplied: 0, cardCharge: totalCAD };
  const want = creditsToUse !== null ? Math.min(creditsToUse, availableBalance) : availableBalance;
  const creditsApplied = Math.min(want, totalCAD);
  const cardCharge = Math.max(0, Math.round((totalCAD - creditsApplied) * 100) / 100);
  return { creditsApplied: Math.round(creditsApplied * 100) / 100, cardCharge };
}
