import { Flame } from "lucide-react";
import Link from "next/link";
import Nav from "@/components/Nav";
import HelpButton from "@/components/HelpButton";
import OfflineBanner from "@/components/OfflineBanner";
import { requireUser } from "@/lib/auth";
import { migrate } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await migrate();
  return (
    <div className="min-h-dvh pb-24 md:pb-8">
      <header className="no-print sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="rounded-lg bg-orange-600 p-1.5 text-white"><Flame size={18} /></span>
            <span className="font-black tracking-tight">HORTZMAN GAS</span>
          </Link>
          <Nav role={user.role} />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-stone-500 sm:block">{user.name}</span>
            <HelpButton />
          </div>
        </div>
      </header>
      <OfflineBanner />
      <main className="mx-auto max-w-6xl px-4 py-4">{children}</main>
      <Nav role={user.role} mobile />
    </div>
  );
}
