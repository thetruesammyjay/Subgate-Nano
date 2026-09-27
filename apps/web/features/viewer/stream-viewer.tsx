"use client";

import { ArrowLeft, Check, CircleDollarSign, Clock3, LockKeyhole, Play, RadioTower, ShieldCheck, WalletCards } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Stream } from "../../types/stream";
import type { ViewingSession } from "../../types/session";
import { connectWallet, shortenAddress } from "../../lib/wallet";

const formatUsdc = (atomic: number) => `${(atomic / 1_000_000).toFixed(4)} USDC`;
const apiUrl = () => (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export function StreamViewer({ stream }: { stream: Stream }) {
  const [wallet, setWallet] = useState("");
  const [session, setSession] = useState<ViewingSession | null>(null);
  const [maxSpend, setMaxSpend] = useState("0.50");
  const [paymentSignature, setPaymentSignature] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pricingLabel = useMemo(() => stream.pricing.model === "pay_per_view" ? `${formatUsdc(stream.pricing.price_atomic ?? 0)} once` : `${formatUsdc(stream.pricing.rate_atomic_per_minute ?? 0)} per minute`, [stream]);
  const playbackUrl = session?.playback_url ? (session.playback_url.startsWith("http") ? session.playback_url : `${apiUrl()}${session.playback_url}`) : null;

  const startWatching = async () => {
    setMessage(null);
    setPending(true);
    try {
      const connected = wallet || (await connectWallet());
      setWallet(connected);
      const response = await fetch(`/api/streams/${stream.slug}/sessions`, { method: "POST", headers: paymentSignature ? { "PAYMENT-SIGNATURE": paymentSignature } : { "content-type": "application/json" }, body: JSON.stringify({ viewer_wallet: connected, max_spend_atomic: stream.pricing.model === "metered" ? Math.round(Number(maxSpend) * 1_000_000) : undefined, payment_signature: paymentSignature || undefined }) });
      const payload = await response.json().catch(() => null);
      if (response.status === 402) {
        const requirement = payload?.payment_required;
        throw new Error(requirement ? `Payment required: ${(Number(requirement.amount_atomic) / 1_000_000).toFixed(4)} USDC on ${requirement.network}.` : "Payment is required before this stream can start.");
      }
      if (!response.ok) throw new Error(payload?.detail ?? payload?.message ?? "Unable to start this viewing session.");
      setSession(payload as ViewingSession);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start playback.");
    } finally {
      setPending(false);
    }
  };

  const stopWatching = async () => {
    if (!session) return;
    setPending(true);
    const response = await fetch(`/api/sessions/${session.id}/stop`, { method: "POST", headers: paymentSignature ? { "PAYMENT-SIGNATURE": paymentSignature } : {}, body: JSON.stringify({ payment_signature: paymentSignature || undefined }) });
    const payload = await response.json().catch(() => null);
    if (response.ok) setSession(payload as ViewingSession);
    else setMessage(payload?.message ?? "Unable to stop this session.");
    setPending(false);
  };

  return (
    <section className="stream-viewer section-shell">
      <Link className="back-link" href="/streams"><ArrowLeft size={15} /> Back to streams</Link>
      <div className="stream-viewer-layout">
        <div className="stream-viewer-main">
          <div className="playback-frame">{playbackUrl ? <video className="playback-video" controls autoPlay playsInline src={playbackUrl} /> : <div className="playback-placeholder"><Play aria-hidden="true" size={34} /><span>{stream.stream_type === "livestream" ? "Live playback" : "Preview playback"}</span><small>{stream.free_preview_seconds ? `${stream.free_preview_seconds} second preview` : "Unlock to watch"}</small></div>}</div>
          <div className="stream-viewer-heading"><div><p className="eyebrow">{stream.stream_type === "livestream" ? "LIVE STREAM" : "PREMIUM VIDEO"}</p><h1>{stream.title}</h1><p className="creator-line"><RadioTower size={15} /> {stream.creator_display_name} <span>·</span> {stream.pricing.model === "metered" ? "Metered access" : "Pay per view"}</p></div><span className="status-badge published">{stream.is_published ? "Available" : "Offline"}</span></div>
          <p className="stream-description">{stream.description || "This creator has not added a description yet."}</p>
        </div>
        <aside className="stream-access-panel">
          <div className="access-panel-top"><span className="icon-square"><LockKeyhole size={17} /></span><span className="utility-label">Access panel</span></div>
          <div className="price-block"><span>{stream.pricing.model === "metered" ? "Watching costs" : "One access costs"}</span><strong>{pricingLabel}</strong><small>USDC on the configured network</small></div>
          {wallet ? <div className="connected-wallet"><Check size={15} /><span>{shortenAddress(wallet)}</span><span>ready</span></div> : null}
          {stream.pricing.model === "metered" ? <label className="field-label"><span>Maximum spend (USDC)</span><input type="number" min="0.000001" step="0.000001" value={maxSpend} onChange={(event) => setMaxSpend(event.target.value)} /></label> : null}
          <label className="field-label"><span>Payment signature <em>only when requested</em></span><textarea rows={3} value={paymentSignature} onChange={(event) => setPaymentSignature(event.target.value)} placeholder="Paste an x402 signature if your wallet adapter returns one" /></label>
          <button className="button primary button-wide" type="button" onClick={startWatching} disabled={pending || session?.status === "active"}><WalletCards size={16} /> {pending ? "Preparing..." : session?.status === "active" ? "Session is live" : "Start watching"}</button>
          {session?.status === "active" ? <button className="button secondary button-wide" type="button" onClick={stopWatching} disabled={pending}>Stop and settle</button> : null}
          {message ? <p className="form-message error-message">{message}</p> : null}
          {session?.status === "completed" ? <div className="receipt-mini"><Check size={17} /><div><strong>Session settled</strong><span>{formatUsdc(session.settled_atomic)} · {session.consumed_seconds}s watched</span></div></div> : null}
          <div className="access-notes"><span><ShieldCheck size={15} /> Wallet signature, no subscription</span><span><CircleDollarSign size={15} /> Receipt after settlement</span><span><Clock3 size={15} /> Preview: {stream.free_preview_seconds || 0}s</span></div>
        </aside>
      </div>
    </section>
  );
}
