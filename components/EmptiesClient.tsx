"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ClipboardList, Pencil } from "lucide-react";
import { createRequisition, setEmpties } from "@/app/(app)/empties/actions";
import { dateTime } from "@/lib/format";

type P = { id: number; name: string; stock: number; empties: number };
type R = { id: number; req_no: number; status: string; supplier: string; created_at: string; summary: string };

const badge: Record<string, string> = {
  sent: "bg-amber-100 text-amber-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-stone-100 text-stone-500",
};

export default function EmptiesClient({ products, requisitions }: { products: P[]; requisitions: R[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [send, setSend] = useState<Record<number, string>>({});
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [fixing, setFixing] = useState<number | null>(null);
  const [fixVal, setFixVal] = useState("");

  const total = products.reduce((s, p) => s + (Number(send[p.id]) || 0), 0);
  const totalEmpties = products.reduce((s, p) => s + p.empties, 0);

  function create() {
    setError("");
    start(async () => {
      const r = await createRequisition({
        items: products.map((p) => ({ productId: p.id, qty: Number(send[p.id]) || 0 })),
        supplier, note,
      });
      if (r.error) return setError(r.error);
      router.push(`/empties/${r.id}`);
    });
  }

  function saveFix(id: number) {
    setError("");
    start(async () => {
      const r = await setEmpties({ id, counted: Number(fixVal) });
      if (r.error) return setError(r.error);
      setFixing(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Empties</h1>
        <p className="text-sm text-stone-500">
          Every refill you sell brings an empty cylinder back. Send them out for refilling here. <b>{totalEmpties}</b> empties in the shop now.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="card text-sm text-stone-600">
          No items track empties yet. Go to <Link href="/products" className="font-semibold text-orange-700">Stock</Link>, edit a gas refill
          and tick <b>“Customers swap an empty cylinder for this item”</b>.
        </div>
      ) : (
        <div className="card space-y-3">
          <h2 className="font-bold">New requisition</h2>
          <div className="divide-y divide-stone-100">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-stone-500">{p.stock} full in stock</p>
                  {fixing === p.id && (
                    <div className="mt-2 flex gap-2">
                      <input className="input w-24 py-1.5" inputMode="numeric" value={fixVal} onChange={(e) => setFixVal(e.target.value)} placeholder="Counted" autoFocus />
                      <button className="btn-primary px-3 py-1.5 text-sm" disabled={pending} onClick={() => saveFix(p.id)}>Save</button>
                      <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setFixing(null)}>Cancel</button>
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xl font-black">{p.empties}</p>
                  <button className="flex items-center gap-1 text-[10px] uppercase text-stone-400" title="Correct this count after counting the shelf"
                    onClick={() => { setFixing(p.id); setFixVal(String(p.empties)); }}>
                    empties <Pencil size={10} />
                  </button>
                </div>
                <div className="w-20">
                  <label className="label !mb-0.5 text-[10px]">Send</label>
                  <input className="input px-2 py-1.5 text-center font-bold" inputMode="numeric" placeholder="0" value={send[p.id] ?? ""}
                    onChange={(e) => /^\d*$/.test(e.target.value) && setSend({ ...send, [p.id]: e.target.value })} />
                </div>
                <button className="text-xs font-semibold text-orange-700" onClick={() => setSend({ ...send, [p.id]: String(p.empties) })}>All</button>
              </div>
            ))}
          </div>
          <input className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier / delivery company (optional)" />
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={pending || total === 0} onClick={create}>
            <ClipboardList size={18} /> {pending ? "Saving…" : `Create requisition${total ? ` · ${total} cylinders` : ""}`}
          </button>
        </div>
      )}

      <div className="card divide-y divide-stone-100 p-0">
        <h2 className="p-4 pb-3 font-bold">Requisitions</h2>
        {requisitions.length === 0 && <p className="p-6 pt-2 text-center text-sm text-stone-400">None yet.</p>}
        {requisitions.map((r) => (
          <Link key={r.id} href={`/empties/${r.id}`} className="flex items-center gap-3 p-3 hover:bg-stone-50">
            <div className="w-14 text-xs text-stone-400">REQ-{r.req_no}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.summary}</p>
              <p className="text-xs text-stone-400">{dateTime(r.created_at)}{r.supplier ? " · " + r.supplier : ""}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${badge[r.status] || ""}`}>{r.status === "sent" ? "with supplier" : r.status}</span>
            <ChevronRight size={16} className="text-stone-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
