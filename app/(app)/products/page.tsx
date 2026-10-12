import { db, num } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import ProductsClient from "@/components/ProductsClient";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const rows = await db()`SELECT * FROM products ORDER BY active DESC, category, selling_price, name`;
  const products = rows.map((r) => ({
    id: r.id, name: r.name, category: r.category,
    buying_price: num(r.buying_price), selling_price: num(r.selling_price),
    stock: r.stock, low_stock_level: r.low_stock_level, track_stock: r.track_stock, active: r.active,
  }));
  return <ProductsClient products={products} welcome={!!sp.welcome} />;
}
