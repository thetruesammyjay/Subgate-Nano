"use client";

import { ArrowUpRight, Pencil, RadioTower } from "../../components/dashboards/dashboard-icons";
import Link from "next/link";
import { useState } from "react";
import { DashboardDataError, DashboardEmpty, DashboardPageHeader } from "../../components/dashboards/dashboard-data-state";
import { formatUsdc } from "../../lib/dashboard-formatters";
import type { Stream } from "../../types/stream";

export function CreatorStreamList({ initialStreams, loadError }: { initialStreams: Stream[]; loadError: string | null }) {
  const [streams, setStreams] = useState(initialStreams);
  const [message, setMessage] = useState<string | null>(null);

  const unpublish = async (stream: Stream) => {
    setMessage(null);
    const response = await fetch(`/api/creator/streams/${stream.id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("The stream could not be unpublished.");
      return;
    }
    setStreams((current) => current.map((item) => item.id === stream.id ? { ...item, is_published: false } : item));
    setMessage(`${stream.title} is now unpublished.`);
  };

  return (
    <div className="dashboard-page">
      <DashboardPageHeader
        eyebrow="Creator inventory"
        title="My streams"
        description="Set the access rule once. Let each viewing session settle on its own."
        aside={<Link className="button primary desktop-action" href="/dashboard/streams/new"><RadioTower size={16} /> New stream</Link>}
      />
      {loadError ? <DashboardDataError message={loadError} /> : null}
      {message ? <div className="inline-notice" role="status">{message}</div> : null}
      <section className="panel stream-inventory-panel">
        <div className="panel-heading"><div><span className="utility-label">{loadError ? "Inventory unavailable" : `${streams.length} total`}</span><h2>Published access points</h2></div></div>
        {streams.length ? <div className="stream-list stream-list-large">{streams.map((stream) => <div className="stream-row" key={stream.id}>
          <div className="stream-row-main"><span className={stream.is_published ? "status-dot live" : "status-dot"} /><div>
            <Link href={`/streams/${stream.slug}`} className="stream-row-title">{stream.title}</Link>
            <span className="stream-row-meta">{stream.stream_type} · {stream.pricing.model === "pay_per_view" ? `${formatUsdc(stream.pricing.price_atomic ?? 0)} per access` : `${formatUsdc(stream.pricing.rate_atomic_per_minute ?? 0)} per minute`}</span>
          </div></div>
          <span className={stream.is_published ? "status-badge published" : "status-badge draft"}>{stream.is_published ? "Published" : "Unpublished"}</span>
          <div className="row-actions"><Link href={`/dashboard/streams/${stream.id}/edit`}><Pencil size={16} /><span className="sr-only">Edit {stream.title}</span></Link>{stream.is_published ? <button type="button" onClick={() => unpublish(stream)}>Unpublish</button> : <Link href={`/streams/${stream.slug}`}>View <ArrowUpRight size={15} /></Link>}</div>
        </div>)}</div> : !loadError ? <DashboardEmpty title="No streams yet." description="Your first access point can be live in a few fields." href="/dashboard/streams/new" action="Create a stream" /> : null}
      </section>
      <div className="mobile-primary-action"><Link className="button primary" href="/dashboard/streams/new"><RadioTower size={16} /> New stream</Link></div>
    </div>
  );
}
