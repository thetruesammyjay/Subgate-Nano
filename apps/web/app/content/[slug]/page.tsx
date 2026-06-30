import { ArrowLeft, Bot, FileText, KeyRound, RadioTower } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FloatingIcons } from "../../../components/floating-icons";
import { SiteHeader } from "../../../components/site-header";
import { fetchContentPageState } from "../../../lib/subgate-api";
import { UnlockPanel } from "./unlock-panel";

type ContentPageProps = {
  params: Promise<{ slug: string }>;
};

const formatUsdc = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return "PENDING";
  }

  return `$${value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`;
};

const formatPricing = (state: Awaited<ReturnType<typeof fetchContentPageState>>) => {
  if (!state) {
    return "Unavailable";
  }

  if (state.quote) {
    return `${formatUsdc(state.quote.amountUsdc)} USDC`;
  }

  switch (state.item.pricing.type) {
    case "per_access":
    case "per_citation":
      return `${formatUsdc(state.item.pricing.priceUsdc)} USDC`;
    case "per_second":
      return `${formatUsdc(state.item.pricing.rateUsdc)} USDC/s`;
    case "timed":
      return `${formatUsdc(state.item.pricing.priceUsdc)} USDC`;
  }
};

export default async function ContentPage({ params }: ContentPageProps) {
  const { slug } = await params;
  const state = await fetchContentPageState(slug);

  if (!state) {
    notFound();
  }

  const termsJson = state.paymentRequired
    ? JSON.stringify(state.paymentRequired, null, 2)
    : null;
  const paymentRequiredHeader = state.paymentRequired
    ? Buffer.from(JSON.stringify(state.paymentRequired), "utf8").toString("base64")
    : null;

  return (
    <main id="top">
      <SiteHeader />
      <FloatingIcons />

      <section className="content-detail section-shell">
        <div className="content-copy">
          <Link className="back-link" href="/#dashboard">
            <ArrowLeft aria-hidden="true" size={16} /> Back to catalog
          </Link>
          <p className="eyebrow">GATED CONTENT / {state.item.pricing.type}</p>
          <h1>{state.item.title}</h1>
          <p className="hero-text">{state.item.summary}</p>

          <div className="content-metadata">
            <div>
              <span>Quote</span>
              <strong>{formatPricing(state)}</strong>
            </div>
            <div>
              <span>Terms</span>
              <strong>{state.paymentRequired ? "402 READY" : "UNAVAILABLE"}</strong>
            </div>
            <div>
              <span>API</span>
              <strong>{state.error ? "CHECK" : "ONLINE"}</strong>
            </div>
          </div>

          {state.error && <p className="api-warning">{state.error}</p>}
        </div>

        <UnlockPanel
          slug={state.item.slug}
          initialPaymentRequiredHeader={paymentRequiredHeader}
          initialTermsJson={termsJson}
        />
      </section>

      <section className="section-shell unlock-education">
        <article>
          <FileText aria-hidden="true" />
          <span>1 / TERMS</span>
          <p>The API returns exact x402 requirements for this content item.</p>
        </article>
        <article>
          <KeyRound aria-hidden="true" />
          <span>2 / SIGN</span>
          <p>A Gateway-compatible payer signs those terms outside the browser.</p>
        </article>
        <article>
          <RadioTower aria-hidden="true" />
          <span>3 / SETTLE</span>
          <p>Subgate verifies settlement, records payment, and grants access.</p>
        </article>
        <article>
          <Bot aria-hidden="true" />
          <span>AGENTS</span>
          <p>`apps/agent-demo` can perform the full pay-and-retry loop today.</p>
        </article>
      </section>
    </main>
  );
}
