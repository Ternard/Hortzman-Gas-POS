"use server";
import { revalidatePath } from "next/cache";
import { db, num } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

type Result = { ok?: boolean; error?: string };

export async function saveProduct(input: {
  id?: number;
  name: string;
  category: string;
  buying_price: number;
  selling_price: number;
  stock?: number;
  low_stock_level: number;
  track_stock: boolean;
}): Promise<Result> {
  const admin = await requireAdmin();
  const name = input.name?.trim();
  const category = input.category?.trim() || "Other";
  const buy = num(input.buying_price);
  const sell = num(input.selling_price);
  const low = Math.max(0, Math.floor(num(input.low_stock_level)));
  if (!name) return { error: "Item name is required." };
  if (buy < 0 || sell < 0) return { error: "Prices can't be negative." };
  const sql = db();
  if (input.id) {
    await sql`UPDATE products SET name = ${name}, category = ${category}, buying_price = ${buy},
      selling_price = ${sell}, low_stock_level = ${low}, track_stock = ${!!input.track_stock}
      WHERE id = ${input.id}`;
  } else {
    const stock = Math.max(0, Math.floor(num(input.stock)));
    const [p] = await sql`INSERT INTO products (name, category, buying_price, selling_price, stock, low_stock_level, track_stock)
      VALUES (${name}, ${category}, ${buy}, ${sell}, ${stock}, ${low}, ${!!input.track_stock}) RETURNING id`;
    if (stock > 0) {
      await sql`INSERT INTO stock_movements (product_id, qty_change, reason, unit_cost, note, user_id)
        VALUES (${p.id}, ${stock}, 'opening', ${buy}, 'Opening stock', ${admin.id})`;
    }
  }
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true };
}

export async function restock(input: { id: number; qty: number; unit_cost: number; updatePrice: boolean; note?: string }): Promise<Result> {
  const admin = await requireAdmin();
  const qty = Math.floor(num(input.qty));
  const cost = num(input.unit_cost);
  if (qty <= 0) return { error: "Enter how many you received." };
  if (cost < 0) return { error: "Cost can't be negative." };
  const sql = db();
  const queries: any[] = [
    input.updatePrice && cost > 0
      ? sql`UPDATE products SET stock = stock + ${qty}, buying_price = ${cost} WHERE id = ${input.id}`
      : sql`UPDATE products SET stock = stock + ${qty} WHERE id = ${input.id}`,
    sql`INSERT INTO stock_movements (product_id, qty_change, reason, unit_cost, note, user_id)
      VALUES (${input.id}, ${qty}, 'restock', ${cost}, ${input.note?.trim() || null}, ${admin.id})`,
  ];
  await sql.transaction(queries);
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true };
}

/** Stock take: set the counted quantity; the difference is logged. */
export async function adjustStock(input: { id: number; counted: number; note?: string }): Promise<Result> {
  const admin = await requireAdmin();
  const counted = Math.floor(num(input.counted));
  if (counted < 0) return { error: "Count can't be negative." };
  const sql = db();
  const [p] = await sql`SELECT stock FROM products WHERE id = ${input.id}`;
  if (!p) return { error: "Item not found." };
  const diff = counted - p.stock;
  if (diff === 0) return { ok: true };
  await sql.transaction([
    sql`UPDATE products SET stock = ${counted} WHERE id = ${input.id}`,
    sql`INSERT INTO stock_movements (product_id, qty_change, reason, note, user_id)
      VALUES (${input.id}, ${diff}, 'adjustment', ${input.note?.trim() || "Stock count"}, ${admin.id})`,
  ]);
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true };
}

export async function setActive(id: number, active: boolean): Promise<Result> {
  await requireAdmin();
  await db()`UPDATE products SET active = ${active} WHERE id = ${id}`;
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true };
}
