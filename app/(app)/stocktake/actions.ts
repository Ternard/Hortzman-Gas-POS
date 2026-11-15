"use server";
import { revalidatePath } from "next/cache";
import { db, num } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { cleanQty } from "@/lib/units";
import { todayYMD } from "@/lib/format";

type Count = { productId: number; kind: "stock" | "empties"; counted: number };
type Result = { ok?: boolean; error?: string; changed?: number; checked?: number; netValue?: number; ref?: string };

/**
 * Save a whole-shop stock take. Rows left blank by the client aren't sent.
 * Each difference is logged as an adjustment under one reference (ST-<date>).
 */
export async function saveStockTake(input: { counts: Count[]; note?: string }): Promise<Result> {
  const admin = await requireAdmin();
  const counts = (input.counts || []).filter((c) => Number.isFinite(Number(c.counted)));
  if (!counts.length) return { error: "Enter at least one count." };
  if (counts.some((c) => Number(c.counted) < 0)) return { error: "Counts can't be negative." };

  const sql = db();
  const ids = Array.from(new Set(counts.map((c) => Number(c.productId))));
  const rows = await sql`SELECT id, name, unit, stock, empties, buying_price, track_stock, tracks_empties
    FROM products WHERE id = ANY(${ids})`;
  const byId = new Map(rows.map((r) => [r.id as number, r]));

  const ref = `ST-${todayYMD()}`;
  const note = input.note?.trim() ? `Stock take: ${input.note.trim()}` : "Stock take";
  const queries: any[] = [];
  let changed = 0;
  let netValue = 0;
  const seen = new Set<string>();

  for (const c of counts) {
    const p = byId.get(Number(c.productId));
    if (!p) return { error: "One of the items no longer exists. Refresh and try again." };
    const key = `${p.id}:${c.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (c.kind === "empties") {
      if (!p.tracks_empties) continue;
      const counted = Math.floor(num(c.counted));
      const diff = counted - num(p.empties);
      if (diff === 0) continue;
      queries.push(sql`UPDATE products SET empties = ${counted} WHERE id = ${p.id}`);
      queries.push(sql`INSERT INTO stock_movements (product_id, qty_change, reason, note, ref, item, user_id)
        VALUES (${p.id}, ${diff}, 'adjustment', ${note}, ${ref}, 'empties', ${admin.id})`);
      changed++;
    } else {
      if (!p.track_stock) continue;
      const counted = cleanQty(c.counted, p.unit);
      const diff = Math.round((counted - num(p.stock)) * 1000) / 1000;
      if (diff === 0) continue;
      queries.push(sql`UPDATE products SET stock = ${counted} WHERE id = ${p.id}`);
      queries.push(sql`INSERT INTO stock_movements (product_id, qty_change, reason, unit_cost, note, ref, user_id)
        VALUES (${p.id}, ${diff}, 'adjustment', ${p.buying_price}, ${note}, ${ref}, ${admin.id})`);
      netValue += diff * num(p.buying_price);
      changed++;
    }
  }
  if (queries.length) await sql.transaction(queries);
  revalidatePath("/stocktake");
  revalidatePath("/products");
  revalidatePath("/empties");
  revalidatePath("/");
  return { ok: true, changed, checked: seen.size, netValue: Math.round(netValue * 100) / 100, ref };
}
