import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { db, num } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { BUSINESS_NAME, dateTime, money } from "@/lib/format";
import ReceiptActions from "@/components/ReceiptActions";

export default async function ReceiptPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sql = db();
  const [s] = await sql`SELECT s.*, u.name AS cashier FROM sales s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = ${id}`;
  if (!s) notFound();
  if (user.role !== "admin" && s.user_id !== user.id) notFound();
  const items = await sql`SELECT product_name, quantity, unit_price FROM sale_items WHERE sale_id = ${id} ORDER BY id`;
  const change = num(s.amount_paid) - num(s.total);

  const text = [
    `*${BUSINESS_NAME}*`, `Receipt #${s.receipt_no}`, dateTime(s.created_at), "",
    ...items.map((i) => `${i.product_name} x${i.quantity} = ${money(num(i.unit_price) * i.quantity)}`),
    "", num(s.discount) > 0 ? `Discount: -${money(s.discount)}` : "",
    `*TOTAL: ${money(s.total)}*`, `Paid via ${s.payment_method}${s.mpesa_ref ? " (" + s.mpesa_ref + ")" : ""}`,
    "", "Thank you for buying with us!",
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");

  return (
    <div className="mx-auto max-w-sm">
      {sp.new && (
        <div className="no-print mb-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 font-semibold text-green-800">
          <CheckCircle2 size={20} /> Sale saved
          {s.payment_method === "Cash" && change > 0 && <span className="ml-auto">Change: {money(change)}</span>}
        </div>
      )}
      <div className="card print-area font-mono text-sm">
        <div className="text-center">
          <p className="text-lg font-black tracking-wide">{BUSINESS_NAME}</p>
          <p className="text-xs text-stone-500">Receipt #{s.receipt_no}</p>
          <p className="text-xs text-stone-500">{dateTime(s.created_at)}</p>
          {s.status === "voided" && <p className="mt-2 rounded bg-red-100 py-1 font-bold text-red-700">VOIDED</p>}
        </div>
        <div className="my-3 border-t border-dashed border-stone-300" />
        {items.map((i, idx) => (
          <div key={idx} className="flex justify-between gap-2 py-0.5">
            <span>{i.product_name} × {i.quantity}</span>
            <span>{money(num(i.unit_price) * i.quantity)}</span>
          </div>
        ))}
        <div className="my-3 border-t border-dashed border-stone-300" />
        {num(s.discount) > 0 && <>
          <div className="flex justify-between"><span>Subtotal</span><span>{money(s.subtotal)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>−{money(s.discount)}</span></div>
        </>}
        <div className="flex justify-between text-base font-black"><span>TOTAL</span><span>{money(s.total)}</span></div>
        <div className="flex justify-between"><span>Paid ({s.payment_method})</span><span>{money(s.amount_paid ?? s.total)}</span></div>
        {s.payment_method === "Cash" && change > 0 && <div className="flex justify-between"><span>Change</span><span>{money(change)}</span></div>}
        {s.mpesa_ref && <div className="flex justify-between"><span>M-Pesa code</span><span>{s.mpesa_ref}</span></div>}
        {s.customer_name && <div className="flex justify-between"><span>Customer</span><span>{s.customer_name}</span></div>}
        <div className="flex justify-between text-stone-500"><span>Served by</span><span>{s.cashier}</span></div>
        <p className="mt-4 text-center text-xs text-stone-500">Thank you for buying with us!</p>
      </div>
      <ReceiptActions id={s.id} text={text} phone={s.customer_phone} canVoid={user.role === "admin" && s.status === "completed"} />
      <Link href="/" className="btn-primary no-print mt-3 w-full">New sale</Link>
    </div>
  );
}
