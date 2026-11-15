"use server";
import { revalidatePath } from "next/cache";
import { db, num } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Result = { ok?: boolean; error?: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

function refresh(saleId?: string) {
  revalidatePath("/debts");
  revalidatePath("/sales");
  revalidatePath("/reports");
  if (saleId) revalidatePath(`/sales/${saleId}`);
}

/** The customer paid some or all of what they owe on a bill. */
export async function recordPayment(input: {
  saleId: string;
  amount: number;
  method: "Cash" | "M-Pesa" | "Card";
  mpesaRef?: string;
}): Promise<Result> {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(input.saleId)) return { error: "Bill not found." };
  if (!["Cash", "M-Pesa", "Card"].includes(input.method)) return { error: "Choose how they paid." };
  const amount = round2(num(input.amount));
  if (!(amount > 0)) return { error: "Enter the amount received." };

  const sql = db();
  const [s] = await sql`SELECT s.total, s.status,
      coalesce((SELECT sum(amount) FROM sale_payments WHERE sale_id = s.id), 0) AS paid
    FROM sales s WHERE s.id = ${input.saleId}`;
  if (!s || s.status !== "completed") return { error: "This bill can't take payments." };
  const balance = round2(num(s.total) - num(s.paid));
  if (balance <= 0) return { error: "This bill is already fully paid." };
  if (amount > balance) return { error: `They only owe KES ${balance.toLocaleString("en-KE")}.` };

  await sql`INSERT INTO sale_payments (sale_id, amount, method, mpesa_ref, user_id)
    VALUES (${input.saleId}, ${amount}, ${input.method}, ${input.mpesaRef?.trim().toUpperCase() || null}, ${user.id})`;
  refresh(input.saleId);
  return { ok: true };
}

/** Change (or clear) the date the customer promised to pay by. */
export async function setDueDate(saleId: string, date: string): Promise<Result> {
  await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(saleId)) return { error: "Bill not found." };
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "That date isn't valid." };
  await db()`UPDATE sales SET due_date = ${date || null} WHERE id = ${saleId}`;
  refresh(saleId);
  return { ok: true };
}
