"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, MessageCircle, Printer } from "lucide-react";
import { cancelRequisition, receiveRequisition } from "@/app/(app)/empties/actions";

type Item = { id: number; name: string; sent: number };

export default function RequisitionActions({ id, status, text, items }: { id: number; status: string; text: string; items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [receiving, setReceiving] = useState(false);
  const [got, setGot] = useState<Record<number, string>>(Object.fromEntries(items.map((i) => [i.id, String(i.sent)])));

  const done = (r: { error?: string }) => (r.error ? setErr(r.error) : router.refresh());

  return (
    <div className="no-print mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost" onClick={() => window.print()}><Printer size={18} /> Print</button>
        <a className="btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp</a>
      </div>

      {status === "sent" && !receiving && (
        <button className="btn-primary w-full" onClick={() => setReceiving(true)}><CheckCircle2 size={18} /> Refilled cylinders received</button>
      )}
      {status === "sent" && receiving && (
        <div className="card space-y-3">
          <p className="text-sm text-stone-600">How many full cylinders came back? Any short go back to your empties count.</p>
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-3">
              <span className="flex-1 font-semibold">{i.name} <span className="text-xs font-normal text-stone-400">(sent {i.sent})</span></span>
              <input className="input w-20 px-2 py-1.5 text-center font-bold" inputMode="numeric" value={got[i.id] ?? ""}
                onChange={(e) => /^\d*$/.test(e.target.value) && setGot({ ...got, [i.id]: e.target.value })} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => setReceiving(false)}>Back</button>
            <button className="btn-primary" disabled={pending}
              onClick={() => start(async () => done(await receiveRequisition({ id, received: items.map((i) => ({ itemId: i.id, qty: Number(got[i.id]) || 0 })) })))}>
              {pending ? "Saving…" : "Add to stock"}
            </button>
          </div>
        </div>
      )}
      {status === "sent" && (
        <button className="btn-ghost w-full text-red-600" disabled={pending}
          onClick={() => {
            if (!confirm("Cancel this requisition? The empties will be added back to the shop count.")) return;
            start(async () => done(await cancelRequisition(id)));
          }}>
          <Ban size={18} /> Cancel requisition
        </button>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
