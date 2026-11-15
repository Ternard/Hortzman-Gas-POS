import { db, num } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { todayYMD } from "@/lib/format";
import DebtsClient from "@/components/DebtsClient";

export default async function DebtsPage() {
  await requireUser();
  const rows = await db()`
    SELECT s.id, s.receipt_no, s.total, s.customer_name, s.customer_phone, s.created_at,
      to_char(s.due_date, 'YYYY-MM-DD') AS due_date,
      coalesce(p.paid, 0) AS paid,
      (SELECT string_agg(si.product_name, ', ' ORDER BY si.id) FROM sale_items si WHERE si.sale_id = s.id) AS items
    FROM sales s
    LEFT JOIN (SELECT sale_id, sum(amount) AS paid FROM sale_payments GROUP BY sale_id) p ON p.sale_id = s.id
    WHERE s.status = 'completed' AND s.total - coalesce(p.paid, 0) > 0.004
    ORDER BY s.due_date NULLS LAST, s.created_at`;
  const bills = rows.map((r) => ({
    id: r.id as string,
    receipt_no: r.receipt_no as number,
    customer: ((r.customer_name as string) || "Unnamed customer").trim(),
    phone: ((r.customer_phone as string) || "").trim(),
    total: num(r.total),
    paid: num(r.paid),
    balance: Math.round((num(r.total) - num(r.paid)) * 100) / 100,
    due: (r.due_date as string) || "",
    date: new Date(r.created_at).toISOString(),
    items: (r.items as string) || "",
  }));
  return <DebtsClient bills={bills} today={todayYMD()} />;
}
