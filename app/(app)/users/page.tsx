import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import UsersClient from "@/components/UsersClient";

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await db()`SELECT id, name, username, role, active FROM users ORDER BY active DESC, role, name`;
  return <UsersClient users={users as any} meId={me.id} />;
}
