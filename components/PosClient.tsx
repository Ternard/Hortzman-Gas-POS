"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Minus, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { checkout } from "@/app/(app)/actions";
import { isMetres, money, qty } from "@/lib/format";

type Product = { id: number; name: string; category: string; unit: string; tracksEmpties: boolean; price: number; stock: number; track: boolean; low: number };

/** Length box for items sold by the metre. Keeps what you type (like "2.") until you finish. */
function MetreInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(value ? String(value) : "");
  return (
    <div className="flex items-center gap-1">
      <input
        className="input w-20 px-2 py-1.5 text-center font-bold"
        inputMode="decimal"
        value={text}
        placeholder="0"
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const t = e.target.value.replace(",", ".");
          if (!/^\d*\.?\d{0,3}$/.test(t)) return;
          setText(t);
          onChange(Number(t) || 0);
        }}
      />
      <span className="text-sm font-semibold text-stone-500">m</span>
    </div>
  );
}

export default function PosClient({ products, isAdmin }: { products: Product[]; isAdmin: boolean }) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<number, number>>({});
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false); // phone cart sheet
  const [pay, setPay] = useState<"Cash" | "M-Pesa" | "Card" | "Credit">("Cash");
  // Pay later: what the customer pays now (can be nothing), how, and the date they promise to pay by
  const [paidNow, setPaidNow] = useState("");
  const [paidNowMethod, setPaidNowMethod] = useState<"Cash" | "M-Pesa" | "Card">("Cash");
  const [dueDate, setDueDate] = useState("");
  const [received, setReceived] = useState("");
  const [mpesaRef, setMpesaRef] = useState("");
  const [discount, setDiscount] = useState("");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [noEmpty, setNoEmpty] = useState<Record<number, boolean>>({}); // lines where no empty came back
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const cats = useMemo(() => ["All", ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const shown = products.filter(
    (p) => (cat === "All" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase())
  );
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id))!, qty })).filter((l) => l.p);
  // Metre lines can sit at 0 while the cashier is typing a length; they don't count until they have a length.
  const valid = lines.filter((l) => l.qty > 0);
  const count = valid.reduce((s, l) => s + (isMetres(l.p.unit) ? 1 : l.qty), 0);
  const lineTotal = (p: Product, q: number) => Math.round(q * p.price * 100) / 100;
  const subtotal = valid.reduce((s, l) => s + lineTotal(l.p, l.qty), 0);
  const disc = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const total = subtotal - disc;
  const change = pay === "Cash" && received ? Number(received) - total : 0;
  const owing = Math.round((total - (Number(paidNow) || 0)) * 100) / 100; // pay-later balance

  /** Set an exact quantity (used for typed metres). Pieces are whole; metres go to the nearest millimetre. */
  function setQty(p: Product, value: number, keepZero = false) {
    setError("");
    setCart((c) => {
      let next = isMetres(p.unit) ? Math.round(Math.max(0, value) * 1000) / 1000 : Math.floor(Math.max(0, value));
      if (!Number.isFinite(next)) next = 0;
      if (p.track && next > p.stock) {
        setError(`Only ${qty(p.stock, p.unit)} ${isMetres(p.unit) ? "of" : "×"} ${p.name} in stock.`);
        return c;
      }
      const copy = { ...c };
      if (next === 0 && !keepZero) delete copy[p.id];
      else copy[p.id] = next;
      return copy;
    });
  }

  function add(p: Product, delta = 1) {
    const cur = cart[p.id] || 0;
    // Tapping a metre item that's already in the cart does nothing; the cashier edits the length instead.
    if (isMetres(p.unit) && cur > 0 && delta > 0) return;
    // A new metre item starts at 1 m; the cashier then types the real length.
    setQty(p, cur + delta, isMetres(p.unit));
  }

  function reset() {
    setCart({}); setNoEmpty({}); setReceived(""); setMpesaRef(""); setDiscount(""); setCustName(""); setCustPhone(""); setPay("Cash");
    setPaidNow(""); setPaidNowMethod("Cash"); setDueDate("");
  }

  function submit() {
    setError("");
    start(async () => {
      const res = await checkout({
        items: valid.map((l) => ({ productId: l.p.id, qty: l.qty, noEmpty: !!noEmpty[l.p.id] })),
        paymentMethod: pay,
        mpesaRef,
        amountPaid: pay === "Cash" && received ? Number(received) : undefined,
        paidNow: pay === "Credit" ? Number(paidNow) || 0 : undefined,
        paidNowMethod: pay === "Credit" ? paidNowMethod : undefined,
        dueDate: pay === "Credit" ? dueDate : undefined,
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
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-stone-50 p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-stone-500">{money(p.price)} {isMetres(p.unit) ? "per metre" : "each"}</p>
              </div>
              {isMetres(p.unit) ? (
                <>
                  <MetreInput value={qty} onChange={(v) => setQty(p, v, true)} />
                  <button onClick={() => setQty(p, 0)} className="rounded-lg bg-white p-2 ring-1 ring-stone-200" title="Remove"><X size={16} /></button>
                </>
              ) : (
                <>
                  <button onClick={() => add(p, -1)} className="rounded-lg bg-white p-2 ring-1 ring-stone-200"><Minus size={16} /></button>
                  <span className="w-6 text-center font-bold">{qty}</span>
                  <button onClick={() => add(p, 1)} className="rounded-lg bg-white p-2 ring-1 ring-stone-200"><Plus size={16} /></button>
                </>
              )}
              <span className="w-20 text-right text-sm font-semibold">{money(lineTotal(p, qty))}</span>
              {p.tracksEmpties && qty > 0 && (
                <label className="basis-full pl-1 text-xs text-stone-600">
                  <input type="checkbox" className="mr-1.5 h-3.5 w-3.5 accent-orange-600" checked={!noEmpty[p.id]}
                    onChange={(e) => setNoEmpty((m) => ({ ...m, [p.id]: !e.target.checked }))} />
                  Customer returned an empty
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      {valid.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-stone-200 pt-4">
          <div className="grid grid-cols-4 gap-1.5">
            {(["Cash", "M-Pesa", "Card", "Credit"] as const).map((m) => (
              <button key={m} onClick={() => setPay(m)}
                className={`rounded-xl px-1 py-2.5 text-[13px] font-bold ring-1 ${pay === m ? "bg-stone-900 text-white ring-stone-900" : "bg-white ring-stone-300"}`}>
                {m === "Credit" ? "Pay later" : m}
              </button>
            ))}
          </div>
          {pay === "Cash" && (
            <div>
              <label className="label">Cash received (optional)</label>
              <input className="input" inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={String(total)} />
              {received && <p className={`mt-1 text-sm font-semibold ${change < 0 ? "text-red-600" : "text-green-700"}`}>
                {change < 0 ? `Short by ${money(-change)}. Choose Pay later to record the balance.` : `Change: ${money(change)}`}</p>}
            </div>
          )}
          {pay === "M-Pesa" && (
            <div>
              <label className="label">M-Pesa code</label>
              <input className="input uppercase" value={mpesaRef} onChange={(e) => setMpesaRef(e.target.value)} placeholder="e.g. SJK3XXXXXX" />
            </div>
          )}
          {pay === "Credit" && (
            <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm">
              <p className="font-semibold text-amber-900">Customer takes the goods and pays later</p>
              <input className="input" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Customer name (required)" />
              <input className="input" inputMode="tel" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="Phone (optional)" />
              <div>
                <label className="label">Paying now (leave empty if nothing)</label>
                <input className="input" inputMode="decimal" value={paidNow} placeholder="0"
                  onChange={(e) => /^d*.?d{0,2}$/.test(e.target.value) && setPaidNow(e.target.value)} />
              </div>
              {Number(paidNow) > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {(["Cash", "M-Pesa", "Card"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setPaidNowMethod(m)}
                      className={`rounded-lg py-1.5 text-xs font-bold ring-1 ${paidNowMethod === m ? "bg-stone-900 text-white ring-stone-900" : "bg-white ring-stone-300"}`}>{m}</button>
                  ))}
                </div>
              )}
              {Number(paidNow) > 0 && paidNowMethod === "M-Pesa" && (
                <input className="input uppercase" value={mpesaRef} onChange={(e) => setMpesaRef(e.target.value)} placeholder="M-Pesa code" />
              )}
              <div>
                <label className="label">Promised to pay by (optional)</label>
                <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <p className={`font-bold ${owing <= 0 ? "text-red-600" : "text-amber-900"}`}>
                {owing <= 0 ? "That covers the full amount. Choose Cash, M-Pesa or Card instead." : `Balance owed: ${money(owing)}`}
              </p>
            </div>
          )}
          <details className="rounded-xl bg-stone-50 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-stone-600">{pay === "Credit" ? "Discount (optional)" : "Discount & customer (optional)"}</summary>
            <div className="mt-3 space-y-2">
              <input className="input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Discount (KES)" />
              {pay !== "Credit" && <input className="input" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Customer name" />}
              {pay !== "Credit" && <input className="input" inputMode="tel" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="Customer phone" />}
            </div>
          </details>
          <div className="space-y-1 text-sm">
            {disc > 0 && <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>{money(subtotal)}</span></div>}
            {disc > 0 && <div className="flex justify-between text-stone-500"><span>Discount</span><span>−{money(disc)}</span></div>}
            <div className="flex justify-between text-xl font-black"><span>Total</span><span>{money(total)}</span></div>
          </div>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button onClick={submit} disabled={pending || (pay === "Cash" && !!received && change < 0) || (pay === "Credit" && (owing <= 0 || !custName.trim()))} className="btn-primary w-full py-4 text-lg">
            {pending ? "Saving…" : pay === "Credit" ? `Save bill · owes ${money(Math.max(owing, 0))}` : `Complete sale · ${money(total)}`}
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
                {inCart > 0 && <span className="absolute right-2 top-2 rounded-full bg-orange-600 px-2 py-0.5 text-xs font-bold text-white">{qty(inCart, p.unit)}</span>}
                <p className="pr-6 font-bold leading-tight">{p.name}</p>
                <p className="mt-2 text-lg font-black text-orange-700">{money(p.price)}{isMetres(p.unit) && <span className="text-xs font-semibold text-stone-500"> /m</span>}</p>
                <p className={`text-xs ${out ? "text-red-600" : low ? "text-amber-600" : "text-stone-400"}`}>
                  {!p.track ? "Not tracked" : out ? "Out of stock" : `${qty(p.stock, p.unit)} in stock`}
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
