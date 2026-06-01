// Province codes are duplicated here so @dome/utils has no build-time dependency
// on @dome/types (which may not be built yet in some tool environments).
export type Province =
  | "AB" | "BC" | "MB" | "NB" | "NL" | "NS"
  | "NT" | "NU" | "ON" | "PE" | "QC" | "SK" | "YT";

const PROVINCIAL_TAX_RATES: Record<Province, number> = {
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

export function getTaxRate(province: string): number {
  return PROVINCIAL_TAX_RATES[province as Province] ?? 0.05;
}

export function calculateTax(amountCAD: number, province: string): number {
  return Math.round(amountCAD * getTaxRate(province) * 100) / 100;
}

export function calculateTotal(
  subtotalCAD: number,
  province: string
): { subtotalCAD: number; taxCAD: number; totalCAD: number } {
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
