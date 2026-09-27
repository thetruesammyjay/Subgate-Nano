import Link from "next/link";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { ArrowRight, Check, Clock3, Play, ReceiptText, WalletCards } from "../../components/dashboards/dashboard-icons";

const steps = [
  { icon: Play, number: "01", title: "Choose a stream", text: "Browse public listings. Each one shows its creator, format, and access model before you enter." },
  { icon: WalletCards, number: "02", title: "Review the price", text: "For fixed access, see the amount before unlocking. For metered access, see the rate before starting." },
  { icon: Clock3, number: "03", title: "Watch with the meter in view", text: "A viewing session tracks its status and, for metered streams, the time used." },
  { icon: ReceiptText, number: "04", title: "Stop when you’re done", text: "End a metered session when you leave. A session record makes the access and amount easy to review." },
];

export default function HowItWorksPage() {
  return (
    <main id="top" className="public-page info-page how-page">
      <SiteHeader />
      <section className="info-hero section-shell">
        <div className="info-hero-copy"><p className="eyebrow">HOW SUBGATE WORKS</p><h1>Access is clear before the stream begins.</h1><p className="hero-text">Subgate puts the price and access rule at the edge of the video—so viewers can choose with context, and creators can offer more than a monthly plan.</p><div className="hero-actions"><Link className="button primary" href="/streams">Find a stream <ArrowRight aria-hidden="true" size={18} /></Link><Link className="button secondary" href="/payments">Compare payment models</Link></div></div>
        <div className="info-hero-card how-hero-card"><div className="mini-receipt-head"><span>VIEWING SESSION</span><span className="receipt-status"><i aria-hidden="true" /> ACTIVE</span></div><div className="mini-session-time">14<span>m</span> 32<span>s</span></div><div className="meter-track" aria-hidden="true"><i /></div><div className="mini-receipt-row"><span>RATE</span><strong>0.01 USDC / MIN</strong></div><div className="mini-receipt-row"><span>ACCESS</span><strong>CREATOR SET</strong></div><div className="mini-receipt-total"><span>SESSION SPEND</span><strong>0.145 <small>USDC</small></strong></div><p>Illustrative metered session</p></div>
      </section>

      <section className="section-shell info-steps-section"><div className="section-heading"><p className="eyebrow">FROM DISCOVERY TO RECEIPT</p><h2>Four simple parts. No surprise subscription.</h2><p>The exact access terms depend on the stream. The flow stays easy to follow.</p></div><div className="info-step-list">{steps.map(({ icon: Icon, number, title, text }) => <article className="info-step" key={number}><div className="info-step-icon"><Icon aria-hidden="true" size={21} /></div><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>

      <section className="section-shell note-band"><span className="note-check"><Check aria-hidden="true" size={20} /></span><div><p className="eyebrow">BUILT FOR INTENTIONAL ACCESS</p><h2>One stream at a time. Terms in plain sight.</h2><p>Subgate is focused on premium recorded video and live streams, with USDC payments on Arbitrum as the product’s intended payment rail.</p></div></section>
      <SiteFooter />
    </main>
  );
}
