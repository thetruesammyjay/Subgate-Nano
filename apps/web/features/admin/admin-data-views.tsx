import { ArrowUpRight, CircleDollarSign, RadioTower, Settings2, Users } from "../../components/dashboards/dashboard-icons";
import Link from "next/link";
import type {
  AdminAuditEvent,
  AdminCreatorSummary,
  AdminRevenueReport,
  AdminSession,
  AdminSettings,
  AdminSettlement,
  AdminStream,
  DashboardPage,
} from "../../types/dashboard";
import { DataTable, type DataTableColumn } from "../../components/dashboards/data-table";
import { DashboardDataError, DashboardEmpty, DashboardPageHeader } from "../../components/dashboards/dashboard-data-state";
import { MetricCard } from "../../components/dashboards/metric-card";
import { formatDate, formatDuration, formatUsdc, shortenWallet } from "../../lib/dashboard-formatters";

const badgeClass = (status: string) => `status-badge ${status === "approved" || status === "settled" || status === "completed" ? "published" : status === "pending" || status === "active" ? "pending" : status === "rejected" || status === "suspended" || status === "failed" ? "rejected" : "draft"}`;

function LoadError({ error }: { error: string | null }) {
  return error ? <DashboardDataError message={error} /> : null;
}

function EmptyOrTable<Row>({
  page,
  columns,
  label,
  emptyTitle,
  emptyDescription,
  rowKey,
}: {
  page: DashboardPage<Row> | null;
  columns: DataTableColumn<Row>[];
  label: string;
  emptyTitle: string;
  emptyDescription: string;
  rowKey: (row: Row) => string;
}) {
  if (!page) return null;
  if (page.total === 0) return <DashboardEmpty title={emptyTitle} description={emptyDescription} />;
  return <DataTable label={label} rows={page.items} columns={columns} rowKey={rowKey} />;
}

export function AdminCreatorsView({ page, error }: { page: DashboardPage<AdminCreatorSummary> | null; error: string | null }) {
  const columns: DataTableColumn<AdminCreatorSummary>[] = [
    { key: "creator", label: "Creator", render: (row) => <span className="cell-stack"><strong>{row.display_name}</strong><small>{row.email ?? row.username ?? "No email on file"}</small></span> },
    { key: "wallet", label: "Wallet", render: (row) => <span className="mono-value">{shortenWallet(row.wallet_address)}</span> },
    { key: "streams", label: "Streams", render: (row) => row.stream_count },
    { key: "status", label: "Review", render: (row) => <span className={badgeClass(row.approval_status)}>{row.approval_status}</span> },
    { key: "joined", label: "Joined", render: (row) => formatDate(row.created_at) },
  ];
  return <div className="dashboard-page">
    <DashboardPageHeader eyebrow="Creator approvals" title="Know who is publishing." description="Review creator identity, wallet ownership, and publication history." />
    <LoadError error={error} />
    {page ? <section className="panel dashboard-table-panel"><div className="panel-heading"><div><span className="utility-label">{page.total} creator accounts</span><h2>Creator directory</h2></div><Users aria-hidden="true" size={19} /></div><EmptyOrTable page={page} columns={columns} label="Creator accounts" rowKey={(row) => row.id} emptyTitle="No creator accounts yet." emptyDescription="New accounts appear here after registration." /></section> : null}
  </div>;
}

export function AdminStreamsView({ page, error }: { page: DashboardPage<AdminStream> | null; error: string | null }) {
  const columns: DataTableColumn<AdminStream>[] = [
    { key: "stream", label: "Stream", render: (row) => <span className="cell-stack"><Link className="table-primary-link" href={`/streams/${row.slug}`}>{row.title}<ArrowUpRight aria-hidden="true" size={13} /></Link><small>/{row.slug}</small></span> },
    { key: "creator", label: "Creator", render: (row) => <span className="cell-stack"><strong>{row.creator.display_name}</strong><small>{shortenWallet(row.creator.wallet_address)}</small></span> },
    { key: "type", label: "Format", render: (row) => <span className="capitalize-value">{row.stream_type.replace("_", " ")}</span> },
    { key: "playback", label: "Playback source", render: (row) => <a className="mono-value mono-break" href={row.playback_url} target="_blank" rel="noreferrer">{row.playback_url}</a> },
    { key: "status", label: "Visibility", render: (row) => <span className={badgeClass(row.is_published ? "approved" : "unpublished")}>{row.is_published ? "Published" : "Unpublished"}</span> },
  ];
  return <div className="dashboard-page">
    <DashboardPageHeader eyebrow="Stream moderation" title="Keep published streams clear." description="Inspect playback sources, access rules, and creator status across the platform." />
    <LoadError error={error} />
    {page ? <section className="panel dashboard-table-panel"><div className="panel-heading"><div><span className="utility-label">{page.total} streams</span><h2>Stream inventory</h2></div><RadioTower aria-hidden="true" size={19} /></div><EmptyOrTable page={page} columns={columns} label="Platform streams" rowKey={(row) => row.id} emptyTitle="No streams published yet." emptyDescription="Creator streams will appear here for platform review." /></section> : null}
  </div>;
}

