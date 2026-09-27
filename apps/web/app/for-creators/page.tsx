import Link from "next/link";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { Activity, ArrowRight, Clock3, Play, ReceiptText, WalletCards } from "../../components/dashboards/dashboard-icons";

const creatorFeatures = [
  { icon: Play, label: "Publish", title: "A direct home for each stream.", text: "Create recorded-video or livestream listings with a title, description, and access details." },
  { icon: WalletCards, label: "Set access", title: "Pick the model that fits.", text: "Offer a fixed pay-per-view price or set a rate for metered viewing time." },
  { icon: Activity, label: "Review", title: "Keep the money trail legible.", text: "Use session and receipt records to review access activity and settlement status." },
];

export default function ForCreatorsPage() {
  return (
    <main id="top" className="public-page info-page creator-page">
      <SiteHeader />
      <section className="info-hero section-shell creator-hero">
        <div className="info-hero-copy"><p className="eyebrow">FOR CREATORS</p><h1>Make the way in part of the experience.</h1><p className="hero-text">Share premium video and live streams with access terms your audience can understand—without asking every viewer to commit to a monthly subscription.</p><div className="hero-actions"><Link className="button primary" href="/creator/register">Start your creator profile <ArrowRight aria-hidden="true" size={18} /></Link><Link className="button secondary" href="/creator/login">Creator sign in</Link></div><p className="creator-setup-note"><Clock3 aria-hidden="true" size={16} /> Connect a wallet during setup or add it later.</p></div>
        <div className="creator-preview"><div className="creator-preview-top"><span>CREATOR STUDIO / 01</span><span className="studio-pulse"><i aria-hidden="true" /> READY TO CREATE</span></div><div className="creator-preview-art"><div className="preview-disc" /><div className="preview-play"><Play aria-hidden="true" size={25} /></div><span>YOUR NEXT STREAM</span></div><div className="creator-preview-stats"><div><small>ACCESS MODEL</small><strong>YOUR CHOICE</strong></div><div><small>SETTLEMENT</small><strong>USDC · ARBITRUM</strong></div></div><div className="creator-preview-foot"><ReceiptText aria-hidden="true" size={16} /><span>STREAM TERMS SHOWN BEFORE PLAY</span></div></div>
      </section>

      <section className="section-shell creator-benefits"><div className="section-heading"><p className="eyebrow">A SMALL, FOCUSED TOOLKIT</p><h2>Build the stream. Set the door. Share it.</h2></div><div className="creator-feature-grid">{creatorFeatures.map(({ icon: Icon, label, title, text }, index) => <article className={`creator-feature creator-feature-${index + 1}`} key={label}><div className="creator-feature-top"><span>{label}</span><Icon aria-hidden="true" size={22} /></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>

      <section className="creator-bottom-cta"><div><p className="eyebrow">YOUR AUDIENCE, YOUR TERMS</p><h2>Start with a creator account.</h2><p>Set up your profile first. Wallet connection can be added when you’re ready to publish and receive payments.</p></div><Link className="button light-button" href="/creator/register">Create account <ArrowRight aria-hidden="true" size={18} /></Link></section>
      <SiteFooter />
    </main>
  );
}
