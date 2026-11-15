import { db, num } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import EmptiesClient from "@/components/EmptiesClient";

export default async function EmptiesPage() {
  await requireAdmin();
  const sql = db();
  const rows = await sql`SELECT id, name, stock, empties, unit FROM products
    WHERE active AND tracks_empties ORDER BY selling_price, name`;
  const reqs = await sql`SELECT r.id, r.req_no, r.status, r.supplier, r.created_at,
      (SELECT string_agg(ri.product_name || ' ×' || ri.qty_sent, ', ' ORDER BY ri.id) FROM requisition_items ri WHERE ri.requisition_id = r.id) AS summary
    FROM requisitions r ORDER BY r.created_at DESC LIMIT 30`;
  return (
    <EmptiesClient
      products={rows.map((r) => ({ id: r.id as number, name: r.name as string, stock: num(r.stock), empties: num(r.empties) }))}
      requisitions={reqs.map((r) => ({
        id: r.id as number, req_no: r.req_no as number, status: r.status as string,
        supplier: (r.supplier as string) || "", created_at: new Date(r.created_at).toISOString(), summary: (r.summary as string) || "",
      }))}
    />
  );
}
