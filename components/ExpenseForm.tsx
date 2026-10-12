"use client";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addExpense, deleteExpense } from "@/app/(app)/expenses/actions";

export default function ExpenseForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(addExpense, null as any);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
      <input name="description" className="input sm:col-span-2" placeholder="What was it for? e.g. Transport to depot" required />
      <input name="amount" className="input" inputMode="decimal" placeholder="Amount (KES)" required />
      <input name="category" className="input" list="exp-cats" placeholder="Category (optional)" />
      <datalist id="exp-cats">{["Rent", "Transport", "Wages", "Electricity", "Water", "Licences", "Repairs", "Other"].map((c) => <option key={c} value={c} />)}</datalist>
      <input name="date" type="date" className="input" defaultValue={today} />
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Add expense"}</button>
      {state?.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
    </form>
  );
}

export function DeleteExpense({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600" disabled={pending}
      onClick={() => confirm("Delete this expense?") && start(() => deleteExpense(id))}>
      <Trash2 size={16} />
    </button>
  );
}
