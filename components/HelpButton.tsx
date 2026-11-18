"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp, X } from "lucide-react";

const HELP: { match: (p: string) => boolean; title: string; steps: string[] }[] = [
  { match: (p) => p === "/", title: "How to sell", steps: [
    "Tap an item to add it. Tap again to add one more.",
    "For items sold by the metre (like hose), type the length.",
    "Choose how the customer pays: Cash, M-Pesa, Card, or Pay later.",
    "Pay later: type the customer's name. If they pay part now, type that amount. The rest stays as a pending bill.",
    "Press the big button at the bottom to finish the sale.",
  ] },
  { match: (p) => p.startsWith("/debts"), title: "Pending bills", steps: [
    "This is everyone who took goods and still owes money.",
    "When a customer pays, press Customer paid, check the amount and save.",
    "Press Remind to send them a WhatsApp reminder.",
  ] },
  { match: (p) => p.startsWith("/sales"), title: "Sales", steps: [
    "Total sales counts only bills that were paid in full.",
    "Items sold shows how many of each item went out, and how many were taken on Pay later.",
    "Tap any sale to see the receipt.",
  ] },
  { match: () => true, title: "Need help?", steps: [
    "Use the bar at the bottom to move between pages.",
    "Sell is where you make a sale. Debts shows who owes money.",
    "If something looks wrong, ask the owner before changing it.",
  ] },
];

export default function HelpButton() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const h = HELP.find((x) => x.match(path))!;
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Help" className="no-print flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1.5 text-sm font-semibold text-stone-700">
        <CircleHelp size={18} /> Help
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div className="relative w-full max-w-md rounded-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-stone-100 p-2"><X size={18} /></button>
            <h2 className="mb-3 pr-10 text-xl font-black">{h.title}</h2>
            <ol className="space-y-3">
              {h.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[15px]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-black text-orange-700">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
            <button onClick={() => setOpen(false)} className="btn-primary mt-5 w-full">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
