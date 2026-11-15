import Link from "next/link";
import { db, num } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { money, resolveRange, timeOnly } from "@/lib/format";
import RangePicker from "@/components/RangePicker";

export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const { range, from, to } = resolveRange(await searchParams);
  const sql = db();
  const sales = await sql`
    SELECT s.id, s.receipt_no, s.total, s.cost_total, s.payment_method, s.status, s.created_at, u.name AS cashier,
      s.total - coalesce((SELECT sum(amount) FROM sale_payments WHERE sale_id = s.id), 0) AS balance,
      (SELECT string_agg(si.product_name || ' ×' || trim(trailing '.' from trim(trailing '0' from si.quantity::text)) || CASE WHEN si.unit = 'm' THEN ' m' ELSE '' END, ', ') FROM sale_items si WHERE si.sale_id = s.id) AS summary
    FROM sales s LEFT JOIN users u ON u.id = s.user_id
    WHERE (s.created_at AT TIME ZONE 'Africa/Nairobi')::date BETWEEN ${from}::date AND ${to}::date
      AND (${isAdmin} OR s.user_id = ${user.id})
    ORDER BY s.created_at DESC LIMIT 500`;
  const done = sales.filter((s) => s.status === "completed");
  const total = done.reduce((a, s) => a + num(s.total), 0);
  const profit = done.reduce((a, s) => a + num(s.total) - num(s.cost_total), 0);
  const byPay: Record<string, number> = {};
  done.forEach((s) => (byPay[s.payment_method] = (byPay[s.payment_method] || 0) + num(s.total)));

  return (
    <div>
      <h1 className="mb-3 text-2xl font-black">{isAdmin ? "Sales" : "My sales"}</h1>
      <RangePicker range={range} from={from} to={to} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card"><p className="text-xs text-stone-500">Total sales</p><p className="text-xl font-black">{money(total)}</p></div>
        <div className="card"><p className="text-xs text-stone-500">Receipts</p><p className="text-xl font-black">{done.length}</p></div>
        {isAdmin && <div className="card"><p className="text-xs text-stone-500">Profit</p><p className="text-xl font-black text-green-700">{money(profit)}</p></div>}
        <div className="card text-sm">{Object.entries(byPay).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-stone-500">{k}</span><b>{money(v)}</b></div>)}
          {!done.length && <span className="text-stone-400">No payments</span>}</div>
      </div>
      <div className="card divide-y divide-stone-100 p-0">
        {sales.length === 0 && <p className="p-6 text-center text-sm text-stone-400">No sales in this period.</p>}
        {sales.map((s) => (
          <Link key={s.id} href={`/sales/${s.id}`} className="flex items-center gap-3 p-3 hover:bg-stone-50">
            <div className="w-14 text-xs text-stone-400">#{s.receipt_no}<br />{timeOnly(s.created_at)}</div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-semibold ${s.status === "voided" ? "line-through text-stone-400" : ""}`}>{s.summary}</p>
              <p className="text-xs text-stone-400">{s.payment_method} · {s.cashier}{range !== "today" ? " · " + new Date(s.created_at).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" }) : ""}</p>
            </div>
            <div className="text-right">
              <p className={`font-bold ${s.status === "voided" ? "text-stone-400 line-through" : ""}`}>{money(s.total)}</p>
              {s.status === "voided" && <p className="text-xs font-semibold text-red-600">VOIDED</p>}
              {s.status === "completed" && num(s.balance) > 0.004 && <p className="text-xs font-semibold text-amber-700">Owes {money(s.balance)}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
