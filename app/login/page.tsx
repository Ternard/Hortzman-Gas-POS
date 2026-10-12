import Link from "next/link";
import { Flame } from "lucide-react";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ disabled?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-2xl bg-orange-600 p-3 text-white"><Flame /></div>
        <div><h1 className="text-xl font-black tracking-tight">HORTZMAN GAS</h1><p className="text-sm text-stone-500">Point of Sale</p></div>
      </div>
      {sp.disabled && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Your account is disabled or no longer exists.</p>}
      <div className="card"><LoginForm /></div>
      <p className="mt-4 text-center text-sm text-stone-500">First time? <Link href="/setup" className="font-semibold text-orange-700">Set up the shop</Link></p>
    </main>
  );
}
