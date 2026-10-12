"use server";
import { revalidatePath } from "next/cache";
import { db, num } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";

type CheckoutInput = {
  items: { productId: number; qty: number }[];
  paymentMethod: "Cash" | "M-Pesa" | "Card";
  mpesaRef?: string;
  amountPaid?: number;
  discount?: number;
  customerName?: string;
  customerPhone?: string;
};

export async function checkout(input: CheckoutInput): Promise<{ ok?: boolean; id?: string; error?: string }> {
  const user = await requireUser();
  const items = (input.items || []).filter((i) => Number.isInteger(i.qty) && i.qty > 0);
  if (!items.length) return { error: "Cart is empty." };
  if (!["Cash", "M-Pesa", "Card"].includes(input.paymentMethod)) return { error: "Choose a payment method." };

  const sql = db();
  const ids = items.map((i) => Number(i.productId));
  const rows = await sql`SELECT id, name, buying_price, selling_price, stock, track_stock, active
    FROM products WHERE id = ANY(${ids})`;
  const byId = new Map(rows.map((r) => [r.id, r]));

  let subtotal = 0;
  let cost = 0;
  for (const it of items) {
    const p = byId.get(Number(it.productId));
    if (!p || !p.active) return { error: "One of the items is no longer available. Refresh and try again." };
    if (p.track_stock && p.stock < it.qty) return { error: `Only ${p.stock} × ${p.name} left in stock.` };
    subtotal += num(p.selling_price) * it.qty;
    cost += num(p.buying_price) * it.qty;
  }
  const discount = Math.min(Math.max(num(input.discount), 0), subtotal);
  const total = subtotal - discount;
  const paid = input.paymentMethod === "Cash" && input.amountPaid ? num(input.amountPaid) : total;
  if (input.paymentMethod === "Cash" && paid < total) return { error: "Amount received is less than the total." };

  const id = crypto.randomUUID();
  const queries: any[] = [
    sql`INSERT INTO sales (id, user_id, subtotal, discount, total, cost_total, payment_method, mpesa_ref, amount_paid, customer_name, customer_phone)
        VALUES (${id}, ${user.id}, ${subtotal}, ${discount}, ${total}, ${cost}, ${input.paymentMethod},
                ${input.mpesaRef?.trim().toUpperCase() || null}, ${paid},
                ${input.customerName?.trim() || null}, ${input.customerPhone?.trim() || null})`,
  ];
  for (const it of items) {
    const p = byId.get(Number(it.productId));
    queries.push(sql`INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost)
      VALUES (${id}, ${p.id}, ${p.name}, ${it.qty}, ${p.selling_price}, ${p.buying_price})`);
    if (p.track_stock) {
      queries.push(sql`UPDATE products SET stock = stock - ${it.qty} WHERE id = ${p.id}`);
      queries.push(sql`INSERT INTO stock_movements (product_id, qty_change, reason, ref, user_id)
        VALUES (${p.id}, ${-it.qty}, 'sale', ${id}, ${user.id})`);
    }
  }
  await sql.transaction(queries);
  revalidatePath("/");
  return { ok: true, id };
}

export async function voidSale(id: string): Promise<{ ok?: boolean; error?: string }> {
  const admin = await requireAdmin();
  const sql = db();
  const [sale] = await sql`SELECT status FROM sales WHERE id = ${id}`;
  if (!sale) return { error: "Sale not found." };
  if (sale.status === "voided") return { error: "Sale is already voided." };
  const items = await sql`SELECT si.product_id, si.quantity, p.track_stock FROM sale_items si
    JOIN products p ON p.id = si.product_id WHERE si.sale_id = ${id}`;
  const queries: any[] = [
    sql`UPDATE sales SET status = 'voided', voided_by = ${admin.id}, voided_at = now() WHERE id = ${id}`,
  ];
  for (const it of items) {
    if (!it.track_stock) continue;
    queries.push(sql`UPDATE products SET stock = stock + ${it.quantity} WHERE id = ${it.product_id}`);
    queries.push(sql`INSERT INTO stock_movements (product_id, qty_change, reason, ref, user_id)
      VALUES (${it.product_id}, ${it.quantity}, 'void', ${id}, ${admin.id})`);
  }
  await sql.transaction(queries);
  revalidatePath("/sales");
  return { ok: true };
}
