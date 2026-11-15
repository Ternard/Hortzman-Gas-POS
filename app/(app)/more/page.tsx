import Link from "next/link";
import { ChevronRight, ClipboardList, LogOut, Recycle, Users, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";

export default async function MorePage() {
  const user = await requireUser();
  const links = user.role === "admin"
    ? [{ href: "/stocktake", label: "Stock take & cylinder check", icon: ClipboardList }, { href: "/empties", label: "Empties & requisitions", icon: Recycle }, { href: "/expenses", label: "Expenses", icon: Wallet }, { href: "/users", label: "Staff accounts", icon: Users }]
    : [];
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card">
        <p className="text-lg font-bold">{user.name}</p>
        <p className="text-sm text-stone-500">@{user.username} · {user.role === "admin" ? "Owner/Admin" : "Cashier"}</p>
      </div>
      {links.length > 0 && (
        <div className="card divide-y divide-stone-100 p-0">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 p-4 font-semibold hover:bg-stone-50">
              <Icon size={20} className="text-orange-600" /> <span className="flex-1">{label}</span> <ChevronRight size={18} className="text-stone-400" />
            </Link>
          ))}
        </div>
      )}
      <form action={logoutAction}><button className="btn-ghost w-full text-red-600"><LogOut size={18} /> Log out</button></form>
      <p className="text-center text-xs text-stone-400">Tip: on your phone, use the browser menu → “Add to Home screen” to open the POS like an app.</p>
    </div>
  );
}
