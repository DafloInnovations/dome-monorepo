import { useState, useCallback } from "react";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface AppliedCoupon {
  couponId: string;
  code: string;
  description: string | null;
  discountCAD: number;
  finalTotal: number;
}

export interface CouponState {
  applied: AppliedCoupon | null;
  inputCode: string;
  isValidating: boolean;
  error: string | null;
}

export function useCoupon(facilityId: string, subtotalCAD: number) {
  const { getValidToken } = useAuthToken();
  const [state, setState] = useState<CouponState>({
    applied: null,
    inputCode: "",
    isValidating: false,
    error: null,
  });

  const setInputCode = useCallback((code: string) => {
    setState((s) => ({ ...s, inputCode: code.toUpperCase(), error: null }));
  }, []);

  const validate = useCallback(async (): Promise<AppliedCoupon | null> => {
    const code = state.inputCode.trim();
    if (!code) return null;

    setState((s) => ({ ...s, isValidating: true, error: null }));
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/coupons/validate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ code, facilityId, subtotalCAD }),
      });
      const json = (await res.json()) as { data?: { valid: boolean; couponId?: string; code?: string; description?: string | null; discountCAD?: number; finalTotal?: number; error?: string } };

      if (!res.ok || !json.data?.valid) {
        const msg = json.data?.error ?? "Invalid coupon code";
        setState((s) => ({ ...s, isValidating: false, error: msg }));
        return null;
      }

      const coupon: AppliedCoupon = {
        couponId: json.data.couponId!,
        code: json.data.code!,
        description: json.data.description ?? null,
        discountCAD: json.data.discountCAD!,
        finalTotal: json.data.finalTotal!,
      };

      setState((s) => ({ ...s, isValidating: false, error: null, applied: coupon, inputCode: "" }));
      return coupon;
    } catch {
      setState((s) => ({ ...s, isValidating: false, error: "Could not validate coupon. Check your connection." }));
      return null;
    }
  }, [state.inputCode, facilityId, subtotalCAD, getValidToken]);

  const remove = useCallback(() => {
    setState((s) => ({ ...s, applied: null, inputCode: "", error: null }));
  }, []);

  const discountCAD = state.applied?.discountCAD ?? 0;

  return {
    ...state,
    setInputCode,
    validate,
    remove,
    discountCAD,
  };
}
