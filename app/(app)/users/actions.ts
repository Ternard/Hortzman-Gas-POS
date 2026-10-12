"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function addUser(_: any, fd: FormData) {
  await requireAdmin();
  const name = String(fd.get("name") || "").trim();
  const username = String(fd.get("username") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const role = fd.get("role") === "admin" ? "admin" : "cashier";
  if (!name || !username) return { error: "Name and username are required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  const sql = db();
  const exists = await sql`SELECT 1 FROM users WHERE username = ${username}`;
  if (exists.length) return { error: "That username is taken." };
  await sql`INSERT INTO users (name, username, password_hash, role) VALUES (${name}, ${username}, ${await bcrypt.hash(password, 10)}, ${role})`;
  revalidatePath("/users");
  return { ok: true, at: Date.now() };
}

export async function toggleUser(id: number, active: boolean) {
  const me = await requireAdmin();
  if (id === me.id) return { error: "You can't disable yourself." };
  await db()`UPDATE users SET active = ${active} WHERE id = ${id}`;
  revalidatePath("/users");
  return { ok: true };
}

export async function resetPassword(id: number, password: string) {
  await requireAdmin();
  if (!password || password.length < 6) return { error: "Password must be at least 6 characters." };
  await db()`UPDATE users SET password_hash = ${await bcrypt.hash(password, 10)} WHERE id = ${id}`;
  return { ok: true };
}
