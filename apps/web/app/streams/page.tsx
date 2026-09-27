import Link from "next/link";
import { SiteHeader } from "../../components/site-header";
import { StreamGallery } from "../../components/streams/stream-gallery";

export default function StreamsPage() {
  return (
    <main className="public-page">
      <SiteHeader />
      <section className="section-shell streams-hero"><div><p className="eyebrow">PUBLIC STREAM DESK</p><h1>Open a stream. See the price. Press play.</h1><p className="hero-text">A clear directory of creator streams with payment at the edge, not a subscription in the middle.</p></div><Link className="text-link" href="/creator/login">Publish your own stream <span aria-hidden="true">↗</span></Link></section>
      <section className="section-shell stream-directory"><div className="section-heading"><p className="eyebrow">NOW AVAILABLE</p><h2>Streams with a visible door.</h2><p>Every card shows who made it, what it costs, and what happens next.</p></div><StreamGallery /></section>
    </main>
  );
}
