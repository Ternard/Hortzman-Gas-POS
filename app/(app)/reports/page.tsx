import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { db, num } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { money, resolveRange } from "@/lib/format";
import RangePicker from "@/components/RangePicker";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const { range, from, to } = resolveRange(await searchParams);
  const sql = db();

  const [summary] = await sql`
    SELECT count(*)::int AS receipts, coalesce(sum(total),0) AS revenue, coalesce(sum(cost_total),0) AS cost,
           coalesce(sum(discount),0) AS discount
    FROM sales WHERE status = 'completed'
      AND (created_at AT TIME ZONE 'Africa/Nairobi')::date BETWEEN ${from}::date AND ${to}::date`;
  const [exp] = await sql`SELECT coalesce(sum(amount),0) AS total FROM expenses
    WHERE expense_date BETWEEN ${from}::date AND ${to}::date`;
  const byPay = await sql`SELECT payment_method, count(*)::int AS n, sum(total) AS total FROM sales
    WHERE status = 'completed' AND (created_at AT TIME ZONE 'Africa/Nairobi')::date BETWEEN ${from}::date AND ${to}::date
    GROUP BY payment_method ORDER BY total DESC`;
  const byItem = await sql`
    SELECT si.product_name, sum(si.quantity)::int AS qty, sum(si.quantity * si.unit_price) AS revenue,
           sum(si.quantity * (si.unit_price - si.unit_cost)) AS profit
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE s.status = 'completed' AND (s.created_at AT TIME ZONE 'Africa/Nairobi')::date BETWEEN ${from}::date AND ${to}::date
    GROUP BY si.product_name ORDER BY revenue DESC`;
  const daily = await sql`
    SELECT to_char((created_at AT TIME ZONE 'Africa/Nairobi')::date, 'YYYY-MM-DD') AS day, count(*)::int AS n,
           sum(total) AS revenue, sum(total - cost_total) AS profit
    FROM sales WHERE status = 'completed'
      AND (created_at AT TIME ZONE 'Africa/Nairobi')::date BETWEEN ${from}::date AND ${to}::date
    GROUP BY 1 ORDER BY 1 DESC`;
  const low = await sql`SELECT id, name, stock, low_stock_level FROM products
    WHERE active AND track_stock AND stock <= low_stock_level ORDER BY stock`;
  const [inv] = await sql`SELECT coalesce(sum(stock * buying_price),0) AS cost_value, coalesce(sum(stock * selling_price),0) AS retail_value
    FROM products WHERE active AND track_stock`;

  const revenue = num(summary.revenue);
  const gross = revenue - num(summary.cost);
  const expenses = num(exp.total);
  const net = gross - expenses;
  const maxDay = Math.max(1, ...daily.map((d) => num(d.revenue)));

  const Stat = ({ label, value, tone = "" }: { label: string; value: string; tone?: string }) => (
    <div className="card"><p className="text-xs text-stone-500">{label}</p><p className={`text-xl font-black ${tone}`}>{value}</p></div>
  );

  return (
    <div>
      <h1 className="mb-3 text-2xl font-black">Reports</h1>
      <RangePicker range={range} from={from} to={to} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales (money in)" value={money(revenue)} />
        <Stat label="Cost of items sold" value={money(summary.cost)} />
        <Stat label="Gross profit" value={money(gross)} tone="text-green-700" />
        <Stat label={`Net profit (after ${money(expenses)} expenses)`} value={money(net)} tone={net < 0 ? "text-red-600" : "text-green-700"} />
      </div>
      <p className="mt-2 text-xs text-stone-500">{summary.receipts} receipts{num(summary.discount) > 0 ? ` · ${money(summary.discount)} given as discounts` : ""}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-bold">By item</h2>
          {byItem.length === 0 ? <p className="text-sm text-stone-400">No sales yet.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-400"><tr><th className="pb-2">Item</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Sales</th><th className="pb-2 text-right">Profit</th></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {byItem.map((r) => (
                  <tr key={r.product_name}><td className="py-2 font-medium">{r.product_name}</td><td className="text-right">{r.qty}</td>
                    <td className="text-right">{money(r.revenue)}</td><td className="text-right text-green-700">{money(r.profit)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="mb-3 font-bold">Payments</h2>
            {byPay.length === 0 && <p className="text-sm text-stone-400">No payments.</p>}
            {byPay.map((p) => (
              <div key={p.payment_method} className="flex justify-between py-1 text-sm">
                <span>{p.payment_method} <span className="text-stone-400">({p.n})</span></span><b>{money(p.total)}</b>
              </div>
            ))}
          </div>
          <div className="card">
            <h2 className="mb-3 font-bold">Stock on hand</h2>
            <div className="flex justify-between text-sm"><span>Value at buying price</span><b>{money(inv.cost_value)}</b></div>
            <div className="flex justify-between text-sm"><span>Value at selling price</span><b>{money(inv.retail_value)}</b></div>
            {low.length > 0 && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3">
                <p className="mb-1 flex items-center gap-1 text-sm font-semibold text-amber-900"><AlertTriangle size={15} /> Restock soon</p>
                {low.map((l) => <p key={l.id} className="text-sm text-amber-900">{l.name}: <b>{l.stock}</b> left</p>)}
                <Link href="/products" className="mt-2 inline-block text-sm font-semibold text-orange-700">Go to stock →</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {daily.length > 1 && (
        <div className="card mt-4">
          <h2 className="mb-3 font-bold">Day by day</h2>
          <div className="space-y-2">
            {daily.map((d) => (
              <div key={d.day} className="text-sm">
                <div className="flex justify-between"><span>{new Date(d.day + "T00:00:00").toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })} <span className="text-stone-400">· {d.n} sales</span></span>
                  <span><b>{money(d.revenue)}</b> <span className="text-green-700">(+{money(d.profit)})</span></span></div>
                <div className="mt-1 h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full bg-orange-500" style={{ width: `${(num(d.revenue) / maxDay) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
