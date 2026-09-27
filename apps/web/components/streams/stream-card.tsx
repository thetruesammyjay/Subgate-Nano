import Link from "next/link";
import { ArrowUpRight, Clock3, Play, RadioTower } from "../dashboards/dashboard-icons";
import type { Stream } from "../../types/stream";

const formatUsdc = (atomic: number) => `${(atomic / 1_000_000).toFixed(4)} USDC`;

export function StreamCard({ stream }: { stream: Stream }) {
  const pricing = stream.pricing.model === "pay_per_view"
    ? `${formatUsdc(stream.pricing.price_atomic ?? 0)} per access`
    : `${formatUsdc(stream.pricing.rate_atomic_per_minute ?? 0)} per minute`;
  return (
    <article className="public-stream-card">
      <div className="stream-card-art"><span className="stream-card-art-mark">{stream.stream_type === "livestream" ? <RadioTower size={25} /> : <Play size={25} />}</span><span className="status-badge published">{stream.stream_type === "livestream" ? "Live format" : "On demand"}</span></div>
      <div className="public-stream-card-body"><div className="public-stream-card-meta"><span>{stream.creator_display_name}</span><span><Clock3 size={13} /> {stream.free_preview_seconds ? `${stream.free_preview_seconds}s preview` : "No preview"}</span></div><h3>{stream.title}</h3><p>{stream.description || "A focused Subgate viewing experience."}</p><div className="public-stream-card-footer"><strong>{pricing}</strong><Link href={`/streams/${stream.slug}`} aria-label={`Open ${stream.title}`}>Open <ArrowUpRight size={15} /></Link></div></div>
    </article>
  );
}
