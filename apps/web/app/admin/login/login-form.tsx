"use client";

import { ArrowRight, LockKeyhole } from "../../../components/dashboards/dashboard-icons";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function AdminLoginForm() {
  const params = useSearchParams();
  const requestedNext = params.get("next");
  const nextPath = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.startsWith("/\\")
    ? requestedNext
    : "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMessage(null); setIsPending(true);
    try {
      const response = await fetch("/api/auth/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? payload?.detail ?? "Unable to sign in.");
      window.location.replace(nextPath);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to sign in."); } finally { setIsPending(false); }
  };
  return <section className="auth-card" aria-label="Admin sign in"><div className="auth-card-heading"><span className="icon-square"><LockKeyhole size={18} /></span><div><p className="utility-label">Admin account</p><h2>Sign in.</h2></div></div><p className="auth-card-copy">Admin accounts are created by seeding the API database. There is no public admin registration.</p><form onSubmit={submit}><label className="field-label"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label><label className="field-label"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label><button className="button primary button-wide" type="submit" disabled={isPending}>{isPending ? "Checking access..." : "Open admin desk"}<ArrowRight size={16} /></button></form>{message ? <p className="form-message error-message">{message}</p> : null}</section>;
}
