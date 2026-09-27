import { Activity, ArrowUpRight, CircleDollarSign, FileClock, Users } from "../../components/dashboards/dashboard-icons";
import Link from "next/link";
import type { AdminAuditEvent, AdminOverviewData, AdminSettlement, AdminCreatorSummary } from "../../types/dashboard";
import { formatDate, formatUsdc, shortenWallet } from "../../lib/dashboard-formatters";
import { DashboardDataError, DashboardEmpty } from "../../components/dashboards/dashboard-data-state";
import { MetricCard } from "../../components/dashboards/metric-card";

export function AdminOverview({
  overview,
  pendingCreators,
  settlements,
  auditEvents,
  errors,
}: {
  overview: AdminOverviewData | null;
  pendingCreators: AdminCreatorSummary[] | null;
  settlements: AdminSettlement[] | null;
  auditEvents: AdminAuditEvent[] | null;
  errors: string[];
}) {
  if (!overview) {
    return <div className="dashboard-page"><DashboardDataError message={errors[0] ?? "Refresh this page after checking the API."} /></div>;
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div><p className="eyebrow">Platform operations</p><h1>Keep the signal clean.</h1><p className="page-lede">A calm control surface for creators, playback sessions, and settlement health.</p></div>
        <span className="status-badge published">System {overview.health}</span>
      </div>
      {errors.length ? <DashboardDataError message={errors[0]!} /> : null}

      <section className="metric-grid" aria-label="Platform metrics">
        <MetricCard label="Creators" value={overview.creators_total} note={`${overview.creators_pending} awaiting review`} tone="navy" />
        <MetricCard label="Published streams" value={overview.streams_published} note="Available to viewers" />
        <MetricCard label="Active sessions" value={overview.sessions_active} note="Playback sessions in progress" />
        <MetricCard label="Settled" value={formatUsdc(overview.settlements_atomic)} note={`${overview.settlements_count} completed payments`} tone="signal" />
      </section>

      <section className="dashboard-panels dashboard-panels-wide">
        <article className="panel">
          <div className="panel-heading"><div><span className="utility-label">Review queue · {overview.creators_pending}</span><h2>Creator approvals</h2></div><Users aria-hidden="true" size={19} /></div>
          {pendingCreators === null ? <p className="dashboard-inline-error">Creator review data could not be loaded.</p> : pendingCreators.length ? (
            <div className="dashboard-record-list">
              {pendingCreators.slice(0, 5).map((creator) => (
                <Link className="dashboard-record" href="/admin/creators" key={creator.id}>
                  <span className="record-mark"><Users aria-hidden="true" size={16} /></span>
                  <span className="record-main"><strong>{creator.display_name}</strong><small>{creator.email ?? creator.username ?? shortenWallet(creator.wallet_address)}</small></span>
                  <span className="status-badge pending">Pending</span>
                </Link>
              ))}
              <Link className="text-link" href="/admin/creators">Review creator accounts<ArrowUpRight aria-hidden="true" size={15} /></Link>
            </div>
          ) : <DashboardEmpty title="No creators waiting." description="New creator applications will appear here for review." />}
        </article>

        <article className="panel">
          <div className="panel-heading"><div><span className="utility-label">Platform activity</span><h2>Recent movement</h2></div><Activity aria-hidden="true" size={19} /></div>
          {auditEvents === null ? <p className="dashboard-inline-error">Recent activity could not be loaded.</p> : auditEvents.length ? (
            <div className="dashboard-record-list">
              {auditEvents.slice(0, 5).map((event) => (
                <div className="dashboard-record" key={event.id}>
                  <span className="record-mark"><FileClock aria-hidden="true" size={16} /></span>
                  <span className="record-main"><strong>{event.event_type.replace(/\./g, " ")}</strong><small>{event.actor?.email ?? event.entity_type} · {formatDate(event.created_at)}</small></span>
                </div>
              ))}
              <Link className="text-link" href="/admin/audit">Open audit log<ArrowUpRight aria-hidden="true" size={15} /></Link>
            </div>
          ) : <DashboardEmpty title="No admin activity yet." description="Sign-ins and moderation actions will appear here." />}
        </article>
      </section>

      <section className="panel dashboard-latest-panel">
        <div className="panel-heading"><div><span className="utility-label">Settlement rail</span><h2>Latest settled payments</h2></div><CircleDollarSign aria-hidden="true" size={19} /></div>
        {settlements === null ? <p className="dashboard-inline-error">Settlement data could not be loaded.</p> : settlements.length ? (
          <div className="dashboard-record-list dashboard-record-list-wide">
            {settlements.slice(0, 4).map((item) => (
              <div className="dashboard-record" key={item.id}>
                <span className="record-main"><strong>{item.stream_title}</strong><small>{item.creator_name} · {formatDate(item.settled_at)}</small></span>
                <strong className="record-amount">{formatUsdc(item.amount_atomic)}</strong>
                <span className="status-badge published">Settled</span>
              </div>
            ))}
            <Link className="text-link" href="/admin/settlements">View settlement ledger<ArrowUpRight aria-hidden="true" size={15} /></Link>
          </div>
        ) : <DashboardEmpty title="No payments settled yet." description="Completed viewer payments will appear in this ledger." />}
      </section>
    </div>
  );
}
