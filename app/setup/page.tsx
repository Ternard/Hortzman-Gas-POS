import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import SetupForm from "./SetupForm";
import { Flame } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  let count = 0;
  try {
    await ensureSchema();
    const rows = await db()`SELECT count(*)::int AS count FROM users`;
    count = rows[0].count;
  } catch (e: any) {
    return (
      <main className="mx-auto max-w-md p-6">
        <div className="card space-y-2">
          <h1 className="text-lg font-bold">Database not connected</h1>
          <p className="text-sm text-stone-600">{e.message}</p>
          <p className="text-sm text-stone-600">In Vercel open your project → Storage → add Neon (free), connect it to this project, then redeploy.</p>
        </div>
      </main>
    );
  }
  if (count > 0) redirect("/login");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-2xl bg-orange-600 p-3 text-white"><Flame /></div>
        <div><h1 className="text-xl font-black tracking-tight">HORTZMAN GAS</h1><p className="text-sm text-stone-500">First-time setup</p></div>
      </div>
      <div className="card"><SetupForm /></div>
    </main>
  );
}
