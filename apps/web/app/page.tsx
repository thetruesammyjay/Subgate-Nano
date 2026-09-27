import { ArrowRight, Clock3, Play, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import Link from "next/link";
import { FloatingIcons } from "../components/floating-icons";
import { SiteHeader } from "../components/site-header";
import { StreamGallery } from "../components/streams/stream-gallery";

const flowSteps = [
  { label: "Discover", value: "Open a premium stream." },
  { label: "Connect", value: "Approve access with your wallet." },
  { label: "Watch", value: "A signed session meters playback." },
  { label: "Stop", value: "Settlement stops when you do." },
];

export default function Home() {
  return (
    <main id="top" className="public-page home-page">
      <SiteHeader />
      <FloatingIcons />

      <section className="hero section-shell">
        <div className="hero-copy">
          <p className="eyebrow">ARBITRUM / USDC / STREAMING</p>
          <h1>Pay only for what you consume.</h1>
          <p className="hero-text">Subgate Nano gives creators a precise access layer for premium video and live streams. No subscription pressure. No opaque checkout.</p>
          <div className="hero-actions"><Link className="button primary" href="/streams">Explore streams <ArrowRight aria-hidden="true" size={16} /></Link><a className="button secondary" href="#flow">See the model <Play aria-hidden="true" size={15} /></a></div>
          <div className="hero-note"><ShieldCheck aria-hidden="true" size={16} /><span>Wallet-native access with a receipt at the end of every paid session.</span></div>
        </div>
        <div className="hero-instrument" aria-label="Metered viewing example"><div className="instrument-top"><span className="utility-label">LIVE VIEWING SESSION</span><span className="signal-live"><i /> LIVE</span></div><div className="instrument-value">0.145<span>USDC spent</span></div><div className="segment-bar" aria-hidden="true">{Array.from({ length: 18 }).map((_, index) => <span className={index < 11 ? "filled" : ""} key={index} />)}</div><div className="instrument-grid"><div><span>Rate</span><strong>0.01/min</strong></div><div><span>Watch time</span><strong>14m 32s</strong></div><div><span>Status</span><strong>SETTLED</strong></div></div><div className="instrument-footer"><ReceiptText size={15} /><span>Receipt ready · Arbitrum</span></div></div>
      </section>

      <section id="flow" className="section-shell flow-section"><div className="section-heading"><p className="eyebrow">VIEWING FLOW</p><h2>Start watching. Pay fairly. Stop anytime.</h2><p>Subgate makes the access boundary visible before playback begins.</p></div><div className="flow-grid">{flowSteps.map((step, index) => <div className="flow-step" key={step.label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step.label}</strong><p>{step.value}</p></div>)}</div></section>

      <section id="streams" className="section-shell home-streams"><div className="section-heading section-heading-row"><div><p className="eyebrow">STREAM DIRECTORY</p><h2>Something worth opening.</h2><p>Published streams show their price before they ask for your wallet.</p></div><Link className="text-link" href="/streams">View all streams <span aria-hidden="true">↗</span></Link></div><StreamGallery /></section>

      <section className="section-shell roles-section"><article><WalletCards aria-hidden="true" /><span>PAY PER VIEW</span><p>One USDC payment unlocks a video or a live event.</p></article><article><Clock3 aria-hidden="true" /><span>PAY AS YOU WATCH</span><p>A validated playback session bills only for time watched.</p></article><article><ShieldCheck aria-hidden="true" /><span>VERIFIABLE RECEIPTS</span><p>Creators and viewers can trace what settled, when, and why.</p></article></section>

      <section className="section-shell agent-section"><div className="agent-rail"><ReceiptText aria-hidden="true" size={32} /><p className="eyebrow">CLEAR RECEIPTS</p><h2>Every paid session ends with a verifiable record.</h2></div><div className="agent-events"><div className="agent-event"><span>Time watched</span><strong>32m 41s</strong></div><div className="agent-event"><span>Amount used</span><strong>0.327 USDC</strong></div><div className="agent-event"><span>Network</span><strong>ARBITRUM</strong></div></div></section>

      <footer id="footer" className="site-footer"><div><Link className="footer-logo" href="/"><span>Subgate Nano</span></Link><p>Streaming payments that stop when watching stops.</p></div><nav aria-label="Footer navigation"><Link href="#flow">Viewing flow</Link><Link href="/streams">Explore streams</Link><Link href="/dashboard">Creator desk</Link></nav></footer>
    </main>
  );
}
