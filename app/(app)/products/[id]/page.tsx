import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db, num } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { dateTime, qty } from "@/lib/format";

const REASONS: Record<string, string> = {
  sale: "Sold",
  void: "Sale voided",
  restock: "Stock received",
  opening: "Opening stock",
  adjustment: "Stock count",
};

export default async function ProductHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const sql = db();
  const [p] = await sql`SELECT id, name, unit, stock, empties, track_stock, tracks_empties FROM products WHERE id = ${Number(id)}`;
  if (!p) notFound();
  const moves = await sql`
    SELECT m.id, m.qty_change, m.reason, m.note, m.ref, m.item, m.created_at, u.name AS who
    FROM stock_movements m LEFT JOIN users u ON u.id = m.user_id
    WHERE m.product_id = ${p.id} ORDER BY m.created_at DESC, m.id DESC LIMIT 200`;

  const refLink = (ref: string | null) => {
    if (!ref) return null;
    if (/^[0-9a-f-]{36}$/i.test(ref)) return <Link href={`/sales/${ref}`} className="underline">receipt</Link>;
    const m = /^REQ-(\d+)$/.exec(ref);
    if (m) return <Link href={`/empties/${m[1]}`} className="underline">{ref}</Link>;
    return <span>{ref}</span>;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/products" className="inline-flex items-center gap-1 text-sm font-semibold text-stone-500"><ArrowLeft size={16} /> Items & stock</Link>
      <div className="card">
        <h1 className="text-xl font-black">{p.name}</h1>
        <div className="mt-2 flex gap-6 text-sm">
          {p.track_stock && <div><p className="text-stone-400">In stock</p><p className="text-lg font-black">{qty(p.stock, p.unit)}</p></div>}
          {p.tracks_empties && <div><p className="text-stone-400">Empties</p><p className="text-lg font-black">{num(p.empties)}</p></div>}
        </div>
      </div>

      <div className="card divide-y divide-stone-100 p-0">
        <h2 className="p-4 pb-3 font-bold">Stock history</h2>
        {moves.length === 0 && <p className="p-6 pt-2 text-center text-sm text-stone-400">Nothing recorded yet.</p>}
        {moves.map((m) => {
          const c = num(m.qty_change);
          const empties = m.item === "empties";
          return (
            <div key={m.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {REASONS[m.reason as string] ?? m.reason}
                  {empties && <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-bold text-stone-600">EMPTIES</span>}
                </p>
                <p className="text-xs text-stone-400">
                  {dateTime(m.created_at)}{m.who ? ` · ${m.who}` : ""}{m.ref ? " · " : ""}{refLink(m.ref as string | null)}
                </p>
                {m.note && <p className="text-xs text-stone-500">{m.note}</p>}
              </div>
              <p className={`text-lg font-black ${c < 0 ? "text-red-600" : "text-green-700"}`}>
                {c > 0 ? "+" : ""}{empties ? c : qty(c, p.unit)}
              </p>
            </div>
          );
        })}
      </div>
      {moves.length === 200 && <p className="text-center text-xs text-stone-400">Showing the latest 200 entries.</p>}
    </div>
  );
}
