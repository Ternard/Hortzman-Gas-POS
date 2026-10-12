import { db, num } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { money, resolveRange, todayYMD } from "@/lib/format";
import RangePicker from "@/components/RangePicker";
import ExpenseForm, { DeleteExpense } from "@/components/ExpenseForm";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { range, from, to } = resolveRange({ range: "month", ...sp });
  const rows = await db()`SELECT id, description, category, amount, to_char(expense_date, 'YYYY-MM-DD') AS d
    FROM expenses WHERE expense_date BETWEEN ${from}::date AND ${to}::date ORDER BY expense_date DESC, id DESC`;
  const total = rows.reduce((s, r) => s + num(r.amount), 0);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-black">Expenses</h1>
      <p className="mb-3 text-sm text-stone-500">Rent, transport, wages, electricity… These are subtracted from profit in Reports.</p>
      <div className="card mb-4"><ExpenseForm today={todayYMD()} /></div>
      <RangePicker range={range} from={from} to={to} />
      <div className="card p-0">
        <div className="flex justify-between border-b border-stone-100 p-3 font-bold"><span>Total</span><span>{money(total)}</span></div>
        {rows.length === 0 && <p className="p-6 text-center text-sm text-stone-400">No expenses in this period.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-b border-stone-100 p-3 last:border-0">
            <div className="flex-1"><p className="font-semibold">{r.description}</p><p className="text-xs text-stone-400">{r.d}{r.category ? " · " + r.category : ""}</p></div>
            <b>{money(r.amount)}</b>
            <DeleteExpense id={r.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
