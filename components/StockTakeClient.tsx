"use client";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { saveStockTake } from "@/app/(app)/stocktake/actions";
import { cleanQty } from "@/lib/units";
import { money, qty } from "@/lib/format";

type P = {
  id: number; name: string; category: string; unit: string; stock: number; empties: number; cost: number;
  trackStock: boolean; tracksEmpties: boolean;
};
type Check = { id: number; name: string; sold: number; returned: number; gap: number; withSupplier: number; adjusted: number; onShelf: number };
type Row = { key: string; p: P; kind: "stock" | "empties"; system: number };

export default function StockTakeClient({ products, check, picker }: { products: P[]; check: Check[]; picker: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ changed: number; checked: number; netValue: number; ref: string } | null>(null);

  const rows = useMemo<Row[]>(
    () => products.flatMap((p) => [
      ...(p.trackStock ? [{ key: `${p.id}:stock`, p, kind: "stock" as const, system: p.stock }] : []),
      ...(p.tracksEmpties ? [{ key: `${p.id}:empties`, p, kind: "empties" as const, system: p.empties }] : []),
    ]),
    [products],
  );

  const entered = rows.filter((r) => counts[r.key] !== undefined && counts[r.key] !== "");
  const diffOf = (r: Row) => {
    const c = r.kind === "empties" ? Math.floor(Number(counts[r.key])) : cleanQty(counts[r.key], r.p.unit);
    return Math.round((c - r.system) * 1000) / 1000;
  };
  const mismatches = entered.filter((r) => diffOf(r) !== 0);
  const netValue = mismatches.filter((r) => r.kind === "stock").reduce((s, r) => s + diffOf(r) * r.p.cost, 0);

  function save() {
    setError("");
    start(async () => {
      const res = await saveStockTake({
        counts: entered.map((r) => ({ productId: r.p.id, kind: r.kind, counted: Number(counts[r.key]) })),
        note,
      });
      if (res.error) return setError(res.error);
      setDone({ changed: res.changed ?? 0, checked: res.checked ?? 0, netValue: res.netValue ?? 0, ref: res.ref ?? "" });
      setCounts({});
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Stock take</h1>
        <p className="text-sm text-stone-500">Count what is on the shelf and type it in. Leave an item blank to skip it. Nothing changes until you press Save.</p>
      </div>

      {done && (
        <div className="flex items-start gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-900">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <div>
            <b>Saved ({done.ref}).</b> {done.checked} counted, {done.changed === 0 ? "everything matched." : `${done.changed} corrected.`}
            {done.changed > 0 && <> Stock value change: <b>{money(done.netValue)}</b>.</>}
          </div>
        </div>
      )}

      <div className="card divide-y divide-stone-100 p-0">
        {rows.length === 0 && <p className="p-6 text-center text-sm text-stone-400">No items to count.</p>}
        {rows.map((r) => {
          const has = counts[r.key] !== undefined && counts[r.key] !== "";
          const d = has ? diffOf(r) : 0;
          const metres = r.p.unit === "m" && r.kind === "stock";
          return (
            <div key={r.key} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.p.name}{r.kind === "empties" && <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-bold text-stone-600">EMPTIES</span>}</p>
                <p className="text-xs text-stone-500">System: <b>{r.kind === "empties" ? r.system : qty(r.system, r.p.unit)}</b></p>
                {has && d !== 0 && (
                  <p className={`text-xs font-semibold ${d < 0 ? "text-red-600" : "text-green-700"}`}>
                    {d > 0 ? "+" : ""}{d}{metres ? " m" : ""} {d < 0 ? "missing" : "extra"}
                    {r.kind === "stock" && ` · ${money(Math.abs(d) * r.p.cost)} at cost`}
                  </p>
                )}
                {has && d === 0 && <p className="text-xs font-semibold text-green-700">Matches</p>}
              </div>
              <div className="flex items-center gap-1">
                <input className="input w-24 px-2 py-2 text-center text-lg font-bold" inputMode="decimal" placeholder="Count"
                  value={counts[r.key] ?? ""}
                  onChange={(e) => {
                    const re = metres ? /^\d*\.?\d{0,3}$/ : /^\d*$/;
                    if (re.test(e.target.value)) setCounts({ ...counts, [r.key]: e.target.value });
                  }} />
                {metres && <span className="text-sm font-semibold text-stone-500">m</span>}
              </div>
            </div>
          );
        })}
      </div>

      {rows.length > 0 && (
        <div className="card space-y-3">
          <div className="flex justify-between text-sm"><span className="text-stone-500">Counted</span><b>{entered.length} of {rows.length}</b></div>
          <div className="flex justify-between text-sm"><span className="text-stone-500">Don't match</span><b className={mismatches.length ? "text-red-600" : ""}>{mismatches.length}</b></div>
          <div className="flex justify-between text-sm"><span className="text-stone-500">Stock value change (at cost)</span><b className={netValue < 0 ? "text-red-600" : ""}>{money(netValue)}</b></div>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional), e.g. month-end count" />
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={pending || entered.length === 0}
            onClick={() => {
              if (mismatches.length && !confirm(`Correct ${mismatches.length} item${mismatches.length > 1 ? "s" : ""} to match your count? This will be saved in the stock history.`)) return;
              save();
            }}>
            {pending ? "Saving…" : "Save stock take"}
          </button>
        </div>
      )}

      {check.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-black">Cylinder check</h2>
            <p className="text-sm text-stone-500">
              Refills sold against empties that came back. A gap means customers still hold your cylinders.
              Sales made before empties tracking was switched on count as no empty returned.
            </p>
          </div>
          {picker}
          <div className="grid gap-3 sm:grid-cols-2">
            {check.map((c) => (
              <div key={c.id} className="card space-y-1.5 text-sm">
                <p className="text-base font-bold">{c.name}</p>
                <div className="flex justify-between"><span className="text-stone-500">Refills sold</span><b>{c.sold}</b></div>
                <div className="flex justify-between"><span className="text-stone-500">Empties came back</span><b>{c.returned}</b></div>
                <div className={`flex justify-between rounded-lg px-2 py-1 ${c.gap > 0 ? "bg-amber-50 text-amber-900" : "bg-green-50 text-green-800"}`}>
                  <span className="font-semibold">{c.gap > 0 ? "Cylinders still with customers" : "All empties accounted for"}</span><b>{c.gap}</b>
                </div>
                <div className="flex justify-between"><span className="text-stone-500">Empties on the shelf now</span><b>{c.onShelf}</b></div>
                <div className="flex justify-between"><span className="text-stone-500">Out for refilling now</span><b>{c.withSupplier}</b></div>
                {c.adjusted !== 0 && (
                  <div className="flex justify-between"><span className="text-stone-500">Corrected by counts</span><b className={c.adjusted < 0 ? "text-red-600" : "text-green-700"}>{c.adjusted > 0 ? "+" : ""}{c.adjusted}</b></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
