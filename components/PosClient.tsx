"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Minus, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { checkout } from "@/app/(app)/actions";
import { money } from "@/lib/format";

type Product = { id: number; name: string; category: string; price: number; stock: number; track: boolean; low: number };

export default function PosClient({ products, isAdmin }: { products: Product[]; isAdmin: boolean }) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<number, number>>({});
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false); // phone cart sheet
  const [pay, setPay] = useState<"Cash" | "M-Pesa" | "Card">("Cash");
  const [received, setReceived] = useState("");
  const [mpesaRef, setMpesaRef] = useState("");
  const [discount, setDiscount] = useState("");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const cats = useMemo(() => ["All", ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const shown = products.filter(
    (p) => (cat === "All" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase())
  );
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id))!, qty })).filter((l) => l.p);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.qty * l.p.price, 0);
  const disc = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const total = subtotal - disc;
  const change = pay === "Cash" && received ? Number(received) - total : 0;

  function add(p: Product, delta = 1) {
    setError("");
    setCart((c) => {
      const next = Math.max(0, (c[p.id] || 0) + delta);
      if (p.track && next > p.stock) {
        setError(`Only ${p.stock} × ${p.name} in stock.`);
        return c;
      }
      const copy = { ...c };
      if (next === 0) delete copy[p.id];
      else copy[p.id] = next;
      return copy;
    });
  }

  function reset() {
    setCart({}); setReceived(""); setMpesaRef(""); setDiscount(""); setCustName(""); setCustPhone(""); setPay("Cash");
  }

  function submit() {
    setError("");
    start(async () => {
      const res = await checkout({
        items: lines.map((l) => ({ productId: l.p.id, qty: l.qty })),
        paymentMethod: pay,
        mpesaRef,
        amountPaid: received ? Number(received) : undefined,
        discount: disc,
        customerName: custName,
        customerPhone: custPhone,
      });
      if (res.error) return setError(res.error);
      reset();
      router.push(`/sales/${res.id}?new=1`);
    });
  }

  if (!products.length) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-semibold">No items to sell yet.</p>
        {isAdmin ? (
          <Link href="/products" className="btn-primary mt-4">Add items</Link>
        ) : (
          <p className="mt-2 text-sm text-stone-500">Ask the owner to add items.</p>
        )}
      </div>
    );
  }

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-lg font-bold">Current sale</h2>
        {count > 0 && (
          <button onClick={reset} className="flex items-center gap-1 text-sm text-stone-500"><Trash2 size={15} /> Clear</button>
        )}
      </div>
      {lines.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-400">Tap an item to add it.</p>
      ) : (
        <div className="space-y-2">
          {lines.map(({ p, qty }) => (
            <div key={p.id} className="flex items-center gap-2 rounded-xl bg-stone-50 p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-stone-500">{money(p.price)} each</p>
              </div>
              <button onClick={() => add(p, -1)} className="rounded-lg bg-white p-2 ring-1 ring-stone-200"><Minus size={16} /></button>
              <span className="w-6 text-center font-bold">{qty}</span>
              <button onClick={() => add(p, 1)} className="rounded-lg bg-white p-2 ring-1 ring-stone-200"><Plus size={16} /></button>
              <span className="w-20 text-right text-sm font-semibold">{money(qty * p.price)}</span>
            </div>
          ))}
        </div>
      )}

      {lines.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-stone-200 pt-4">
          <div className="grid grid-cols-3 gap-2">
            {(["Cash", "M-Pesa", "Card"] as const).map((m) => (
              <button key={m} onClick={() => setPay(m)}
                className={`rounded-xl py-2.5 text-sm font-bold ring-1 ${pay === m ? "bg-stone-900 text-white ring-stone-900" : "bg-white ring-stone-300"}`}>
                {m}
              </button>
            ))}
          </div>
          {pay === "Cash" && (
            <div>
              <label className="label">Cash received (optional)</label>
              <input className="input" inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={String(total)} />
              {received && <p className={`mt-1 text-sm font-semibold ${change < 0 ? "text-red-600" : "text-green-700"}`}>
                {change < 0 ? `Short by ${money(-change)}` : `Change: ${money(change)}`}</p>}
            </div>
          )}
          {pay === "M-Pesa" && (
            <div>
              <label className="label">M-Pesa code</label>
              <input className="input uppercase" value={mpesaRef} onChange={(e) => setMpesaRef(e.target.value)} placeholder="e.g. SJK3XXXXXX" />
            </div>
          )}
          <details className="rounded-xl bg-stone-50 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-stone-600">Discount & customer (optional)</summary>
            <div className="mt-3 space-y-2">
              <input className="input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Discount (KES)" />
              <input className="input" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Customer name" />
              <input className="input" inputMode="tel" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="Customer phone" />
            </div>
          </details>
          <div className="space-y-1 text-sm">
            {disc > 0 && <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>{money(subtotal)}</span></div>}
            {disc > 0 && <div className="flex justify-between text-stone-500"><span>Discount</span><span>−{money(disc)}</span></div>}
            <div className="flex justify-between text-xl font-black"><span>Total</span><span>{money(total)}</span></div>
          </div>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button onClick={submit} disabled={pending || (pay === "Cash" && !!received && change < 0)} className="btn-primary w-full py-4 text-lg">
            {pending ? "Saving…" : `Complete sale · ${money(total)}`}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_380px]">
      <section>
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-10" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${cat === c ? "bg-orange-600 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"}`}>
              {c}
            </button>
          ))}
        </div>
        {error && !sheet && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 md:hidden">{error}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => {
            const inCart = cart[p.id] || 0;
            const out = p.track && p.stock <= 0;
            const low = p.track && p.stock > 0 && p.stock <= p.low;
            return (
              <button key={p.id} onClick={() => add(p)} disabled={out}
                className={`relative rounded-2xl bg-white p-3 text-left shadow-sm ring-1 transition active:scale-[0.97] disabled:opacity-40 ${inCart ? "ring-2 ring-orange-500" : "ring-stone-200"}`}>
                {inCart > 0 && <span className="absolute right-2 top-2 rounded-full bg-orange-600 px-2 py-0.5 text-xs font-bold text-white">{inCart}</span>}
                <p className="pr-6 font-bold leading-tight">{p.name}</p>
                <p className="mt-2 text-lg font-black text-orange-700">{money(p.price)}</p>
                <p className={`text-xs ${out ? "text-red-600" : low ? "text-amber-600" : "text-stone-400"}`}>
                  {!p.track ? "Not tracked" : out ? "Out of stock" : `${p.stock} in stock`}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Desktop cart */}
      <aside className="card sticky top-20 hidden max-h-[calc(100dvh-6rem)] overflow-y-auto md:block">{cartPanel}</aside>

      {/* Phone: floating cart button + bottom sheet */}
      {count > 0 && !sheet && (
        <button onClick={() => setSheet(true)}
          className="fixed inset-x-4 bottom-20 z-30 flex items-center justify-between rounded-2xl bg-stone-900 px-5 py-4 text-white shadow-xl md:hidden">
          <span className="flex items-center gap-2 font-semibold"><ShoppingCart size={20} /> {count} item{count > 1 ? "s" : ""}</span>
          <span className="text-lg font-black">{money(total)} →</span>
        </button>
      )}
      {sheet && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheet(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-8">
            <button onClick={() => setSheet(false)} className="absolute right-4 top-4 rounded-full bg-stone-100 p-2"><X size={18} /></button>
            {cartPanel}
          </div>
        </div>
      )}
    </div>
  );
}
