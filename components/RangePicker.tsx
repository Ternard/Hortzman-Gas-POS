"use client";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

export default function RangePicker({ range, from, to }: { range: string; from: string; to: string }) {
  const router = useRouter();
  const path = usePathname();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const go = (q: string) => router.push(`${path}?${q}`);
  const opts = [["today", "Today"], ["7d", "7 days"], ["month", "This month"], ["custom", "Custom"]];
  return (
    <div className="mb-4 space-y-2">
      <div className="flex gap-2 overflow-x-auto">
        {opts.map(([k, l]) => (
          <button key={k} onClick={() => (k === "custom" ? go(`range=custom&from=${f}&to=${t}`) : go(`range=${k}`))}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${range === k ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"}`}>
            {l}
          </button>
        ))}
      </div>
      {range === "custom" && (
        <div className="flex items-end gap-2">
          <div className="flex-1"><label className="label">From</label><input type="date" className="input" value={f} onChange={(e) => setF(e.target.value)} /></div>
          <div className="flex-1"><label className="label">To</label><input type="date" className="input" value={t} onChange={(e) => setT(e.target.value)} /></div>
          <button className="btn-dark" onClick={() => go(`range=custom&from=${f}&to=${t}`)}>Go</button>
        </div>
      )}
    </div>
  );
}
