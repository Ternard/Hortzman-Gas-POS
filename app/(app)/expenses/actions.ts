"use server";
import { revalidatePath } from "next/cache";
import { db, num } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { isYMD, todayYMD } from "@/lib/format";

export async function addExpense(_: any, fd: FormData) {
  const admin = await requireAdmin();
  const description = String(fd.get("description") || "").trim();
  const category = String(fd.get("category") || "").trim() || null;
  const amount = num(fd.get("amount"));
  const date = String(fd.get("date") || "");
  if (!description) return { error: "Describe the expense." };
  if (!(amount > 0)) return { error: "Enter an amount." };
  await db()`INSERT INTO expenses (description, category, amount, expense_date, user_id)
    VALUES (${description}, ${category}, ${amount}, ${isYMD(date) ? date : todayYMD()}::date, ${admin.id})`;
  revalidatePath("/expenses");
  return { ok: true, at: Date.now() };
}

export async function deleteExpense(id: number) {
  await requireAdmin();
  await db()`DELETE FROM expenses WHERE id = ${id}`;
  revalidatePath("/expenses");
}
