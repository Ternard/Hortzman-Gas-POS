"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, MessageCircle, Printer } from "lucide-react";
import { voidSale } from "@/app/(app)/actions";

function waNumber(phone?: string | null) {
  if (!phone) return "";
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = "254" + d.slice(1);
  if (d.length === 9) d = "254" + d;
  return d;
}

export default function ReceiptActions({ id, text, phone, canVoid }: { id: string; text: string; phone?: string | null; canVoid: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const wa = `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
  return (
    <div className="no-print mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost" onClick={() => window.print()}><Printer size={18} /> Print</button>
        <a className="btn-ghost" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp</a>
      </div>
      {canVoid && (
        <button className="btn-ghost w-full text-red-600" disabled={pending}
          onClick={() => {
            if (!confirm("Void this sale? Stock will be returned and it won't count in reports.")) return;
            start(async () => { const r = await voidSale(id); if (r.error) setErr(r.error); else router.refresh(); });
          }}>
          <Ban size={18} /> {pending ? "Voiding…" : "Void sale"}
        </button>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
