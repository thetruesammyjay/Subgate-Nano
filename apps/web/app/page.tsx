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
import Link from "next/link";
import { FloatingIcons } from "../components/floating-icons";
import { SiteHeader } from "../components/site-header";
import { fetchHomeApiState, type CatalogContentState } from "../lib/subgate-api";

const formatUsdc = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return "PENDING";
  }

  return `$${value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`;
};

const formatPricingLabel = ({ item, quote }: CatalogContentState) => {
  if (quote) {
    return `${formatUsdc(quote.amountUsdc)} USDC`;
  }

  switch (item.pricing.type) {
    case "per_access":
    case "per_citation":
      return `${formatUsdc(item.pricing.priceUsdc)} USDC`;
    case "per_second":
      return `${formatUsdc(item.pricing.rateUsdc)} USDC/s`;
    case "timed":
      return `${formatUsdc(item.pricing.priceUsdc)} USDC`;
  }
};

const getUnlockState = (state: CatalogContentState) => {
  if (state.paymentRequired) {
    return "402 READY";
  }

  if (state.error) {
    return "CHECK API";
  }

  return "LIVE";
};

const flowSteps = [
  { label: "Quote", value: "GET /content/:slug/quote" },
  { label: "Pay", value: "GatewayClient signature" },
  { label: "Verify", value: "Gateway x402 settle" },
  { label: "Unlock", value: "Access grant persisted" },
];

export default async function Home() {
  const apiState = await fetchHomeApiState();
  const primaryContent = apiState.catalog[0] ?? null;
  const heroPrice = primaryContent
    ? formatPricingLabel(primaryContent)
    : "API OFFLINE";
  const readyCount = apiState.catalog.filter((state) => state.paymentRequired).length;

  const stats = [
    { label: "Catalog items", value: String(apiState.catalog.length) },
    { label: "402 terms", value: String(readyCount) },
    { label: "API", value: apiState.isOnline ? "ONLINE" : "OFFLINE" },
  ];

  const agentEvents = [
    { label: "Catalog scanned", value: `${apiState.catalog.length} endpoints` },
    { label: "Gateway terms", value: `${readyCount} ready` },
    {
      label: "Last decision",
      value: apiState.isOnline && readyCount > 0 ? "READY" : "WAIT",
    },
  ];

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
              Live Catalog
            </a>
          </div>
        </div>

        <div className="hero-instrument" aria-label="Live payment instrument">
          <p className="instrument-label">LIVE ACCESS PRICE</p>
          <div className="instrument-value">
            {heroPrice}
            <span>{primaryContent?.item.pricing.type ?? "USDC"}</span>
          </div>
          <div className="segment-bar" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => (
              <span key={index} className={index < readyCount * 6 ? "filled" : ""} />
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
          {!apiState.isOnline && (
            <p className="api-warning">
              API unavailable at {apiState.apiUrl}. Start `@subgate/api` to load
              catalog, quote, and unlock states.
            </p>
          )}
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
          <p className="eyebrow">LIVE CATALOG</p>
          <h2>Catalog, quotes, and x402 unlock state from the API.</h2>
          <div className="status-strip">
            <span>
              <CheckCircle2 aria-hidden="true" size={17} />{" "}
              {apiState.isOnline ? "API online" : "API offline"}
            </span>
            <span>
              <Clock3 aria-hidden="true" size={17} /> Revalidates every 15s
            </span>
            <span>
              <ShieldCheck aria-hidden="true" size={17} /> Payment terms decoded
            </span>
          </div>
        </div>

        <div className="data-panel" aria-label="Content pricing table">
          {apiState.catalog.length > 0 ? (
            apiState.catalog.map((state) => (
              <Link
                className="data-row data-row-link"
                href={`/content/${state.item.slug}`}
                key={state.item.id}
              >
                <div>
                  <span>{getUnlockState(state)}</span>
                  <strong>{state.item.title}</strong>
                  <small>{state.item.summary}</small>
                </div>
                <p>{formatPricingLabel(state)}</p>
              </Link>
            ))
          ) : (
            <div className="empty-state">
              <span>NO LIVE CATALOG</span>
              <strong>Seed the database and start the API.</strong>
              <p>{apiState.error ?? "No content records were returned."}</p>
            </div>
          )}
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
          <a href="#dashboard">Live Catalog</a>
          <a href="#agents">Agent Demo</a>
          <a href="https://www.x402.org/">x402</a>
          <a href="https://developers.circle.com/">Circle Docs</a>
        </nav>
      </footer>
    </main>
  );
}
