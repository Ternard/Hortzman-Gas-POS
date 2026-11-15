import { db, num } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { resolveRange } from "@/lib/format";
import StockTakeClient from "@/components/StockTakeClient";
import RangePicker from "@/components/RangePicker";

export default async function StockTakePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const { range, from, to } = resolveRange(await searchParams);
  const sql = db();

  const rows = await sql`SELECT id, name, category, unit, stock, empties, buying_price, track_stock, tracks_empties
    FROM products WHERE active AND (track_stock OR tracks_empties) ORDER BY category, selling_price, name`;
  const products = rows.map((r) => ({
    id: r.id as number, name: r.name as string, category: r.category as string, unit: r.unit as string,
    stock: num(r.stock), empties: num(r.empties), cost: num(r.buying_price),
    trackStock: !!r.track_stock, tracksEmpties: !!r.tracks_empties,
  }));

  // Cylinder check: for each swap item, how many refills went out vs how many empties came back.
  const emptyIds = products.filter((p) => p.tracksEmpties).map((p) => p.id);
  const sold = await sql`
    SELECT si.product_id, sum(si.quantity) AS sold,
           coalesce(sum(si.quantity) FILTER (WHERE si.empty_returned), 0) AS returned
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE s.status = 'completed' AND si.product_id = ANY(${emptyIds})
      AND (s.created_at AT TIME ZONE 'Africa/Nairobi')::date BETWEEN ${from}::date AND ${to}::date
    GROUP BY si.product_id`;
  const supplier = await sql`
    SELECT ri.product_id, sum(ri.qty_sent) AS qty FROM requisition_items ri
    JOIN requisitions r ON r.id = ri.requisition_id
    WHERE r.status = 'sent' AND ri.product_id = ANY(${emptyIds}) GROUP BY ri.product_id`;
  const adj = await sql`
    SELECT product_id, sum(qty_change) AS qty FROM stock_movements
    WHERE item = 'empties' AND product_id = ANY(${emptyIds})
      AND (created_at AT TIME ZONE 'Africa/Nairobi')::date BETWEEN ${from}::date AND ${to}::date
    GROUP BY product_id`;
  const soldBy = new Map(sold.map((r) => [r.product_id as number, r]));
  const supBy = new Map(supplier.map((r) => [r.product_id as number, num(r.qty)]));
  const adjBy = new Map(adj.map((r) => [r.product_id as number, num(r.qty)]));
  const check = products.filter((p) => p.tracksEmpties).map((p) => {
    const s = soldBy.get(p.id);
    const total = num(s?.sold);
    const back = num(s?.returned);
    return { id: p.id, name: p.name, sold: total, returned: back, gap: total - back, withSupplier: supBy.get(p.id) ?? 0, adjusted: adjBy.get(p.id) ?? 0, onShelf: p.empties };
  });

  return (
    <StockTakeClient products={products} check={check}
      picker={<RangePicker range={range} from={from} to={to} />} />
  );
}