export function AdminSessionsView({ page, error }: { page: DashboardPage<AdminSession> | null; error: string | null }) {
  const columns: DataTableColumn<AdminSession>[] = [
    { key: "stream", label: "Stream", render: (row) => <span className="cell-stack"><strong>{row.stream_title}</strong><small>{row.creator_name}</small></span> },
    { key: "viewer", label: "Viewer", render: (row) => <span className="mono-value">{shortenWallet(row.viewer_wallet)}</span> },
    { key: "watch", label: "Watch time", render: (row) => formatDuration(row.consumed_seconds) },
    { key: "accrued", label: "Accrued", render: (row) => formatUsdc(row.accrued_atomic) },
    { key: "heartbeat", label: "Last heartbeat", render: (row) => formatDate(row.last_heartbeat_at) },
    { key: "status", label: "State", render: (row) => <span className={badgeClass(row.status)}>{row.status}</span> },
  ];
  return <div className="dashboard-page">
    <DashboardPageHeader eyebrow="Session monitor" title="Watch the active rail." description="Inspect live sessions, heartbeat freshness, and settled viewing activity." />
    <LoadError error={error} />
    {page ? <section className="panel dashboard-table-panel"><div className="panel-heading"><div><span className="utility-label">{page.total} recorded sessions</span><h2>Viewing sessions</h2></div><RadioTower aria-hidden="true" size={19} /></div><EmptyOrTable page={page} columns={columns} label="Viewing sessions" rowKey={(row) => row.id} emptyTitle="No viewing sessions yet." emptyDescription="Sessions appear when a viewer starts a stream." /></section> : null}
  </div>;
}

export function AdminSettlementsView({ page, error }: { page: DashboardPage<AdminSettlement> | null; error: string | null }) {
  const columns: DataTableColumn<AdminSettlement>[] = [
    { key: "stream", label: "Stream", render: (row) => <span className="cell-stack"><strong>{row.stream_title}</strong><small>{row.creator_name}</small></span> },
    { key: "viewer", label: "Viewer", render: (row) => <span className="mono-value">{shortenWallet(row.viewer_wallet)}</span> },
    { key: "amount", label: "Amount", render: (row) => <strong className="record-amount">{formatUsdc(row.amount_atomic)}</strong> },
    { key: "reference", label: "Transaction reference", render: (row) => <span className="mono-value mono-break">{row.transaction_reference}</span> },
    { key: "date", label: "Settled", render: (row) => formatDate(row.settled_at) },
    { key: "status", label: "Status", render: (row) => <span className={badgeClass(row.status)}>{row.status}</span> },
  ];
  return <div className="dashboard-page">
    <DashboardPageHeader eyebrow="Settlement ledger" title="Follow every payment to done." description="Review settled USDC amounts against their stream, creator, viewer, and transaction reference." />
    <LoadError error={error} />
    {page ? <section className="panel dashboard-table-panel"><div className="panel-heading"><div><span className="utility-label">{page.total} payment records</span><h2>Settlements</h2></div><CircleDollarSign aria-hidden="true" size={19} /></div><EmptyOrTable page={page} columns={columns} label="Settlement records" rowKey={(row) => row.id} emptyTitle="No settlements yet." emptyDescription="Completed payments will appear here with their transaction references." /></section> : null}
  </div>;
}

