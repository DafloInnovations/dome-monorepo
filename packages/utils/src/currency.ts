import type { CanadianProvince } from "@dome/types";

const PROVINCIAL_TAX_RATES: Record<CanadianProvince, number> = {
  AB: 0.05,
  BC: 0.12,
  MB: 0.12,
  NB: 0.15,
  NL: 0.15,
  NS: 0.15,
  NT: 0.05,
  NU: 0.05,
  ON: 0.13,
  PE: 0.15,
  QC: 0.14975,
  SK: 0.11,
  YT: 0.05,
};

export function getTaxRate(province: CanadianProvince): number {
  return PROVINCIAL_TAX_RATES[province];
}

export function calculateTax(amountCAD: number, province: CanadianProvince): number {
  return Math.round(amountCAD * getTaxRate(province) * 100) / 100;
}

export function calculateTotal(subtotalCAD: number, province: CanadianProvince): {
  subtotalCAD: number;
  taxCAD: number;
  totalCAD: number;
} {
  const taxCAD = calculateTax(subtotalCAD, province);
  return {
    subtotalCAD,
    taxCAD,
    totalCAD: Math.round((subtotalCAD + taxCAD) * 100) / 100,
  };
}

export function formatCAD(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCADCompact(amount: number): string {
  if (amount >= 1000) {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return formatCAD(amount);
}

export function centsToCAD(cents: number): number {
  return cents / 100;
}

export function cadToCents(cad: number): number {
  return Math.round(cad * 100);
}

export function splitCost(totalCAD: number, players: number): number {
  return Math.ceil((totalCAD / players) * 100) / 100;
}
