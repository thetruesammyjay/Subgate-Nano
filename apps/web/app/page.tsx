import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  LockKeyhole,
  RadioTower,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { FloatingIcons } from "../components/floating-icons";
import { SiteHeader } from "../components/site-header";

const stats = [
  { label: "Min payment", value: "$0.000001" },
  { label: "Arc target", value: "<500ms" },
  { label: "Currency", value: "USDC" },
];

const flowSteps = [
  { label: "Quote", value: "402 terms issued" },
  { label: "Pay", value: "Gateway signature" },
  { label: "Verify", value: "x402 settle" },
  { label: "Unlock", value: "Access grant" },
];

const dashboardRows = [
  { label: "Arc Settlement Explainer", value: "$0.003", state: "LIVE" },
  { label: "Per-second Stream", value: "$0.001/s", state: "METERED" },
  { label: "Agent Citation Toll", value: "$0.0001", state: "READY" },
];

const agentEvents = [
  { label: "Catalog scanned", value: "4 endpoints" },
  { label: "Budget guard", value: "$0.100000" },
  { label: "Last decision", value: "PAY" },
];

export default function Home() {
  return (
    <main id="top">
      <SiteHeader />
      <FloatingIcons />

      <section className="hero section-shell">
        <div className="hero-copy">
          <p className="eyebrow">ARC TESTNET / X402 / GATEWAY</p>
          <h1>Nanopayments for content that should never have needed a subscription.</h1>
          <p className="hero-text">
            Subgate Nano lets creators, publishers, and AI agents trade exact access
            in USDC: one article, one API call, one second, one citation.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#flow">
              View Flow <ArrowRight aria-hidden="true" size={16} />
            </a>
            <a className="button secondary" href="#dashboard">
              Creator Console
            </a>
          </div>
        </div>

        <div className="hero-instrument" aria-label="Live payment instrument">
          <p className="instrument-label">ACCESS PRICE</p>
          <div className="instrument-value">
            $0.003<span>USDC</span>
          </div>
          <div className="segment-bar" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => (
              <span key={index} className={index < 11 ? "filled" : ""} />
            ))}
          </div>
          <div className="instrument-grid">
            {stats.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="flow" className="section-shell flow-section">
        <div className="section-heading">
          <p className="eyebrow">UNLOCK SEQUENCE</p>
          <h2>Quote to paid access in one clean loop.</h2>
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

      <section id="dashboard" className="section-shell console-section">
        <div className="console-main">
          <p className="eyebrow">CREATOR DASHBOARD</p>
          <h2>Publish, meter, and watch each unlock settle.</h2>
          <div className="status-strip">
            <span>
              <CheckCircle2 aria-hidden="true" size={17} /> Gateway online
            </span>
            <span>
              <Clock3 aria-hidden="true" size={17} /> Batch pending
            </span>
            <span>
              <ShieldCheck aria-hidden="true" size={17} /> Access logged
            </span>
          </div>
        </div>

        <div className="data-panel" aria-label="Content pricing table">
          {dashboardRows.map((row) => (
            <div className="data-row" key={row.label}>
              <div>
                <span>{row.state}</span>
                <strong>{row.label}</strong>
              </div>
              <p>{row.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="agents" className="section-shell agent-section">
        <div className="agent-rail">
          <Bot aria-hidden="true" size={32} />
          <p className="eyebrow">AGENT DEMO</p>
          <h2>Autonomous buyers can inspect terms before they spend.</h2>
        </div>

        <div className="agent-events">
          {agentEvents.map((event) => (
            <div className="agent-event" key={event.label}>
              <span>{event.label}</span>
              <strong>{event.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section-shell roles-section">
        <article>
          <FileText aria-hidden="true" />
          <span>CREATORS</span>
          <p>Gate posts, streams, datasets, and Telegram drops by exact access price.</p>
        </article>
        <article>
          <WalletCards aria-hidden="true" />
          <span>READERS</span>
          <p>Pay once for the thing they want, without subscribing to everything else.</p>
        </article>
        <article>
          <RadioTower aria-hidden="true" />
          <span>AGENTS</span>
          <p>Discover x402 terms, evaluate relevance, settle through Gateway, and cite sources.</p>
        </article>
      </section>

      <footer id="footer" className="site-footer">
        <div>
          <a className="brand footer-brand" href="#top">
            <span className="brand-mark">
              <LockKeyhole aria-hidden="true" size={15} strokeWidth={1.7} />
            </span>
            <span>Subgate Nano</span>
          </a>
          <p>Nanopayment access for creator content and AI agent tools.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#flow">Payment Flow</a>
          <a href="#dashboard">Dashboard</a>
          <a href="#agents">Agent Demo</a>
          <a href="https://www.x402.org/">x402</a>
          <a href="https://developers.circle.com/">Circle Docs</a>
        </nav>
      </footer>
    </main>
  );
}
