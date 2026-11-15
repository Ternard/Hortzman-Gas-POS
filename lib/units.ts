/** Items are counted in pieces ('pcs') or measured in metres ('m'). */
export type Unit = "pcs" | "m";

export const cleanUnit = (u: unknown): Unit => (u === "m" ? "m" : "pcs");

/** Whole numbers for pieces; up to 3 decimals (millimetres) for metres. Never NaN. */
export function cleanQty(v: unknown, unit: unknown): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return unit === "m" ? Math.round(n * 1000) / 1000 : Math.floor(n);
}
