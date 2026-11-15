import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db, num } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { BUSINESS_NAME, dateTime } from "@/lib/format";
import RequisitionActions from "@/components/RequisitionActions";

export default async function RequisitionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const sql = db();
  const [r] = await sql`SELECT r.*, u.name AS by FROM requisitions r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = ${Number(id)}`;
  if (!r) notFound();
  const items = (await sql`SELECT id, product_name, qty_sent, qty_received FROM requisition_items WHERE requisition_id = ${r.id} ORDER BY id`)
    .map((i) => ({ id: i.id as number, name: i.product_name as string, sent: num(i.qty_sent), received: num(i.qty_received) }));
  const totalSent = items.reduce((s, i) => s + i.sent, 0);

  const text = [
    `*${BUSINESS_NAME}*`,
    `*REQUISITION REQ-${r.req_no}*`,
    dateTime(r.created_at),
    r.supplier ? `To: ${r.supplier}` : "",
    "",
    "Empty cylinders for refilling:",
    ...items.map((i) => `• ${i.name}: ${i.sent}`),
    `Total: ${totalSent}`,
    r.note ? `\nNote: ${r.note}` : "",
    "\nPlease confirm with your LPO.",
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");

  return (
    <div className="mx-auto max-w-md">
      <Link href="/empties" className="no-print mb-3 inline-flex items-center gap-1 text-sm font-semibold text-stone-500"><ArrowLeft size={16} /> Empties</Link>
      <div className="card print-area text-sm">
        <div className="text-center">
          <p className="text-lg font-black tracking-wide">{BUSINESS_NAME}</p>
          <p className="font-bold">REQUISITION · REQ-{r.req_no}</p>
          <p className="text-xs text-stone-500">{dateTime(r.created_at)}</p>
          {r.status === "cancelled" && <p className="mt-2 rounded bg-stone-200 py-1 font-bold text-stone-600">CANCELLED</p>}
          {r.status === "received" && <p className="mt-2 rounded bg-green-100 py-1 font-bold text-green-800">RECEIVED</p>}
        </div>
        <div className="my-3 border-t border-dashed border-stone-300" />
        {r.supplier && <p className="mb-2"><span className="text-stone-500">To:</span> <b>{r.supplier}</b></p>}
        <table className="w-full">
          <thead className="text-left text-xs text-stone-400">
            <tr><th className="pb-1">Empty cylinders to refill</th><th className="pb-1 text-right">Qty</th>{r.status === "received" && <th className="pb-1 text-right">Got back</th>}</tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-stone-100">
                <td className="py-1.5 font-medium">{i.name}</td>
                <td className="text-right">{i.sent}</td>
                {r.status === "received" && <td className="text-right">{i.received}</td>}
              </tr>
            ))}
            <tr className="border-t border-stone-300 font-black"><td className="pt-2">Total</td><td className="pt-2 text-right">{totalSent}</td>{r.status === "received" && <td className="pt-2 text-right">{items.reduce((s, i) => s + i.received, 0)}</td>}</tr>
          </tbody>
        </table>
        {r.note && <p className="mt-3 text-stone-600">Note: {r.note}</p>}
        <div className="mt-8 grid grid-cols-2 gap-6 text-xs text-stone-500">
          <div><div className="border-t border-stone-400 pt-1">Prepared by{r.by ? `: ${r.by}` : ""}</div></div>
          <div><div className="border-t border-stone-400 pt-1">Received by (driver)</div></div>
        </div>
      </div>
      <RequisitionActions id={r.id} status={r.status} text={text} items={items} />
    </div>
  );
}
