import {
  Clock3,
  Play,
  RadioTower,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { FloatingIcons } from "../components/floating-icons";
import { SiteHeader } from "../components/site-header";

const flowSteps = [
  { label: "Discover", value: "Open a premium stream." },
  { label: "Connect", value: "Approve USDC with your wallet." },
  { label: "Watch", value: "A signed session meters playback." },
  { label: "Stop", value: "Settlement stops when you do." },
];

export default function Home() {
  return (
    <main id="top">
      <SiteHeader />
      <FloatingIcons />

      <section className="hero section-shell">
        <div className="hero-copy">
          <p className="eyebrow">ARBITRUM / USDC / STREAMING</p>
          <h1>Pay only for what you consume.</h1>
          <p className="hero-text">
            Subgate Nano lets viewers pay for premium video and live streams by
            entry or by the minute—without a subscription.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#flow">How it works <Play aria-hidden="true" size={16} /></a>
            <Link className="button secondary" href="/dashboard">Creator dashboard</Link>
          </div>
        </div>

        <div className="hero-instrument" aria-label="Metered viewing example">
          <p className="instrument-label">LIVE VIEWING SESSION</p>
          <div className="instrument-value">0.145<span>USDC spent</span></div>
          <div className="segment-bar" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => <span className={index < 11 ? "filled" : ""} key={index} />)}
          </div>
          <div className="instrument-grid">
            <div><span>Rate</span><strong>0.01/min</strong></div>
            <div><span>Watch time</span><strong>14m 32s</strong></div>
            <div><span>Status</span><strong>LIVE</strong></div>
          </div>
        </div>
      </section>

      <section id="flow" className="section-shell flow-section">
        <div className="section-heading">
          <p className="eyebrow">VIEWING FLOW</p>
          <h2>Start watching. Pay fairly. Stop anytime.</h2>
        </div>
        <div className="flow-grid">
          {flowSteps.map((step, index) => (
            <div className="flow-step" key={step.label}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.label}</strong>
              <p>{step.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="streams" className="section-shell roles-section">
        <article><RadioTower aria-hidden="true" /><span>PAY PER VIEW</span><p>One USDC payment unlocks a video or a live event.</p></article>
        <article><Clock3 aria-hidden="true" /><span>PAY AS YOU WATCH</span><p>A validated playback session bills only for time watched.</p></article>
        <article><WalletCards aria-hidden="true" /><span>FREE PREVIEW</span><p>Creators can let viewers sample before payment begins.</p></article>
      </section>

      <section className="section-shell agent-section">
        <div className="agent-rail">
          <ReceiptText aria-hidden="true" size={32} />
          <p className="eyebrow">CLEAR RECEIPTS</p>
          <h2>Every paid session ends with a verifiable record.</h2>
        </div>
        <div className="agent-events">
          <div className="agent-event"><span>Time watched</span><strong>32m 41s</strong></div>
          <div className="agent-event"><span>Amount used</span><strong>0.327 USDC</strong></div>
          <div className="agent-event"><span>Network</span><strong>ARBITRUM</strong></div>
        </div>
      </section>

      <footer id="footer" className="site-footer">
        <div><a className="brand footer-brand" href="#top"><span>Subgate Nano</span></a><p>Streaming payments that stop when watching stops.</p></div>
        <nav aria-label="Footer navigation"><a href="#flow">Viewing flow</a><a href="#streams">Pricing</a><Link href="/dashboard">Creator dashboard</Link></nav>
      </footer>
    </main>
  );
}
