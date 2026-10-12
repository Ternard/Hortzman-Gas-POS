"use client";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { addUser, resetPassword, toggleUser } from "@/app/(app)/users/actions";

type U = { id: number; name: string; username: string; role: string; active: boolean };

export default function UsersClient({ users, meId }: { users: U[]; meId: number }) {
  const [state, action, pending] = useActionState(addUser, null as any);
  const ref = useRef<HTMLFormElement>(null);
  const [busy, start] = useTransition();
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-black">Staff</h1>
      <p className="mb-3 text-sm text-stone-500">Cashiers can only sell and see their own sales. Owners (admin) see everything.</p>
      <div className="card mb-4 divide-y divide-stone-100 p-0">
        {users.map((u) => (
          <div key={u.id} className={`flex flex-wrap items-center gap-2 p-3 ${u.active ? "" : "opacity-50"}`}>
            <div className="flex-1">
              <p className="font-semibold">{u.name} {u.id === meId && <span className="text-xs text-stone-400">(you)</span>}</p>
              <p className="text-xs text-stone-400">@{u.username} · {u.role === "admin" ? "Owner/Admin" : "Cashier"}{u.active ? "" : " · disabled"}</p>
            </div>
            <button className="btn-ghost px-3 py-1.5 text-sm" disabled={busy}
              onClick={() => { const p = prompt(`New password for ${u.name} (min 6 characters)`); if (p) start(async () => { const r = await resetPassword(u.id, p); alert(r.error || "Password changed."); }); }}>
              Reset password
            </button>
            {u.id !== meId && (
              <button className="btn-ghost px-3 py-1.5 text-sm" disabled={busy} onClick={() => start(async () => { await toggleUser(u.id, !u.active); })}>
                {u.active ? "Disable" : "Enable"}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="card">
        <h2 className="mb-3 font-bold">Add staff</h2>
        <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
          <input name="name" className="input" placeholder="Full name" required />
          <input name="username" className="input" placeholder="Username" autoCapitalize="none" required />
          <input name="password" type="password" className="input" placeholder="Password (min 6)" minLength={6} required />
          <select name="role" className="input" defaultValue="cashier"><option value="cashier">Cashier</option><option value="admin">Owner / Admin</option></select>
          {state?.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
          {state?.ok && <p className="text-sm text-green-700 sm:col-span-2">Staff member added.</p>}
          <button className="btn-primary sm:col-span-2" disabled={pending}>{pending ? "Adding…" : "Add staff"}</button>
        </form>
      </div>
    </div>
  );
}
