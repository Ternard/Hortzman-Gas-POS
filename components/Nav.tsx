"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Package, Receipt, BarChart3, Menu } from "lucide-react";

export default function Nav({ role, mobile = false }: { role: "admin" | "cashier"; mobile?: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/", label: "Sell", icon: ShoppingCart },
    ...(role === "admin" ? [{ href: "/products", label: "Stock", icon: Package }] : []),
    { href: "/sales", label: "Sales", icon: Receipt },
    ...(role === "admin" ? [{ href: "/reports", label: "Reports", icon: BarChart3 }] : []),
    { href: "/more", label: "More", icon: Menu },
  ];
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  if (!mobile) return (
    <>
      {/* Desktop / tablet */}
      <nav className="no-print hidden gap-1 md:flex">
        {items.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${active(href) ? "bg-orange-100 text-orange-800" : "text-stone-600 hover:bg-stone-100"}`}>
            <Icon size={18} /> {label}
          </Link>
        ))}
      </nav>
    </>
  );
  return (
    <>
      {/* Phone bottom bar */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg">
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active(href) ? "text-orange-700" : "text-stone-500"}`}>
              <Icon size={22} strokeWidth={active(href) ? 2.4 : 1.8} /> {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
