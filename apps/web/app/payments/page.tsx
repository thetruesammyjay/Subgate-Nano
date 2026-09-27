import Link from "next/link";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { ArrowRight, Clock3, Play, ReceiptText, WalletCards } from "../../components/dashboards/dashboard-icons";

export default function PaymentsPage() {
  return (
    <main id="top" className="public-page info-page payments-page">
      <SiteHeader />
      <section className="info-hero section-shell payments-hero">
        <div className="info-hero-copy"><p className="eyebrow">ACCESS & PAYMENTS</p><h1>Pay for the stream, not the feeling of being locked in.</h1><p className="hero-text">Creators choose a price model for each stream. Viewers can see that model before opening access, with USDC on Arbitrum as Subgate’s intended payment rail.</p><div className="hero-actions"><Link className="button primary" href="/streams">Explore stream access <ArrowRight aria-hidden="true" size={18} /></Link><Link className="button secondary" href="/how-it-works">How it works</Link></div></div>
        <div className="payment-stamp"><span>THE SUBGATE PROMISE</span><strong>Clear terms<br />before play.</strong><div><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></div><small>USDC / ARBITRUM</small></div>
      </section>

      <section className="section-shell payment-model-section"><div className="section-heading"><p className="eyebrow">CHOOSE THE SHAPE OF ACCESS</p><h2>One-time unlock or metered viewing.</h2><p>The creator configures each listing; the stream page shows the terms before a viewer pays.</p></div><div className="payment-model-grid"><article className="payment-model-card payment-fixed"><div className="payment-model-icon"><Play aria-hidden="true" size={22} /></div><span className="model-number">01 / PAY PER VIEW</span><h3>A single price to unlock.</h3><p>Pay once for a creator-defined video or event access. The amount is shown before the unlock step.</p><div className="payment-example"><span>EXAMPLE LISTING</span><strong>0.50 USDC <small>per access</small></strong></div></article><article className="payment-model-card payment-metered"><div className="payment-model-icon"><Clock3 aria-hidden="true" size={22} /></div><span className="model-number">02 / METERED</span><h3>A rate tied to watch time.</h3><p>For streams using metered access, session cost follows validated viewing time at the displayed rate.</p><div className="payment-example"><span>EXAMPLE RATE</span><strong>0.01 USDC <small>per minute</small></strong></div></article></div><p className="payment-disclaimer"><ReceiptText aria-hidden="true" size={17} /> Examples are illustrative. Actual stream prices and availability are set by creators and shown on each listing.</p></section>

      <section className="section-shell payment-rail"><div><p className="eyebrow">A VISIBLE PAYMENT RAIL</p><h2>Wallet-native, with a record you can review.</h2><p>Subgate is designed for USDC payments on Arbitrum. Session records are intended to make access duration, spend, and settlement status easier to inspect.</p></div><div className="payment-rail-mark"><WalletCards aria-hidden="true" size={27} /><span>USDC</span><i aria-hidden="true" /><strong>ARBITRUM</strong></div></section>
      <SiteFooter />
    </main>
  );
}
