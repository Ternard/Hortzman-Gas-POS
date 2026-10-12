import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

export const SESSION_COOKIE = "hg_session";

export type Session = {
  id: number;
  name: string;
  username: string;
  role: "admin" | "cashier";
};

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set. Add it in Vercel → Settings → Environment Variables.");
  return new TextEncoder().encode(s);
}

export async function createSession(u: Session) {
  const token = await new SignJWT({ id: u.id, name: u.name, username: u.username, role: u.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

/** Ensures a logged-in, still-active user. Role is re-read from the DB so changes apply immediately. */
export async function requireUser(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  const sql = db();
  const rows = await sql`SELECT id, name, username, role, active FROM users WHERE id = ${s.id}`;
  const u = rows[0];
  if (!u || !u.active) redirect("/login?disabled=1");
  return { id: u.id, name: u.name, username: u.username, role: u.role };
}

export async function requireAdmin(): Promise<Session> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/");
  return u;
}
