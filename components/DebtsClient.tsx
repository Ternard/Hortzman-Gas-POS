"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, MessageCircle, Search, X } from "lucide-react";
import { recordPayment, setDueDate } from "@/app/(app)/debts/actions";
import { BUSINESS_NAME, money } from "@/lib/format";

type Bill = {
  id: string; receipt_no: number; customer: string; phone: string;
  total: number; paid: number; balance: number; due: string; date: string; items: string;
};

function waNumber(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = "254" + d.slice(1);
  if (d.length === 9) d = "254" + d;
  return d;
}

const niceDate = (ymd: string) =>
  new Date(ymd + "T00:00:00").toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });

export default function DebtsClient({ bills, today }: { bills: Bill[]; today: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  // Group bills by customer (same name and phone) so each person's total is clear.
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; phone: string; bills: Bill[]; owed: number }>();
    for (const b of bills) {
      if (q && !(b.customer + " " + b.phone).toLowerCase().includes(q.toLowerCase())) continue;
      const key = b.customer.toLowerCase() + "|" + b.phone.replace(/\D/g, "");
      const g = m.get(key) ?? { name: b.customer, phone: b.phone, bills: [], owed: 0 };
      g.bills.push(b);
      g.owed += b.balance;
      m.set(key, g);
    }
    return Array.from(m.values()).sort((a, b) => b.owed - a.owed);
  }, [bills, q]);

  const totalOwed = bills.reduce((s, b) => s + b.balance, 0);
  const overdue = bills.filter((b) => b.due && b.due < today);
  const overdueOwed = overdue.reduce((s, b) => s + b.balance, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Pending bills</h1>
        <p className="text-sm text-stone-500">Customers who took goods and still owe. To start one, choose <b>Pay later</b> when selling.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card"><p className="text-xs text-stone-500">Total owed to you</p><p className="text-xl font-black">{money(totalOwed)}</p><p className="text-xs text-stone-400">{bills.length} bill{bills.length === 1 ? "" : "s"}</p></div>
        <div className="card"><p className="text-xs text-stone-500">Past promised date</p><p className={`text-xl font-black ${overdue.length ? "text-red-600" : ""}`}>{money(overdueOwed)}</p><p className="text-xs text-stone-400">{overdue.length} bill{overdue.length === 1 ? "" : "s"}</p></div>
      </div>

      {bills.length > 0 && (
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-10" placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      {bills.length === 0 && <div className="card py-10 text-center text-sm text-stone-500">No pending bills. Everyone has paid up. 🎉</div>}

      {groups.map((g) => (
        <div key={g.name + g.phone} className="card space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-lg font-bold leading-tight">{g.name}</p>
              <p className="text-sm text-stone-500">{g.phone || "No phone number"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-400">Owes</p>
              <p className="text-xl font-black text-red-600">{money(g.owed)}</p>
            </div>
          </div>
          <div className="divide-y divide-stone-100">
            {g.bills.map((b) => {
              const late = !!b.due && b.due < today;
              const msg = `Hello ${g.name}, a friendly reminder from ${BUSINESS_NAME}: you have a balance of ${money(b.balance)} on receipt #${b.receipt_no}${b.due ? ` (promised by ${niceDate(b.due)})` : ""}. Thank you!`;
              return (
                <div key={b.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/sales/${b.id}`} className="text-sm font-semibold text-stone-700 underline decoration-stone-300">Receipt #{b.receipt_no}</Link>
                      <p className="truncate text-xs text-stone-500">{b.items}</p>
                      <p className="text-xs text-stone-400">
                        Total {money(b.total)}{b.paid > 0 ? ` · paid ${money(b.paid)}` : " · nothing paid"}
                      </p>
                      <p className={`mt-0.5 flex items-center gap-1 text-xs font-semibold ${late ? "text-red-600" : "text-stone-500"}`}>
                        <CalendarClock size={13} />
                        {b.due ? (late ? `Was due ${niceDate(b.due)}` : b.due === today ? "Due today" : `Due ${niceDate(b.due)}`) : "No date given"}
                      </p>
                    </div>
                    <p className="font-black">{money(b.balance)}</p>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button className="btn-primary flex-1 px-3 py-2 text-sm" onClick={() => setOpen(open === b.id ? null : b.id)}>
                      {open === b.id ? "Close" : "Customer paid"}
                    </button>
                    {g.phone && (
                      <a className="btn-ghost px-3 py-2 text-sm" title="Send a reminder" target="_blank" rel="noreferrer"
                        href={`https://wa.me/${waNumber(g.phone)}?text=${encodeURIComponent(msg)}`}>
                        <MessageCircle size={16} /> Remind
                      </a>
                    )}
                  </div>
                  {open === b.id && <PayForm bill={b} onDone={() => setOpen(null)} />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PayForm({ bill, onDone }: { bill: Bill; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(String(bill.balance));
  const [method, setMethod] = useState<"Cash" | "M-Pesa" | "Card">("Cash");
  const [ref, setRef] = useState("");
  const [due, setDue] = useState(bill.due);
  const [error, setError] = useState("");
  const left = Math.round((bill.balance - (Number(amount) || 0)) * 100) / 100;

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r.error) return setError(r.error);
      router.refresh();
      onDone();
    });

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-stone-50 p-3">
      <div>
        <label className="label">Amount received</label>
        <input className="input text-lg font-bold" inputMode="decimal" value={amount} autoFocus
          onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setAmount(e.target.value)} />
        {Number(amount) > 0 && (
          <p className={`mt-1 text-sm font-semibold ${left < 0 ? "text-red-600" : "text-stone-600"}`}>
            {left < 0 ? "More than they owe" : left === 0 ? "This clears the bill" : `${money(left)} will still be owed`}
          </p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["Cash", "M-Pesa", "Card"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMethod(m)}
            className={`rounded-xl py-2 text-sm font-bold ring-1 ${method === m ? "bg-stone-900 text-white ring-stone-900" : "bg-white ring-stone-300"}`}>{m}</button>
        ))}
      </div>
      {method === "M-Pesa" && <input className="input uppercase" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="M-Pesa code" />}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={pending || !(Number(amount) > 0) || left < 0}
        onClick={() => run(() => recordPayment({ saleId: bill.id, amount: Number(amount), method, mpesaRef: ref }))}>
        {pending ? "Saving…" : `Save payment · ${money(Number(amount) || 0)}`}
      </button>
      <div className="flex items-end gap-2 border-t border-stone-200 pt-3">
        <div className="flex-1">
          <label className="label">Promised to pay by</label>
          <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <button className="btn-ghost px-3 py-2.5 text-sm" disabled={pending || due === bill.due} onClick={() => run(() => setDueDate(bill.id, due))}>Save date</button>
        {due && <button className="rounded-full bg-stone-200 p-2.5" title="Clear date" onClick={() => setDue("")}><X size={14} /></button>}
      </div>
    </div>
  );
}
