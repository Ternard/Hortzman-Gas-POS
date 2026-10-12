"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";

export async function loginAction(_: any, fd: FormData): Promise<{ error?: string }> {
  const username = String(fd.get("username") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const rows = await db()`SELECT id, name, username, role, password_hash, active FROM users WHERE username = ${username}`;
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return { error: "Wrong username or password." };
  if (!u.active) return { error: "This account has been disabled. Talk to the owner." };
  await createSession({ id: u.id, name: u.name, username: u.username, role: u.role });
  redirect("/");
  return {};
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
