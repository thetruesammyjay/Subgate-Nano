"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, CircleDollarSign, Clock3, LockKeyhole, Play, RadioTower, ShieldCheck, WalletCards } from "../../components/dashboards/dashboard-icons";
import type { Stream } from "../../types/stream";
import type { ViewingSession } from "../../types/session";
import { connectWallet, shortenAddress } from "../../lib/wallet";
import { ChainTransactionFailedError, explorerTransactionUrl, settlePayPerViewOnArbitrum } from "../../lib/arbitrum";

const formatUsdc = (atomic: number) => `${(atomic / 1_000_000).toFixed(4)} USDC`;
const apiUrl = () => (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export function StreamViewer({ stream }: { stream: Stream }) {
  const [wallet, setWallet] = useState("");
  const [session, setSession] = useState<ViewingSession | null>(null);
  const [maxSpend, setMaxSpend] = useState("0.50");
  const [pendingSettlement, setPendingSettlement] = useState<{ sessionId: string; viewerWallet: string; txHash: string } | null>(null);
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
      let body: Record<string, unknown> = {
        viewer_wallet: connected,
        max_spend_atomic: stream.pricing.model === "metered" ? Math.round(Number(maxSpend) * 1_000_000) : undefined,
      };
      if (stream.pricing.model === "pay_per_view") {
        if (!stream.chain || !stream.chain_stream_id || !stream.registry_transaction_hash) {
          throw new Error("This stream is not configured for a verified Arbitrum Sepolia payment yet.");
        }
        const amountAtomic = stream.pricing.price_atomic;
        if (!amountAtomic) throw new Error("This stream has no payable price configured.");
        let pendingPayment = pendingSettlement;
        if (!pendingPayment) {
          const payment = await settlePayPerViewOnArbitrum(stream.chain, stream.chain_stream_id, amountAtomic, setPendingSettlement);
          pendingPayment = { sessionId: payment.sessionId, viewerWallet: payment.viewerWallet, txHash: payment.settlementTxHash };
          setPendingSettlement(pendingPayment);
        }
        body = {
          viewer_wallet: pendingPayment.viewerWallet,
          session_id: pendingPayment.sessionId,
          settlement_tx_hash: pendingPayment.txHash,
        };
      }
      const response = await fetch(`/api/streams/${stream.slug}/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => null);
      if (response.status === 402) {
        const requirement = payload?.payment_required;
        throw new Error(requirement ? `Payment required: ${(Number(requirement.amount_atomic) / 1_000_000).toFixed(4)} USDC on ${requirement.network}.` : "Payment is required before this stream can start.");
      }
      if (!response.ok) throw new Error(payload?.detail ?? payload?.message ?? "Unable to start this viewing session.");
      setSession(payload as ViewingSession);
      setPendingSettlement(null);
    } catch (error) {
      if (error instanceof ChainTransactionFailedError) setPendingSettlement(null);
      setMessage(error instanceof Error ? error.message : "Unable to start playback.");
    } finally {
      setPending(false);
    }
  };

  const stopWatching = async () => {
    if (!session) return;
    setPending(true);
    const response = await fetch(`/api/sessions/${session.id}/stop`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
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
          <div className="price-block"><span>{stream.pricing.model === "metered" ? "Watching costs" : "One access costs"}</span><strong>{pricingLabel}</strong><small>{stream.pricing.model === "pay_per_view" && stream.chain ? `${stream.chain.network} · approve, then settle in your wallet` : stream.pricing.model === "metered" ? "Metered Arbitrum settlement is not enabled yet" : "Arbitrum settlement is not configured"}</small></div>
          {wallet ? <div className="connected-wallet"><Check size={15} /><span>{shortenAddress(wallet)}</span><span>ready</span></div> : null}
          {stream.pricing.model === "metered" ? <label className="field-label"><span>Maximum spend (USDC)</span><input type="number" min="0.000001" step="0.000001" value={maxSpend} onChange={(event) => setMaxSpend(event.target.value)} /></label> : null}
          <button className="button primary button-wide" type="button" onClick={startWatching} disabled={pending || session?.status === "active" || (stream.pricing.model === "pay_per_view" && Boolean(session?.playback_url))}><WalletCards size={16} /> {pending ? "Preparing..." : pendingSettlement ? "Retry payment verification" : session?.status === "active" ? "Session is live" : session?.playback_url ? "Access unlocked" : stream.pricing.model === "pay_per_view" ? "Pay & start watching" : "Start watching"}</button>
          {pendingSettlement && stream.chain ? <p className="form-message">Payment confirmed in your wallet. If verification is temporarily unavailable, retry using the same transaction: <a href={explorerTransactionUrl(stream.chain, pendingSettlement.txHash)} target="_blank" rel="noreferrer">view on Arbiscan</a></p> : null}
          {session?.status === "active" ? <button className="button secondary button-wide" type="button" onClick={stopWatching} disabled={pending}>Stop and settle</button> : null}
          {message ? <p className="form-message error-message">{message}</p> : null}
          {session?.status === "completed" ? <div className="receipt-mini"><Check size={17} /><div><strong>Session settled</strong><span>{formatUsdc(session.settled_atomic)} · {session.consumed_seconds}s watched</span>{session.settlement_tx_hash && stream.chain ? <a href={explorerTransactionUrl(stream.chain, session.settlement_tx_hash)} target="_blank" rel="noreferrer">View verified payment and receipt ↗</a> : null}</div></div> : null}
          <div className="access-notes"><span><ShieldCheck size={15} /> Wallet signature, no subscription</span><span><CircleDollarSign size={15} /> Receipt after settlement</span><span><Clock3 size={15} /> Preview: {stream.free_preview_seconds || 0}s</span></div>
        </aside>
      </div>
    </section>
  );
}
