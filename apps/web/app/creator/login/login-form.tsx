"use client";

import { ArrowRight, KeyRound, WalletCards } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function CreatorLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next")?.startsWith("/") ? params.get("next")! : "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsPending(true);
    try {
      const response = await fetch("/api/auth/creator/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? payload?.detail ?? "Unable to sign in.");
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsPending(false);
    }
  };

  return <section className="auth-card" aria-label="Creator sign in">
    <div className="auth-card-heading"><span className="icon-square"><KeyRound size={18} /></span><div><p className="utility-label">Creator account</p><h2>Sign in.</h2></div></div>
    <p className="auth-card-copy">Use the email and password you set up for your creator desk.</p>
    <form onSubmit={submit}>
      <label className="field-label"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
      <label className="field-label"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
      <button className="button primary button-wide" type="submit" disabled={isPending}>{isPending ? "Signing in..." : "Open creator desk"}<ArrowRight size={16} /></button>
    </form>
    {message ? <p className="form-message error-message">{message}</p> : null}
    <div className="auth-links"><Link href="/creator/register">Create a creator account</Link><Link href="/login"><WalletCards size={14} /> Sign in with wallet</Link></div>
  </section>;
}
