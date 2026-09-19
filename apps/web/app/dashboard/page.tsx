import { Activity, CircleDollarSign, RadioTower, ReceiptText } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "../../components/site-header";

const sessions = [
  ["0x82...A19", "FUTO Tech Conference", "32m 41s", "0.327 USDC"],
  ["0x47...C12", "Creator Masterclass", "14m 32s", "0.145 USDC"],
];

export default function DashboardPage() {
  return (
    <main id="top">
      <SiteHeader />
      <section className="dashboard-hero section-shell">
        <div>
          <p className="eyebrow">SUBGATE CREATOR</p>
          <h1>Streaming, without subscription pressure.</h1>
          <p>Manage your videos and livestreams, then see each paid viewing session as it settles.</p>
        </div>
        <Link className="button primary" href="/#streams">Create stream</Link>
      </section>
      <section className="section-shell roles-section">
        <article><CircleDollarSign aria-hidden="true" /><span>TOTAL REVENUE</span><p><strong>184.62 USDC</strong></p></article>
        <article><Activity aria-hidden="true" /><span>LIVE VIEWERS</span><p><strong>328</strong></p></article>
        <article><RadioTower aria-hidden="true" /><span>WATCH TIME</span><p><strong>12,841 mins</strong></p></article>
      </section>
      <section className="section-shell dashboard-payments-panel">
        <div className="dashboard-panel-heading"><span><ReceiptText aria-hidden="true" size={16} /> Recent viewing sessions</span><strong>{sessions.length} SETTLED</strong></div>
        <div className="payments-table">
          {sessions.map(([viewer, stream, watchTime, revenue]) => (
            <article key={viewer}>
              <div><span>SETTLED</span><strong>{stream}</strong><small>{viewer}</small></div>
              <div><span>Watch time</span><strong>{watchTime}</strong><small>Metered session</small></div>
              <div><span>Revenue</span><strong>{revenue}</strong><small>USDC on Arbitrum</small></div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