export function AdminAuditView({ page, error }: { page: DashboardPage<AdminAuditEvent> | null; error: string | null }) {
  const columns: DataTableColumn<AdminAuditEvent>[] = [
    { key: "event", label: "Event", render: (row) => <span className="cell-stack"><strong>{row.event_type.replace(/\./g, " ")}</strong><small>{row.entity_type}{row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ""}</small></span> },
    { key: "actor", label: "Actor", render: (row) => row.actor?.email ?? "System" },
    { key: "details", label: "Details", render: (row) => <span className="cell-stack"><span>{Object.entries(row.details).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") || "—"}</span></span> },
    { key: "date", label: "Recorded", render: (row) => formatDate(row.created_at) },
  ];
  return <div className="dashboard-page">
    <DashboardPageHeader eyebrow="Audit log" title="Make every change legible." description="Admin sign-ins and moderation actions, recorded with actor and timestamp context." />
    <LoadError error={error} />
    {page ? <section className="panel dashboard-table-panel"><div className="panel-heading"><div><span className="utility-label">{page.total} recorded events</span><h2>Recent activity</h2></div><Users aria-hidden="true" size={19} /></div><EmptyOrTable page={page} columns={columns} label="Admin audit events" rowKey={(row) => row.id} emptyTitle="No audit events yet." emptyDescription="Admin sign-ins and moderation changes will appear here." /></section> : null}
  </div>;
}

export function AdminReportsView({ report, error }: { report: AdminRevenueReport | null; error: string | null }) {
  const max = Math.max(1, ...(report?.daily.map((item) => item.amount_atomic) ?? []));
  return <div className="dashboard-page">
    <DashboardPageHeader eyebrow="Operations reports" title="Find the pattern in the signal." description="A rolling view of settlement volume and transaction count." />
    <LoadError error={error} />
    {report ? <>
      <section className="metric-grid" aria-label="Revenue report metrics">
        <MetricCard label="Settled amount" value={formatUsdc(report.totals.amount_atomic)} note={`Last ${report.period_days} days`} tone="navy" />
        <MetricCard label="Payments" value={report.totals.settlements} note="Successful settlement records" />
      </section>
      <section className="panel report-panel">
        <div className="panel-heading"><div><span className="utility-label">Daily totals</span><h2>Settlement activity</h2></div><CircleDollarSign aria-hidden="true" size={19} /></div>
        {report.daily.length ? <div className="report-bars" role="list" aria-label="Daily settlement amounts">
          {report.daily.map((item) => <div className="report-bar-row" role="listitem" key={item.date}>
            <time dateTime={item.date}>{item.date}</time>
            <span className="report-bar-track"><span style={{ width: `${Math.max(2, (item.amount_atomic / max) * 100)}%` }} /></span>
            <strong>{formatUsdc(item.amount_atomic)}</strong>
            <small>{item.settlements} {item.settlements === 1 ? "payment" : "payments"}</small>
          </div>)}
        </div> : <DashboardEmpty title="No settlement activity in this period." description="Revenue totals will appear after a viewer payment completes." />}
      </section>
    </> : null}
  </div>;
}

export function AdminSettingsView({ settings, error }: { settings: AdminSettings | null; error: string | null }) {
  const values: Array<[string, string]> = settings ? [
    ["Settlement mode", settings.settlement_mode],
    ["Payment network", settings.network],
    ["Chain ID", String(settings.chain_id)],
    ["Platform fee", `${settings.platform_fee_percent}%`],
    ["Payment asset", settings.asset || "Not configured"],
    ["Gateway wallet", settings.gateway_wallet_address || "Not configured"],
    ["Facilitator", settings.facilitator_url],
    ["Payment timeout", `${settings.max_timeout_seconds} seconds`],
  ] : [];
  return <div className="dashboard-page">
    <DashboardPageHeader eyebrow="Platform settings" title="Set the guardrails." description="Review the effective network and settlement configuration used by the API." />
    <LoadError error={error} />
    {settings ? <section className="panel settings-panel">
      <div className="panel-heading"><div><span className="utility-label">Runtime configuration</span><h2>Payment rail</h2></div><Settings2 aria-hidden="true" size={19} /></div>
      <dl className="settings-list">{values.map(([label, value]) => <div className="settings-row" key={label}><dt>{label}</dt><dd className={label.includes("wallet") || label.includes("asset") ? "mono-value mono-break" : ""}>{value}</dd></div>)}</dl>
      <p className="settings-footnote">These values are read-only here and come from the API deployment environment. Secret credentials are never returned.</p>
    </section> : null}
  </div>;
}
