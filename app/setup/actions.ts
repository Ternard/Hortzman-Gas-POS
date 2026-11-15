"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ensureSchema, STARTER_PRODUCTS } from "@/lib/schema";
import { createSession } from "@/lib/auth";

export async function setupAction(_: any, fd: FormData): Promise<{ error?: string }> {
  const name = String(fd.get("name") || "").trim();
  const username = String(fd.get("username") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const seed = fd.get("seed") === "on";
  if (!name || !username) return { error: "Enter your name and a username." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  await ensureSchema();
  const sql = db();
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM users`;
  if (count > 0) return { error: "Setup is already done. Please log in." };

  const hash = await bcrypt.hash(password, 10);
  const [u] = await sql`INSERT INTO users (name, username, password_hash, role)
    VALUES (${name}, ${username}, ${hash}, 'admin') RETURNING id, name, username, role`;
  if (seed) {
    for (const p of STARTER_PRODUCTS) {
      await sql`INSERT INTO products (name, category, unit, tracks_empties)
        VALUES (${p.name}, ${p.category}, ${(p as any).unit ?? "pcs"}, ${p.category === "Gas Refill"})`;
    }
  }
  await createSession(u as any);
  redirect(seed ? "/products?welcome=1" : "/");
  return {};
}
