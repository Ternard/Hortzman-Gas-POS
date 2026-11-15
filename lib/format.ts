export const BUSINESS_NAME = "HORTZMAN GAS";
export const TZ = "Africa/Nairobi";

export function money(n: unknown) {
  const v = Number(n ?? 0);
  return "KES " + v.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const isMetres = (unit: unknown) => unit === "m";

/** Format a quantity with its unit: "10" for pieces, "12.5 m" for metres. */
export function qty(n: unknown, unit: unknown = "pcs") {
  const v = Number(n ?? 0);
  const s = v.toLocaleString("en-KE", { maximumFractionDigits: 3 });
  return isMetres(unit) ? `${s} m` : s;
}

export function dateTime(d: string | Date) {
  return new Date(d).toLocaleString("en-KE", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
}

export function timeOnly(d: string | Date) {
  return new Date(d).toLocaleTimeString("en-KE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

/** Today's date in Nairobi as YYYY-MM-DD */
export function todayYMD() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function addDays(ymd: string, n: number) {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const isYMD = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Resolve a ?range=today|7d|month|custom&from&to into a from/to pair */
export function resolveRange(sp: Record<string, string | string[] | undefined>) {
  const today = todayYMD();
  const range = (sp.range as string) || "today";
  if (range === "7d") return { range, from: addDays(today, -6), to: today };
  if (range === "month") return { range, from: today.slice(0, 8) + "01", to: today };
  if (range === "custom" && isYMD(sp.from) && isYMD(sp.to)) return { range, from: sp.from, to: sp.to };
  return { range: "today", from: today, to: today };
}
