"use server";
import { revalidatePath } from "next/cache";
import { db, num } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

type Result = { ok?: boolean; error?: string; id?: number };

function refresh() {
  revalidatePath("/empties");
  revalidatePath("/products");
  revalidatePath("/");
}

/** Send empties out for refilling. The empties leave the shop count right away. */
export async function createRequisition(input: {
  items: { productId: number; qty: number }[];
  supplier?: string;
  note?: string;
}): Promise<Result> {
  const admin = await requireAdmin();
  const wanted = (input.items || [])
    .map((i) => ({ productId: Number(i.productId), qty: Math.floor(num(i.qty)) }))
    .filter((i) => i.qty > 0);
  if (!wanted.length) return { error: "Enter how many empties to send for at least one size." };

  const sql = db();
  const rows = await sql`SELECT id, name, empties FROM products WHERE id = ANY(${wanted.map((w) => w.productId)}) AND tracks_empties`;
  const byId = new Map(rows.map((r) => [r.id as number, r]));
  for (const w of wanted) {
    const p = byId.get(w.productId);
    if (!p) return { error: "One of the items doesn't track empties. Refresh and try again." };
    if (w.qty > num(p.empties)) return { error: `You only have ${p.empties} empty ${p.name}.` };
  }

  const [req] = await sql`INSERT INTO requisitions (supplier, note, user_id)
    VALUES (${input.supplier?.trim() || null}, ${input.note?.trim() || null}, ${admin.id}) RETURNING id`;
  try {
    const queries: any[] = [];
    for (const w of wanted) {
      const p = byId.get(w.productId)!;
      queries.push(sql`INSERT INTO requisition_items (requisition_id, product_id, product_name, qty_sent)
        VALUES (${req.id}, ${p.id}, ${p.name}, ${w.qty})`);
      queries.push(sql`UPDATE products SET empties = empties - ${w.qty} WHERE id = ${p.id}`);
    }
    await sql.transaction(queries);
  } catch (e) {
    await sql`DELETE FROM requisitions WHERE id = ${req.id}`;
    throw e;
  }
  refresh();
  return { ok: true, id: req.id };
}

/**
 * Full cylinders came back. Received cylinders go into stock; any not received
 * go back to the empties count so nothing disappears silently.
 */
export async function receiveRequisition(input: { id: number; received: { itemId: number; qty: number }[] }): Promise<Result> {
  const admin = await requireAdmin();
  const sql = db();
  const [req] = await sql`SELECT status FROM requisitions WHERE id = ${input.id}`;
  if (!req) return { error: "Requisition not found." };
  if (req.status !== "sent") return { error: "This requisition is already closed." };

  const items = await sql`SELECT ri.id, ri.product_id, ri.qty_sent, p.track_stock
    FROM requisition_items ri JOIN products p ON p.id = ri.product_id WHERE ri.requisition_id = ${input.id}`;
  const given = new Map((input.received || []).map((r) => [Number(r.itemId), Math.floor(num(r.qty))]));

  const queries: any[] = [
    sql`UPDATE requisitions SET status = 'received', closed_at = now() WHERE id = ${input.id} AND status = 'sent'`,
  ];
  for (const it of items) {
    const sent = num(it.qty_sent);
    const got = Math.min(Math.max(given.get(it.id) ?? sent, 0), sent);
    const short = sent - got;
    queries.push(sql`UPDATE requisition_items SET qty_received = ${got} WHERE id = ${it.id}`);
    if (got > 0 && it.track_stock) {
      queries.push(sql`UPDATE products SET stock = stock + ${got} WHERE id = ${it.product_id}`);
      queries.push(sql`INSERT INTO stock_movements (product_id, qty_change, reason, note, ref, user_id)
        VALUES (${it.product_id}, ${got}, 'restock', 'Refilled cylinders received', ${"REQ-" + input.id}, ${admin.id})`);
    }
    if (short > 0) queries.push(sql`UPDATE products SET empties = empties + ${short} WHERE id = ${it.product_id}`);
  }
  await sql.transaction(queries);
  refresh();
  return { ok: true };
}

/** Cancel a requisition that hasn't been fulfilled; the empties return to the shop count. */
export async function cancelRequisition(id: number): Promise<Result> {
  await requireAdmin();
  const sql = db();
  const [req] = await sql`SELECT status FROM requisitions WHERE id = ${id}`;
  if (!req) return { error: "Requisition not found." };
  if (req.status !== "sent") return { error: "This requisition is already closed." };
  const items = await sql`SELECT product_id, qty_sent FROM requisition_items WHERE requisition_id = ${id}`;
  const queries: any[] = [sql`UPDATE requisitions SET status = 'cancelled', closed_at = now() WHERE id = ${id} AND status = 'sent'`];
  for (const it of items) queries.push(sql`UPDATE products SET empties = empties + ${num(it.qty_sent)} WHERE id = ${it.product_id}`);
  await sql.transaction(queries);
  refresh();
  return { ok: true };
}

/** Physical count of empties on the shelf; corrects the system number. */
export async function setEmpties(input: { id: number; counted: number }): Promise<Result> {
  const admin = await requireAdmin();
  const counted = Math.floor(num(input.counted));
  if (!(counted >= 0)) return { error: "Count can't be negative." };
  const sql = db();
  const [p] = await sql`SELECT empties FROM products WHERE id = ${input.id} AND tracks_empties`;
  if (!p) return { error: "Item not found." };
  const diff = counted - num(p.empties);
  if (diff !== 0) {
    await sql.transaction([
      sql`UPDATE products SET empties = ${counted} WHERE id = ${input.id}`,
      sql`INSERT INTO stock_movements (product_id, qty_change, reason, note, item, user_id)
        VALUES (${input.id}, ${diff}, 'adjustment', 'Empties count', 'empties', ${admin.id})`,
    ]);
  }
  refresh();
  return { ok: true };
}
