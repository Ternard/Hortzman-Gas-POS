"use client";
import { useState, useTransition } from "react";
import { AlertTriangle, ClipboardCheck, Eye, EyeOff, Pencil, PackagePlus, Plus, X } from "lucide-react";
import { adjustStock, restock, saveProduct, setActive } from "@/app/(app)/products/actions";
import { money } from "@/lib/format";

type P = {
  id: number; name: string; category: string; buying_price: number; selling_price: number;
  stock: number; low_stock_level: number; track_stock: boolean; active: boolean;
};
type Modal = { kind: "edit" | "restock" | "count"; id?: number } | null;

export default function ProductsClient({ products, welcome }: { products: P[]; welcome: boolean }) {
  const [modal, setModal] = useState<Modal>(null);
  // Always read the freshest item data (props refresh after every save)
  const mp = modal?.id ? products.find((x) => x.id === modal.id) : undefined;
  const [showHidden, setShowHidden] = useState(false);
  const [pending, start] = useTransition();
  const cats = Array.from(new Set(["Gas Refill", "Full Cylinder", "Accessories", ...products.map((p) => p.category)]));
  const list = products.filter((p) => showHidden || p.active);
  const stockValue = products.filter((p) => p.active && p.track_stock).reduce((s, p) => s + p.stock * p.buying_price, 0);
  const lowCount = products.filter((p) => p.active && p.track_stock && p.stock <= p.low_stock_level).length;
  const unpriced = products.filter((p) => p.active && p.selling_price === 0).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Items & stock</h1>
          <p className="text-sm text-stone-500">Stock value at cost: <b>{money(stockValue)}</b></p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ kind: "edit" })}><Plus size={18} /> Add item</button>
      </div>

      {(welcome || unpriced > 0) && unpriced > 0 && (
        <div className="mb-4 rounded-xl bg-orange-50 p-3 text-sm text-orange-900">
          <b>{unpriced} item{unpriced > 1 ? "s" : ""} need prices.</b> Tap <Pencil size={13} className="inline" /> to set the buying and selling price, then <PackagePlus size={13} className="inline" /> Restock to add what's in the shop.
        </div>
      )}
      {lowCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={16} /> {lowCount} item{lowCount > 1 ? "s are" : " is"} running low.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => {
          const margin = p.selling_price - p.buying_price;
          const low = p.track_stock && p.stock <= p.low_stock_level;
          return (
            <div key={p.id} className={`card ${p.active ? "" : "opacity-50"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{p.category}</p>
                  <p className="text-lg font-bold leading-tight">{p.name}</p>
                </div>
                <div className={`rounded-xl px-3 py-1 text-center ${low ? "bg-red-50 text-red-700" : "bg-stone-100"}`}>
                  <p className="text-xl font-black">{p.track_stock ? p.stock : "—"}</p>
                  <p className="text-[10px] uppercase">in stock</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-stone-400">Buy</p><p className="font-semibold">{money(p.buying_price)}</p></div>
                <div><p className="text-stone-400">Sell</p><p className="font-semibold">{money(p.selling_price)}</p></div>
                <div><p className="text-stone-400">Profit</p><p className={`font-semibold ${margin < 0 ? "text-red-600" : "text-green-700"}`}>{money(margin)}</p></div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn-ghost flex-1 px-2 py-2 text-sm" onClick={() => setModal({ kind: "edit", id: p.id })}><Pencil size={15} /> Edit</button>
                {p.track_stock && <button className="btn-ghost flex-1 px-2 py-2 text-sm" onClick={() => setModal({ kind: "restock", id: p.id })}><PackagePlus size={15} /> Restock</button>}
                {p.track_stock && <button className="btn-ghost px-3 py-2" title="Stock count" onClick={() => setModal({ kind: "count", id: p.id })}><ClipboardCheck size={15} /></button>}
                <button className="btn-ghost px-3 py-2" title={p.active ? "Hide from till" : "Show on till"} disabled={pending}
                  onClick={() => start(async () => { await setActive(p.id, !p.active); })}>
                  {p.active ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {products.some((p) => !p.active) && (
        <button onClick={() => setShowHidden(!showHidden)} className="mt-4 text-sm font-semibold text-stone-500">
          {showHidden ? "Hide" : "Show"} hidden items
        </button>
      )}

      {modal && (modal.kind === "edit" || mp) && (
        <Sheet title={modal.kind === "edit" ? (mp ? "Edit item" : "Add item") : modal.kind === "restock" ? `Restock ${mp.name}` : `Stock count: ${mp.name}`}
          onClose={() => setModal(null)}>
          {modal.kind === "edit" && <EditForm key={mp?.id ?? "new"} p={mp} cats={cats} onDone={() => setModal(null)} />}
          {modal.kind === "restock" && <RestockForm key={mp?.id + ":" + mp?.buying_price} p={mp} onDone={() => setModal(null)} />}
          {modal.kind === "count" && <CountForm key={mp?.id + ":" + mp?.stock} p={mp} onDone={() => setModal(null)} />}
        </Sheet>
      )}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full bg-stone-100 p-2"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function useSubmit(onDone: () => void) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r.error) setError(r.error);
      else onDone();
    });
  return { pending, error, run };
}

function EditForm({ p, cats, onDone }: { p?: P; cats: string[]; onDone: () => void }) {
  const { pending, error, run } = useSubmit(onDone);
  const [f, setF] = useState({
    name: p?.name ?? "", category: p?.category ?? "Gas Refill",
    buying_price: p ? String(p.buying_price) : "", selling_price: p ? String(p.selling_price) : "",
    stock: "", low_stock_level: String(p?.low_stock_level ?? 3), track_stock: p?.track_stock ?? true,
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const margin = (Number(f.selling_price) || 0) - (Number(f.buying_price) || 0);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => saveProduct({ id: p?.id, ...f, buying_price: Number(f.buying_price), selling_price: Number(f.selling_price), stock: Number(f.stock), low_stock_level: Number(f.low_stock_level) })); }}>
      <div><label className="label">Item name</label><input className="input" value={f.name} onChange={set("name")} placeholder="e.g. Gas Refill 6kg" required /></div>
      <div>
        <label className="label">Category</label>
        <input className="input" list="cats" value={f.category} onChange={set("category")} />
        <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Buying price</label><input className="input" inputMode="decimal" value={f.buying_price} onChange={set("buying_price")} placeholder="0" /></div>
        <div><label className="label">Selling price</label><input className="input" inputMode="decimal" value={f.selling_price} onChange={set("selling_price")} placeholder="0" required /></div>
      </div>
      <p className={`text-sm ${margin < 0 ? "text-red-600" : "text-green-700"}`}>Profit per item: <b>{money(margin)}</b></p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-orange-600" checked={f.track_stock} onChange={set("track_stock")} /> Track stock for this item</label>
      {f.track_stock && (
        <div className="grid grid-cols-2 gap-3">
          {!p && <div><label className="label">Opening stock</label><input className="input" inputMode="numeric" value={f.stock} onChange={set("stock")} placeholder="0" /></div>}
          <div><label className="label">Warn when at or below</label><input className="input" inputMode="numeric" value={f.low_stock_level} onChange={set("low_stock_level")} /></div>
        </div>
      )}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save item"}</button>
    </form>
  );
}

function RestockForm({ p, onDone }: { p: P; onDone: () => void }) {
  const { pending, error, run } = useSubmit(onDone);
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(String(p.buying_price));
  const [update, setUpdate] = useState(true);
  const [note, setNote] = useState("");
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => restock({ id: p.id, qty: Number(qty), unit_cost: Number(cost), updatePrice: update, note })); }}>
      <p className="text-sm text-stone-500">Currently {p.stock} in stock.</p>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Quantity received</label><input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus required /></div>
        <div><label className="label">Cost each</label><input className="input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
      </div>
      {qty && <p className="text-sm text-stone-600">Total cost: <b>{money(Number(qty) * Number(cost))}</b></p>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-orange-600" checked={update} onChange={(e) => setUpdate(e.target.checked)} /> Use this as the new buying price</label>
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Supplier / note (optional)" />
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Add to stock"}</button>
    </form>
  );
}

function CountForm({ p, onDone }: { p: P; onDone: () => void }) {
  const { pending, error, run } = useSubmit(onDone);
  const [counted, setCounted] = useState(String(p.stock));
  const [note, setNote] = useState("");
  const diff = (Number(counted) || 0) - p.stock;
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => adjustStock({ id: p.id, counted: Number(counted), note })); }}>
      <p className="text-sm text-stone-500">System says {p.stock}. Enter what you physically counted.</p>
      <input className="input text-2xl font-bold" inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
      {diff !== 0 && <p className={`text-sm font-semibold ${diff < 0 ? "text-red-600" : "text-green-700"}`}>{diff > 0 ? "+" : ""}{diff} difference</p>}
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional), e.g. damaged cylinder" />
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save count"}</button>
    </form>
  );
}
