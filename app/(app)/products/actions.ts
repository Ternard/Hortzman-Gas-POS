"use server";
import { revalidatePath } from "next/cache";
import { db, num } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { cleanQty, cleanUnit } from "@/lib/units";

type Result = { ok?: boolean; error?: string };

export async function saveProduct(input: {
  id?: number;
  name: string;
  category: string;
  unit?: string;
  buying_price: number;
  selling_price: number;
  stock?: number;
  low_stock_level: number;
  track_stock: boolean;
  tracks_empties?: boolean;
}): Promise<Result> {
  const admin = await requireAdmin();
  const name = input.name?.trim();
  const category = input.category?.trim() || "Other";
  const unit = cleanUnit(input.unit);
  const buy = num(input.buying_price);
  const sell = num(input.selling_price);
  const low = Math.max(0, cleanQty(input.low_stock_level, unit));
  if (!name) return { error: "Item name is required." };
  if (buy < 0 || sell < 0) return { error: "Prices can't be negative." };
  const sql = db();
  if (input.id) {
    // Changing between pieces and metres would silently re-label existing stock, so keep the existing unit once the item has history.
    const [cur] = await sql`SELECT unit FROM products WHERE id = ${input.id}`;
    if (cur && cur.unit !== unit) {
      const [hist] = await sql`SELECT (SELECT count(*) FROM stock_movements WHERE product_id = ${input.id})::int AS n`;
      if (hist.n > 0) return { error: "You can't change between pieces and metres after stock has been added or sold. Add a new item instead." };
    }
    await sql`UPDATE products SET name = ${name}, category = ${category}, unit = ${unit}, buying_price = ${buy},
      selling_price = ${sell}, low_stock_level = ${low}, track_stock = ${!!input.track_stock},
      tracks_empties = ${!!input.tracks_empties && unit === "pcs"}
      WHERE id = ${input.id}`;
  } else {
    const stock = Math.max(0, cleanQty(input.stock, unit));
    const [p] = await sql`INSERT INTO products (name, category, unit, buying_price, selling_price, stock, low_stock_level, track_stock, tracks_empties)
      VALUES (${name}, ${category}, ${unit}, ${buy}, ${sell}, ${stock}, ${low}, ${!!input.track_stock}, ${!!input.tracks_empties && unit === "pcs"}) RETURNING id`;
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
  const sql = db();
  const [p] = await sql`SELECT unit FROM products WHERE id = ${input.id}`;
  if (!p) return { error: "Item not found." };
  const qty = cleanQty(input.qty, p.unit);
  const cost = num(input.unit_cost);
  if (qty <= 0) return { error: p.unit === "m" ? "Enter how many metres you received." : "Enter how many you received." };
  if (cost < 0) return { error: "Cost can't be negative." };
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
  const sql = db();
  const [p] = await sql`SELECT stock, unit FROM products WHERE id = ${input.id}`;
  if (!p) return { error: "Item not found." };
  const counted = cleanQty(input.counted, p.unit);
  if (counted < 0) return { error: "Count can't be negative." };
  const diff = Math.round((counted - num(p.stock)) * 1000) / 1000;
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
