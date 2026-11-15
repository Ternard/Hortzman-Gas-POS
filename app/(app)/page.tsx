import { db, num } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PosClient from "@/components/PosClient";

export default async function SellPage() {
  const user = await requireUser();
  const rows = await db()`SELECT id, name, category, unit, tracks_empties, selling_price, stock, track_stock, low_stock_level
    FROM products WHERE active = TRUE ORDER BY category, selling_price, name`;
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
  return <PosClient products={products} isAdmin={user.role === "admin"} />;
}
