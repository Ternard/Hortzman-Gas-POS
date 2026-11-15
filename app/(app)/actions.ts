"use server";
import { revalidatePath } from "next/cache";
import { db, num } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { cleanQty } from "@/lib/units";
import { qty } from "@/lib/format";

type CheckoutInput = {
  /** noEmpty: the customer did not hand back an empty cylinder for this line. */
  items: { productId: number; qty: number; noEmpty?: boolean }[];
  /** "Credit" = pay later: the customer takes the goods and owes the balance. */
  paymentMethod: "Cash" | "M-Pesa" | "Card" | "Credit";
  /** Credit only: what they paid now (0 or empty = nothing), and how. */
  paidNow?: number;
  paidNowMethod?: "Cash" | "M-Pesa" | "Card";
  /** Credit only: YYYY-MM-DD the customer promised to pay by. */
  dueDate?: string;
  mpesaRef?: string;
  amountPaid?: number;
  discount?: number;
  customerName?: string;
  customerPhone?: string;
};

export async function checkout(input: CheckoutInput): Promise<{ ok?: boolean; id?: string; error?: string }> {
  const user = await requireUser();
  if (!["Cash", "M-Pesa", "Card", "Credit"].includes(input.paymentMethod)) return { error: "Choose a payment method." };
  const isCredit = input.paymentMethod === "Credit";
  if (isCredit && !input.customerName?.trim()) return { error: "Enter the customer's name so you can follow up on the bill." };
  if (isCredit && input.dueDate && !/^d{4}-d{2}-d{2}$/.test(input.dueDate)) return { error: "That date isn't valid." };

  const sql = db();
  const ids = (input.items || []).map((i) => Number(i.productId));
  const rows = await sql`SELECT id, name, unit, tracks_empties, buying_price, selling_price, stock, track_stock, active
    FROM products WHERE id = ANY(${ids})`;
  const byId = new Map(rows.map((r) => [r.id, r]));

  // Pieces must be whole numbers; metres can be fractional (e.g. 2.5).
  const items = (input.items || [])
    .map((i) => ({ productId: Number(i.productId), qty: cleanQty(i.qty, byId.get(Number(i.productId))?.unit), noEmpty: !!i.noEmpty }))
    .filter((i) => i.qty > 0);
  if (!items.length) return { error: "Cart is empty." };

  const round2 = (n: number) => Math.round(n * 100) / 100;
  let subtotal = 0;
  let cost = 0;
  for (const it of items) {
    const p = byId.get(it.productId);
    if (!p || !p.active) return { error: "One of the items is no longer available. Refresh and try again." };
    if (p.track_stock && num(p.stock) < it.qty) return { error: `Only ${qty(p.stock, p.unit)} ${p.unit === "m" ? "of" : "×"} ${p.name} left in stock.` };
    subtotal += round2(num(p.selling_price) * it.qty);
    cost += round2(num(p.buying_price) * it.qty);
  }
  const discount = Math.min(Math.max(num(input.discount), 0), subtotal);
  const total = subtotal - discount;
  const paidNow = isCredit ? Math.round(Math.max(num(input.paidNow), 0) * 100) / 100 : total;
  if (isCredit && paidNow >= total) return { error: "That covers the full amount, so choose Cash, M-Pesa or Card instead of Pay later." };
  const payMethod = isCredit ? input.paidNowMethod : input.paymentMethod;
  if (paidNow > 0 && !["Cash", "M-Pesa", "Card"].includes(String(payMethod))) return { error: "Choose how the customer paid." };
  const paid = !isCredit && input.paymentMethod === "Cash" && input.amountPaid ? num(input.amountPaid) : paidNow;
  if (!isCredit && input.paymentMethod === "Cash" && paid < total) return { error: "Amount received is less than the total." };

  const id = crypto.randomUUID();
  const queries: any[] = [
    sql`INSERT INTO sales (id, user_id, subtotal, discount, total, cost_total, payment_method, mpesa_ref, amount_paid, customer_name, customer_phone, due_date)
        VALUES (${id}, ${user.id}, ${subtotal}, ${discount}, ${total}, ${cost}, ${input.paymentMethod},
                ${input.mpesaRef?.trim().toUpperCase() || null}, ${paid},
                ${input.customerName?.trim() || null}, ${input.customerPhone?.trim() || null},
                ${isCredit ? input.dueDate || null : null})`,
  ];
  // Every payment is recorded; a pay-later sale starts with just the deposit (if any).
  if (paidNow > 0) {
    queries.push(sql`INSERT INTO sale_payments (sale_id, amount, method, mpesa_ref, user_id)
      VALUES (${id}, ${paidNow}, ${payMethod}, ${input.mpesaRef?.trim().toUpperCase() || null}, ${user.id})`);
  }
  for (const it of items) {
    const p = byId.get(it.productId);
    // A swapped refill brings an empty cylinder back into the shop (whole cylinders only).
    const emptyBack = !!p.tracks_empties && !it.noEmpty && p.unit !== "m";
    queries.push(sql`INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit, unit_price, unit_cost, empty_returned)
      VALUES (${id}, ${p.id}, ${p.name}, ${it.qty}, ${p.unit}, ${p.selling_price}, ${p.buying_price}, ${emptyBack})`);
    if (emptyBack) queries.push(sql`UPDATE products SET empties = empties + ${it.qty} WHERE id = ${p.id}`);
    if (p.track_stock) {
      queries.push(sql`UPDATE products SET stock = stock - ${it.qty} WHERE id = ${p.id}`);
      queries.push(sql`INSERT INTO stock_movements (product_id, qty_change, reason, ref, user_id)
        VALUES (${p.id}, ${-it.qty}, 'sale', ${id}, ${user.id})`);
    }
  }
  await sql.transaction(queries);
  revalidatePath("/");
  revalidatePath("/empties");
  revalidatePath("/debts");
  return { ok: true, id };
}

export async function voidSale(id: string): Promise<{ ok?: boolean; error?: string }> {
  const admin = await requireAdmin();
  const sql = db();
  const [sale] = await sql`SELECT status FROM sales WHERE id = ${id}`;
  if (!sale) return { error: "Sale not found." };
  if (sale.status === "voided") return { error: "Sale is already voided." };
  const items = await sql`SELECT si.product_id, si.quantity, si.empty_returned, p.track_stock FROM sale_items si
    JOIN products p ON p.id = si.product_id WHERE si.sale_id = ${id}`;
  const queries: any[] = [
    sql`UPDATE sales SET status = 'voided', voided_by = ${admin.id}, voided_at = now() WHERE id = ${id}`,
  ];
  for (const it of items) {
    const q = num(it.quantity);
    // The empty that came back with this sale goes back out (never below zero).
    if (it.empty_returned) queries.push(sql`UPDATE products SET empties = GREATEST(0, empties - ${Math.round(q)}) WHERE id = ${it.product_id}`);
    if (!it.track_stock) continue;
    queries.push(sql`UPDATE products SET stock = stock + ${q} WHERE id = ${it.product_id}`);
    queries.push(sql`INSERT INTO stock_movements (product_id, qty_change, reason, ref, user_id)
      VALUES (${it.product_id}, ${q}, 'void', ${id}, ${admin.id})`);
  }
  await sql.transaction(queries);
  revalidatePath("/sales");
  revalidatePath("/empties");
  return { ok: true };
}
