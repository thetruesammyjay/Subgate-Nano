"use client";

import { ArrowUpRight, CircleDollarSign, MoreHorizontal, RadioTower } from "../../components/dashboards/dashboard-icons";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CreatorDashboardOverview, CreatorReceipt } from "../../types/dashboard";
import type { Creator } from "../../types/auth";
import type { Stream } from "../../types/stream";
import { DashboardDataError, DashboardEmpty } from "../../components/dashboards/dashboard-data-state";
import { formatDate, formatDuration, formatUsdc } from "../../lib/dashboard-formatters";

const formatPricing = (stream: Stream) => stream.pricing.model === "pay_per_view"
  ? `${formatUsdc(stream.pricing.price_atomic ?? 0)} / access`
  : `${formatUsdc(stream.pricing.rate_atomic_per_minute ?? 0)} / minute`;

type CreatorOverviewProps = {
  creator: Creator;
  initialStreams: Stream[];
  streamsError: string | null;
  overview: CreatorDashboardOverview | null;
  recentReceipts: CreatorReceipt[] | null;
  dataErrors: string[];
};

export function CreatorOverview({ creator, initialStreams, streamsError, overview, recentReceipts, dataErrors }: CreatorOverviewProps) {
  const [streams, setStreams] = useState(initialStreams);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const publishedCount = useMemo(() => overview?.streams_published ?? (streamsError ? null : streams.filter((stream) => stream.is_published).length), [overview, streams, streamsError]);
  const liveCount = useMemo(() => overview?.streams_live ?? (streamsError ? null : streams.filter((stream) => stream.is_published && stream.stream_type === "livestream").length), [overview, streams, streamsError]);

  const unpublish = async (stream: Stream) => {
    setPendingId(stream.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/creator/streams/${stream.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to unpublish this stream.");
      setStreams((current) => current.map((item) => item.id === stream.id ? { ...item, is_published: false } : item));
      setMessage(`${stream.title} is now unpublished.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update this stream.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">CREATOR OVERVIEW</p>
          <h1>Good to see you, {creator.display_name}.</h1>
          <p className="page-lede">Your broadcast desk for access, playback, and settlement.</p>
        </div>
        <Link className="button primary desktop-action" href="/dashboard/streams/new"><RadioTower aria-hidden="true" size={16} /> New stream</Link>
      </div>

      {creator.approval_status !== "approved" ? <div className={`creator-review-note ${creator.approval_status}`} role="status">
        <strong>{creator.approval_status === "pending" ? "Your account is waiting for review." : creator.approval_status === "rejected" ? "Your creator application was not approved." : "Your creator account is suspended."}</strong>
        <span>{creator.approval_status === "pending" ? "You can finish your profile while we review it. Publishing becomes available after approval." : "You can view your workspace, but publishing is currently unavailable."}</span>
      </div> : null}
      {dataErrors.length ? <DashboardDataError message={dataErrors[0]!} /> : null}

      <section className="metric-grid" aria-label="Creator metrics">
        <article className="metric-card metric-card-dark"><span>Live now</span><strong>{liveCount ?? "—"}</strong><small>Published livestreams</small></article>
        <article className="metric-card"><span>Published</span><strong>{publishedCount ?? "—"}</strong><small>{overview ? `Of ${overview.streams_total} total streams` : streamsError ? "Stream totals unavailable" : `Of ${streams.length} total streams`}</small></article>
        <article className="metric-card"><span>Watch time</span><strong>{overview ? formatDuration(overview.watch_seconds) : "—"}</strong><small>{overview ? `${overview.sessions_total} viewer sessions` : "Waiting for session data"}</small></article>
        <article className="metric-card metric-card-signal"><span>Settled revenue</span><strong>{overview ? formatUsdc(overview.settled_atomic) : "—"}</strong><small>Completed creator settlements</small></article>
      </section>

      {message ? <div className="inline-notice" role="status">{message}</div> : null}

      <section className="dashboard-panels dashboard-panels-wide">
        <article className="panel stream-panel">
          <div className="panel-heading"><div><span className="utility-label">Inventory</span><h2>My streams</h2></div><Link href="/dashboard/streams">View all <ArrowUpRight aria-hidden="true" size={15} /></Link></div>
          {streamsError ? <p className="dashboard-inline-error">Stream inventory could not be loaded.</p> : streams.length ? (
            <div className="stream-list">
              {streams.slice(0, 5).map((stream) => (
                <div className="stream-row" key={stream.id}>
                  <div className="stream-row-main"><span className={stream.is_published ? "status-dot live" : "status-dot"} aria-hidden="true" /><div><Link href={`/streams/${stream.slug}`} className="stream-row-title">{stream.title}</Link><span className="stream-row-meta">{stream.stream_type} · {formatPricing(stream)}</span></div></div>
                  <span className={stream.is_published ? "status-badge published" : "status-badge draft"}>{stream.is_published ? "Published" : "Unpublished"}</span>
                  <div className="row-actions"><Link href={`/dashboard/streams/${stream.id}/edit`} aria-label={`Edit ${stream.title}`}><MoreHorizontal size={17} /></Link>{stream.is_published ? <button type="button" disabled={pendingId === stream.id} onClick={() => unpublish(stream)}>{pendingId === stream.id ? "..." : "Unpublish"}</button> : null}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state large-empty"><RadioTower aria-hidden="true" size={24} /><h3>Your first stream starts here.</h3><p>Set a price, add a playback URL, and publish an access point your audience can use.</p><Link className="button secondary" href="/dashboard/streams/new">Create a stream <ArrowUpRight aria-hidden="true" size={15} /></Link></div>
          )}
        </article>

        <article className="panel activity-panel">
          <div className="panel-heading"><div><span className="utility-label">Settlement activity</span><h2>Latest receipts</h2></div><CircleDollarSign aria-hidden="true" size={19} /></div>
          {recentReceipts === null ? <p className="dashboard-inline-error">Receipt data could not be loaded.</p> : recentReceipts.length ? <div className="dashboard-record-list">
            {recentReceipts.slice(0, 4).map((receipt) => <div className="dashboard-record" key={receipt.id}>
              <span className="record-main"><strong>{receipt.stream_title}</strong><small>{formatDate(receipt.settled_at)} · {receipt.transaction_reference}</small></span>
              <strong className="record-amount">{formatUsdc(receipt.amount_atomic)}</strong>
            </div>)}
            <Link className="text-link" href="/dashboard/receipts">Open all receipts<ArrowUpRight aria-hidden="true" size={15} /></Link>
          </div> : <DashboardEmpty title="No receipts yet." description="Paid sessions will land here with amount and transaction reference." href="/dashboard/receipts" action="Open receipts" />}
        </article>
      </section>

      <div className="mobile-primary-action"><Link className="button primary" href="/dashboard/streams/new"><RadioTower aria-hidden="true" size={16} /> New stream</Link></div>
    </div>
  );
}
