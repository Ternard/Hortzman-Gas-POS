import { db, num } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PosClient from "@/components/PosClient";

export default async function SellPage() {
  const user = await requireUser();
  const rows = await db()`SELECT id, name, category, selling_price, stock, track_stock, low_stock_level
    FROM products WHERE active = TRUE ORDER BY category, selling_price, name`;
  const products = rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    category: r.category as string,
    price: num(r.selling_price),
    stock: r.stock as number,
    track: r.track_stock as boolean,
    low: r.low_stock_level as number,
  }));
  return <PosClient products={products} isAdmin={user.role === "admin"} />;
}
