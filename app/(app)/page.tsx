import { db, num } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PosClient from "@/components/PosClient";

export default async function SellPage() {
  const user = await requireUser();
  const sql = db();
  const rows = await sql`SELECT id, name, category, unit, tracks_empties, selling_price, stock, track_stock, low_stock_level
    FROM products WHERE active = TRUE ORDER BY category, selling_price, name`;
  // Best sellers over the last 30 days, shown first as quick buttons
  const top = await sql`SELECT si.product_id FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE s.status = 'completed' AND s.created_at > now() - interval '30 days' AND si.product_id IS NOT NULL
    GROUP BY si.product_id ORDER BY count(*) DESC LIMIT 4`;
  // Names of customers we've served before, to suggest while typing
  const names = await sql`SELECT customer_name FROM sales WHERE customer_name IS NOT NULL AND customer_name <> ''
    GROUP BY customer_name ORDER BY max(created_at) DESC LIMIT 100`;
  const products = rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    category: r.category as string,
    unit: r.unit as string,
    tracksEmpties: !!r.tracks_empties,
    price: num(r.selling_price),
    stock: num(r.stock),
    track: r.track_stock as boolean,
    low: num(r.low_stock_level),
  }));
  return (
    <PosClient products={products} isAdmin={user.role === "admin"}
      popular={top.map((t) => t.product_id as number)}
      customers={names.map((n) => n.customer_name as string)} />
  );
}
