"use client";
import { useActionState } from "react";
import { setupAction } from "./actions";

export default function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, null as { error?: string } | null);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label">Owner's name</label><input name="name" className="input" required /></div>
      <div><label className="label">Username</label><input name="username" className="input" autoCapitalize="none" required /></div>
      <div><label className="label">Password</label><input name="password" type="password" className="input" minLength={6} required /></div>
      <label className="flex items-start gap-3 rounded-xl bg-orange-50 p-3 text-sm">
        <input type="checkbox" name="seed" defaultChecked className="mt-1 h-4 w-4 accent-orange-600" />
        <span>Add starter items: 3kg, 6kg, 13kg, 50kg refills, hose pipe and burner. You'll set the prices next.</span>
      </label>
      {state?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Setting up…" : "Create shop"}</button>
    </form>
  );
}
