"use client";
import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null as { error?: string } | null);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label">Username</label><input name="username" className="input" autoCapitalize="none" autoComplete="username" required /></div>
      <div><label className="label">Password</label><input name="password" type="password" className="input" autoComplete="current-password" required /></div>
      {state?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
