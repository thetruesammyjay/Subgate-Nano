import Link from "next/link";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { ArrowRight, ArrowUpRight, Check, Clock3, Play, RadioTower, ReceiptText, WalletCards } from "../components/dashboards/dashboard-icons";
import { StreamGallery } from "../components/streams/stream-gallery";

const flowSteps = [
  { number: "01", title: "Find your stream", text: "See the creator, access model, and price before you connect." },
  { number: "02", title: "Unlock access", text: "Use a wallet payment to open a video or start a metered session." },
  { number: "03", title: "Watch your way", text: "Follow the session as watch time and spending stay visible." },
  { number: "04", title: "Leave with a record", text: "End the session when you’re done, with a receipt for the activity." },
];

export default function Home() {
  return (
    <main id="top" className="public-page home-page">
      <SiteHeader />

      <section className="hero section-shell home-hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-spark" aria-hidden="true" /> ARBITRUM / USDC / STREAMING</p>
          <h1>Stay for the stream. Not another subscription.</h1>
          <p className="hero-text">Subgate gives creators a clear way to charge for premium video and live streams—and gives viewers a clear way to pay only for access they choose.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/streams">Explore streams <ArrowRight aria-hidden="true" size={18} /></Link>
            <Link className="button secondary" href="/how-it-works">See how it works <ArrowUpRight aria-hidden="true" size={17} /></Link>
          </div>
          <div className="hero-note"><Check aria-hidden="true" size={17} /><span>Price and access terms stay visible before you press play.</span></div>
        </div>

        <div className="hero-art" role="img" aria-label="Illustration of an example stream with a visible usage receipt">
          <div className="art-orbit art-orbit-one" aria-hidden="true" />
          <div className="art-orbit art-orbit-two" aria-hidden="true" />
          <div className="art-sticker sticker-live"><i aria-hidden="true" /> SESSION EXAMPLE <span>01</span></div>
          <div className="art-sticker sticker-rate">0.01 <small>USDC / MIN</small></div>
          <div className="signal-window">
            <div className="signal-window-top"><span>SUBGATE / SAMPLE PLAYER</span><span>00:14:32</span></div>
            <div className="signal-scene">
              <div className="scene-sun" />
              <div className="scene-ridge ridge-back" />
              <div className="scene-ridge ridge-front" />
              <div className="scene-play"><Play aria-hidden="true" size={25} /></div>
              <div className="scene-wave" aria-hidden="true">{Array.from({ length: 27 }, (_, index) => <i key={index} />)}</div>
            </div>
            <div className="signal-window-bottom"><span>THE LONG WAY HOME</span><span>PREVIEW ENDED</span></div>
          </div>
          <div className="receipt-float">
            <span className="receipt-icon"><ReceiptText aria-hidden="true" size={19} /></span>
            <span className="receipt-copy"><small>EXAMPLE RECEIPT</small><strong>0.145 USDC</strong></span>
            <span className="receipt-status"><i aria-hidden="true" /> READY</span>
          </div>
          <span className="art-caption">A little more signal. A lot less guesswork.</span>
        </div>
      </section>

      <section className="signal-strip" aria-label="Subgate features">
        <div><span>01</span> PAY PER VIEW</div><i aria-hidden="true" />
        <div><span>02</span> METERED WATCHING</div><i aria-hidden="true" />
        <div><span>03</span> USDC ON ARBITRUM</div><i aria-hidden="true" />
        <div><span>04</span> CLEAR SESSION RECEIPTS</div>
      </section>

      <section id="flow" className="section-shell flow-section home-flow">
        <div className="section-heading section-heading-row">
          <div><p className="eyebrow">A CLEANER VIEWING FLOW</p><h2>Know the terms. Then press play.</h2><p>Access should feel like part of watching—not a maze you have to get through first.</p></div>
          <Link className="text-link" href="/how-it-works">Walk through the model <ArrowUpRight aria-hidden="true" size={16} /></Link>
        </div>
        <div className="flow-grid home-flow-grid">
          {flowSteps.map((step, index) => (
            <article className="flow-step home-flow-step" key={step.number}>
              <span>{step.number}</span>
              {index === 0 ? <RadioTower aria-hidden="true" size={21} /> : index === 1 ? <WalletCards aria-hidden="true" size={21} /> : index === 2 ? <Clock3 aria-hidden="true" size={21} /> : <ReceiptText aria-hidden="true" size={21} />}
              <strong>{step.title}</strong><p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="streams" className="section-shell home-streams">
        <div className="section-heading section-heading-row">
          <div><p className="eyebrow">THE STREAM DIRECTORY</p><h2>Find something worth your time.</h2><p>Each stream shows its format and access price before it asks for your wallet.</p></div>
          <Link className="text-link" href="/streams">Browse all streams <ArrowUpRight aria-hidden="true" size={16} /></Link>
        </div>
        <StreamGallery />
      </section>

      <section className="section-shell model-section">
        <div className="model-intro"><p className="eyebrow">TWO WAYS TO OPEN A STREAM</p><h2>Access that fits the content.</h2><p>Creators choose the access model that makes sense for each stream. Viewers see the terms up front.</p><Link className="text-link" href="/payments">Compare access models <ArrowUpRight aria-hidden="true" size={16} /></Link></div>
        <div className="model-cards">
          <article className="model-card model-card-once"><span className="model-number">01 / FIXED ACCESS</span><div className="model-icon"><Play aria-hidden="true" size={20} /></div><h3>Pay per view</h3><p>One clear price for a video, event, or other creator-defined access window.</p><span className="model-foot">ONE PRICE · ONE UNLOCK</span></article>
          <article className="model-card model-card-meter"><span className="model-number">02 / WATCH TIME</span><div className="model-icon"><Clock3 aria-hidden="true" size={20} /></div><h3>Pay as you watch</h3><p>A metered rate tracks the session, so the cost follows validated viewing time.</p><span className="model-foot">VISIBLE RATE · SESSION RECEIPT</span></article>
        </div>
      </section>

      <section className="creator-callout">
        <div className="callout-art" aria-hidden="true"><div className="callout-disc disc-one" /><div className="callout-disc disc-two" /><div className="callout-line" /></div>
        <div className="callout-content"><p className="eyebrow">YOUR WORK, YOUR ACCESS MODEL</p><h2>Give your audience a better way in.</h2><p>Set up a creator profile, choose how each stream is accessed, and share a direct link with your audience.</p><div className="callout-actions"><Link className="button light-button" href="/creator/register">Create your creator account <ArrowRight aria-hidden="true" size={18} /></Link><Link className="callout-link" href="/for-creators">Meet the creator tools <ArrowUpRight aria-hidden="true" size={16} /></Link></div></div>
      </section>

      <SiteFooter />
    </main>
  );
}
