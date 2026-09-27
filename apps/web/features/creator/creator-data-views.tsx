import { CircleDollarSign, Clock3, Settings2, UserRound } from "../../components/dashboards/dashboard-icons";
import type { Creator } from "../../types/auth";
import type { CreatorReceipt, CreatorSettings, CreatorWorkspaceSession, DashboardPage } from "../../types/dashboard";
import { DataTable, type DataTableColumn } from "../../components/dashboards/data-table";
import { DashboardDataError, DashboardEmpty, DashboardPageHeader } from "../../components/dashboards/dashboard-data-state";
import { formatDate, formatDuration, formatUsdc, shortenWallet } from "../../lib/dashboard-formatters";

const sessionBadge = (status: string) => `status-badge ${status === "completed" ? "published" : status === "active" ? "pending" : "draft"}`;

export function CreatorSessionsView({ page, error }: { page: DashboardPage<CreatorWorkspaceSession> | null; error: string | null }) {
  const columns: DataTableColumn<CreatorWorkspaceSession>[] = [
    { key: "stream", label: "Stream", render: (row) => <span className="cell-stack"><strong>{row.stream_title}</strong><small>/{row.stream_slug}</small></span> },
    { key: "viewer", label: "Viewer", render: (row) => <span className="mono-value">{shortenWallet(row.viewer_wallet)}</span> },
    { key: "watch", label: "Watch time", render: (row) => formatDuration(row.consumed_seconds) },
    { key: "amount", label: "Settled", render: (row) => formatUsdc(row.settled_atomic) },
    { key: "started", label: "Started", render: (row) => formatDate(row.started_at) },
    { key: "status", label: "State", render: (row) => <span className={sessionBadge(row.status)}>{row.status}</span> },
  ];
  return <div className="dashboard-page">
    <DashboardPageHeader eyebrow="Viewing sessions" title="See the room while it plays." description="Review watch time, accrued charges, and settlement state for sessions across your streams." />
    {error ? <DashboardDataError message={error} /> : null}
    {page ? <section className="panel dashboard-table-panel"><div className="panel-heading"><div><span className="utility-label">{page.total} sessions</span><h2>Viewer activity</h2></div><Clock3 aria-hidden="true" size={19} /></div>
      {page.total ? <DataTable label="Creator viewing sessions" rows={page.items} columns={columns} rowKey={(row) => row.id} /> : <DashboardEmpty title="No sessions yet." description="Viewer activity will appear after someone starts watching one of your streams." />}
    </section> : null}
  </div>;
}

export function CreatorReceiptsView({ page, error }: { page: DashboardPage<CreatorReceipt> | null; error: string | null }) {
  const columns: DataTableColumn<CreatorReceipt>[] = [
    { key: "stream", label: "Stream", render: (row) => <span className="cell-stack"><strong>{row.stream_title}</strong><small>/{row.stream_slug}</small></span> },
    { key: "viewer", label: "Viewer", render: (row) => <span className="mono-value">{shortenWallet(row.viewer_wallet)}</span> },
    { key: "duration", label: "Watch time", render: (row) => formatDuration(row.duration_seconds) },
    { key: "amount", label: "Amount", render: (row) => <strong className="record-amount">{formatUsdc(row.amount_atomic)}</strong> },
    { key: "reference", label: "Transaction", render: (row) => <span className="mono-value mono-break">{row.transaction_reference}</span> },
    { key: "date", label: "Settled", render: (row) => formatDate(row.settled_at) },
  ];
  return <div className="dashboard-page">
    <DashboardPageHeader eyebrow="Settlement receipts" title="A record for every paid minute." description="Each receipt ties a settled amount to its viewing session and transaction reference." />
    {error ? <DashboardDataError message={error} /> : null}
    {page ? <section className="panel dashboard-table-panel"><div className="panel-heading"><div><span className="utility-label">{page.total} receipts</span><h2>Settled payments</h2></div><CircleDollarSign aria-hidden="true" size={19} /></div>
      {page.total ? <DataTable label="Creator settlement receipts" rows={page.items} columns={columns} rowKey={(row) => row.id} /> : <DashboardEmpty title="No receipts yet." description="Completed payments from your streams will appear here." />}
    </section> : null}
  </div>;
}

export function CreatorProfileView({ creator }: { creator: Creator }) {
  const values = [
    ["Display name", creator.display_name],
    ["Username", creator.username ? `@${creator.username}` : "Not set"],
    ["Email", creator.email ?? "Not set"],
    ["Wallet", shortenWallet(creator.wallet_address)],
    ["Member since", formatDate(creator.created_at)],
    ["Social links", Object.values(creator.social_links ?? {}).join(" · ") || "None added"],
  ];
  return <div className="dashboard-page">
    <DashboardPageHeader eyebrow="Creator profile" title="Make the byline yours." description="Your profile details appear alongside your streams and creator identity." />
    <section className="panel settings-panel">
      <div className="panel-heading"><div><span className="utility-label">Public identity</span><h2>Profile details</h2></div><UserRound aria-hidden="true" size={19} /></div>
      <dl className="settings-list">{values.map(([label, value]) => <div className="settings-row" key={label}><dt>{label}</dt><dd className={label === "Wallet" ? "mono-value" : ""}>{value}</dd></div>)}</dl>
      <p className="settings-footnote">Profile editing is available through the API. Wallet linking uses the wallet-signature flow.</p>
    </section>
  </div>;
}

export function CreatorSettingsView({ settings, error }: { settings: CreatorSettings | null; error: string | null }) {
  const values = settings ? [
    ["Default preview", `${settings.default_preview_seconds} seconds`],
    ["Email updates", settings.email_notifications ? "On" : "Off"],
    ["Session alerts", settings.session_notifications ? "On" : "Off"],
    ["Settlement notices", settings.settlement_notifications ? "On" : "Off"],
  ] : [];
  return <div className="dashboard-page">
    <DashboardPageHeader eyebrow="Creator settings" title="Tune the desk." description="Review the saved defaults used across your creator workspace." />
    {error ? <DashboardDataError message={error} /> : null}
    {settings ? <section className="panel settings-panel">
      <div className="panel-heading"><div><span className="utility-label">Workspace preferences</span><h2>Playback and notifications</h2></div><Settings2 aria-hidden="true" size={19} /></div>
      <dl className="settings-list">{values.map(([label, value]) => <div className="settings-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className="settings-footnote">These preferences are saved to your creator account. Editing controls can be added on top of this live data.</p>
    </section> : null}
  </div>;
}
