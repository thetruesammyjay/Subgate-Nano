"use client";

import { ArrowRight, Check, Link2, WalletCards } from "../../../components/dashboards/dashboard-icons";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { connectWallet, shortenAddress } from "../../../lib/wallet";

export function CreatorRegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next")?.startsWith("/") ? params.get("next")! : "/dashboard";
  const [form, setForm] = useState({ email: "", password: "", password_confirm: "", username: "", display_name: "", website: "", x: "", instagram: "", youtube: "" });
  const [wallet, setWallet] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (form.password !== form.password_confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    setIsPending(true);
    try {
      const social_links = Object.fromEntries(Object.entries({ website: form.website, x: form.x, instagram: form.instagram, youtube: form.youtube }).filter(([, value]) => value.trim()));
      const response = await fetch("/api/auth/creator/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.email, password: form.password, username: form.username, display_name: form.display_name || undefined, social_links, wallet_address: wallet || undefined }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? payload?.detail ?? "Unable to create your account.");
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create your account.");
    } finally {
      setIsPending(false);
    }
  };

  const linkWallet = async () => {
    try { setWallet(await connectWallet()); } catch (error) { setMessage(error instanceof Error ? error.message : "Wallet connection failed."); }
  };

  return <section className="auth-card auth-card-wide" aria-label="Creator registration"><div className="auth-card-heading"><span className="icon-square"><Link2 size={18} /></span><div><p className="utility-label">Creator account</p><h2>Create your desk.</h2></div></div><p className="auth-card-copy">Your password protects the desk. Your public links help viewers find you.</p><form onSubmit={submit}><div className="field-grid"><label className="field-label"><span>Email</span><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" required /></label><label className="field-label"><span>Username</span><input value={form.username} onChange={(event) => update("username", event.target.value)} autoComplete="username" placeholder="your-handle" required /></label></div><div className="field-grid"><label className="field-label"><span>Password</span><input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete="new-password" minLength={8} required /></label><label className="field-label"><span>Confirm password</span><input type="password" value={form.password_confirm} onChange={(event) => update("password_confirm", event.target.value)} autoComplete="new-password" minLength={8} required /></label></div><label className="field-label"><span>Display name <em>optional</em></span><input value={form.display_name} onChange={(event) => update("display_name", event.target.value)} autoComplete="name" /></label><p className="form-section-label">Public links <em>optional</em></p><div className="field-grid"><label className="field-label"><span>Website</span><input type="url" value={form.website} onChange={(event) => update("website", event.target.value)} placeholder="https://" /></label><label className="field-label"><span>X / Twitter</span><input type="url" value={form.x} onChange={(event) => update("x", event.target.value)} placeholder="https://x.com/" /></label><label className="field-label"><span>Instagram</span><input type="url" value={form.instagram} onChange={(event) => update("instagram", event.target.value)} placeholder="https://instagram.com/" /></label><label className="field-label"><span>YouTube</span><input type="url" value={form.youtube} onChange={(event) => update("youtube", event.target.value)} placeholder="https://youtube.com/" /></label></div><div className="optional-wallet"><div><span className="utility-label">Wallet link <em>optional for now</em></span>{wallet ? <strong><Check size={15} /> {shortenAddress(wallet)}</strong> : <p>Connect later when you are ready to publish a paid stream.</p>}</div>{wallet ? null : <button className="button secondary" type="button" onClick={linkWallet}><WalletCards size={15} /> Connect wallet</button>}</div><button className="button primary button-wide" type="submit" disabled={isPending}>{isPending ? "Creating account..." : "Create creator account"}<ArrowRight size={16} /></button></form>{message ? <p className="form-message error-message">{message}</p> : null}<p className="auth-footnote">By continuing, you agree to keep your account details accurate. Already have an account? <Link href="/creator/login">Sign in</Link></p></section>;
}
