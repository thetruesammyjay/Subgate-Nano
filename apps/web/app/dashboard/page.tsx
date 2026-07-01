import {
  Activity,
  CircleDollarSign,
  FileText,
  LockKeyhole,
  RadioTower,
  ReceiptText,
  Rows3,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FloatingIcons } from "../../components/floating-icons";
import { LogoutButton } from "../../components/logout-button";
import { SiteHeader } from "../../components/site-header";
import { getDashboardSession } from "../../lib/dashboard-auth";
import { fetchDashboardState } from "../../lib/subgate-api";
import { CreateContentForm } from "./create-content-form";

const formatPricing = (item: Awaited<ReturnType<typeof fetchDashboardState>>["catalog"][number]) => {
  switch (item.pricing.type) {
    case "per_access":
    case "per_citation":
      return `$${item.pricing.priceUsdc.toFixed(6)} USDC`;
    case "per_second":
      return `$${item.pricing.rateUsdc.toFixed(6)} USDC/s`;
    case "timed":
      return `$${item.pricing.priceUsdc.toFixed(6)} USDC`;
  }
};

const formatUsdc = (value: number | null | undefined) => {
  return `$${(value ?? 0).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} USDC`;
};

const formatDate = (value: string | null) => {
  return value ? new Date(value).toLocaleString() : "Pending";
};

const formatAge = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return "No heartbeat";
  }

  if (value < 60) {
    return `${value}s ago`;
  }

  return `${Math.floor(value / 60)}m ${value % 60}s ago`;
};

const shortAddress = (value: string) => {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
};

export default async function DashboardPage() {
  const session = await getDashboardSession();

  if (!session.isAuthenticated) {
    redirect("/login?next=/dashboard");
  }

  const state = await fetchDashboardState();
  const creator = session.creator;
  const stats = state.creatorStats;
  const diagnostics = state.pipelineDiagnostics;
  const performanceByContentId = new Map(
    state.contentPerformance.map((item) => [item.contentId, item]),
  );
  const discourseMappings = state.externalContentMappings.filter(
    (mapping) => mapping.platform === "discourse",
  );
  const rulesByContentId = new Map(
    state.externalAccessRules.reduce<Array<[string, typeof state.externalAccessRules]>>(
      (entries, rule) => {
        if (!rule.contentId) {
          return entries;
        }

        const existing = entries.find(([contentId]) => contentId === rule.contentId);

        if (existing) {
          existing[1].push(rule);
        } else {
          entries.push([rule.contentId, [rule]]);
        }

        return entries;
      },
      [],
    ),
  );

  return (
    <main id="top">
      <SiteHeader />
      <FloatingIcons />

      <section className="dashboard-hero section-shell">
        <div>
          <p className="eyebrow">CREATOR DASHBOARD / PROTECTED WRITES</p>
          <h1>Publish real gated content without exposing internal API credentials.</h1>
          <p className="hero-text">
            This dashboard uses a server-side Next proxy to attach the internal
            service secret before calling `POST /content`.
          </p>
          <div className="dashboard-session-actions">
            <span>Signed in as {creator.displayName}</span>
            <LogoutButton />
          </div>
        </div>

        <div className="dashboard-health-panel">
          <div>
            <span>API</span>
            <strong>{state.error ? "CHECK" : "ONLINE"}</strong>
          </div>
          <div>
            <span>Revenue</span>
            <strong>{formatUsdc(stats?.revenueUsdc).replace(" USDC", "")}</strong>
          </div>
          <div>
            <span>Settled</span>
            <strong>{stats?.settledPaymentCount ?? 0}</strong>
          </div>
          <div>
            <span>Content</span>
            <strong>{stats?.activeContentCount ?? state.catalog.length}</strong>
          </div>
        </div>
      </section>

      {state.error && (
        <section className="section-shell dashboard-alert">
          <ShieldCheck aria-hidden="true" />
          <div>
            <span>Dashboard cannot reach protected API data</span>
            <p>{state.error}</p>
          </div>
        </section>
      )}

      <section className="section-shell dashboard-revenue-grid">
        <article>
          <CircleDollarSign aria-hidden="true" />
          <span>Net Revenue</span>
          <strong>{formatUsdc(stats?.revenueUsdc)}</strong>
          <p>
            Gross {formatUsdc(stats?.grossRevenueUsdc)} minus platform fees.
          </p>
        </article>
        <article>
          <ReceiptText aria-hidden="true" />
          <span>Payments</span>
          <strong>{stats?.settledPaymentCount ?? 0} settled</strong>
          <p>{stats?.paymentCount ?? 0} total payment attempts in the ledger.</p>
        </article>
        <article>
          <ShieldCheck aria-hidden="true" />
          <span>Platform Fees</span>
          <strong>{formatUsdc(stats?.platformFeeUsdc)}</strong>
          <p>Posted fee ledger entries for settled creator payments.</p>
        </article>
        <article>
          <FileText aria-hidden="true" />
          <span>Active Content</span>
          <strong>{stats?.activeContentCount ?? 0}/{stats?.contentCount ?? 0}</strong>
          <p>Items available to readers, Telegram audiences, and agents.</p>
        </article>
      </section>

      <section className="section-shell dashboard-diagnostics-panel">
        <div className="dashboard-panel-heading">
          <span>
            <Activity aria-hidden="true" size={16} /> Payment Pipeline
          </span>
          <strong>
            {diagnostics ? diagnostics.worker.status.toUpperCase() : "UNAVAILABLE"}
          </strong>
        </div>

        {diagnostics ? (
          <div className="diagnostics-grid">
            <article>
              <CircleDollarSign aria-hidden="true" />
              <span>Payments</span>
              <strong>{diagnostics.payments.settled} settled</strong>
              <p>
                {diagnostics.payments.pending} pending /{" "}
                {diagnostics.payments.settling} settling /{" "}
                {diagnostics.payments.failed} failed
              </p>
            </article>
            <article>
              <ReceiptText aria-hidden="true" />
              <span>Fee Ledger</span>
              <strong>{diagnostics.platformFees.posted} posted</strong>
              <p>
                {formatUsdc(diagnostics.platformFees.totalPlatformFeeUsdc)} fees /{" "}
                {diagnostics.platformFees.missingForSettledPayments} missing
              </p>
            </article>
            <article>
              <RadioTower aria-hidden="true" />
              <span>Streaming</span>
              <strong>{diagnostics.streaming.sessions.active} active</strong>
              <p>
                {diagnostics.streaming.sessions.stopping} stopping / pending{" "}
                {formatUsdc(diagnostics.streaming.pendingSettlementUsdc)}
              </p>
            </article>
            <article>
              <ServerCog aria-hidden="true" />
              <span>Worker</span>
              <strong>{diagnostics.worker.status}</strong>
              <p>
                {formatAge(diagnostics.worker.heartbeatAgeSeconds)}
                {diagnostics.worker.heartbeat
                  ? ` / ${diagnostics.worker.heartbeat.tickCount} ticks`
                  : ""}
              </p>
            </article>
          </div>
        ) : (
          <div className="empty-state">
            <span>DIAGNOSTICS UNAVAILABLE</span>
            <strong>Payment pipeline status could not be loaded.</strong>
            <p>Check the API internal diagnostics endpoint and service secret.</p>
          </div>
        )}

        {diagnostics?.worker.message && (
          <p className="dashboard-diagnostics-note">{diagnostics.worker.message}</p>
        )}
      </section>

      <section className="section-shell dashboard-grid">
        <CreateContentForm creators={[creator]} />

        <aside className="dashboard-list-panel">
          <div className="dashboard-panel-heading">
            <span>
              <FileText aria-hidden="true" size={16} /> Live Catalog
            </span>
            <strong>{state.catalog.length} ITEMS</strong>
          </div>

          {state.catalog.length > 0 ? (
            state.catalog.map((item) => (
              <Link
                className="dashboard-content-row"
                href={`/content/${item.slug}`}
                key={item.id}
              >
                <div>
                  <span>
                    {item.pricing.type}
                    {performanceByContentId.get(item.id)
                      ? ` / ${performanceByContentId.get(item.id)?.settledPaymentCount ?? 0} paid`
                      : ""}
                  </span>
                  <strong>{item.title}</strong>
                  <small>{item.summary}</small>
                </div>
                <p>
                  {performanceByContentId.get(item.id)
                    ? formatUsdc(performanceByContentId.get(item.id)?.revenueUsdc)
                    : formatPricing(item)}
                </p>
              </Link>
            ))
          ) : (
            <div className="empty-state">
              <span>NO CATALOG</span>
              <strong>Seed the database or publish your first content item.</strong>
              <p>The dashboard will update after the next server render.</p>
            </div>
          )}
        </aside>
      </section>

      <section className="section-shell dashboard-payments-panel">
        <div className="dashboard-panel-heading">
          <span>
            <ReceiptText aria-hidden="true" size={16} /> Recent Payments
          </span>
          <strong>{state.creatorPayments.length} ROWS</strong>
        </div>

        {state.creatorPayments.length > 0 ? (
          <div className="payments-table">
            {state.creatorPayments.map((payment) => (
              <article key={payment.id}>
                <div>
                  <span>{payment.status}</span>
                  <strong>{payment.contentTitle}</strong>
                  <small>{shortAddress(payment.payerAddress)}</small>
                </div>
                <div>
                  <span>Gross</span>
                  <strong>{formatUsdc(payment.amountUsdc)}</strong>
                  <small>
                    Net {formatUsdc(payment.creatorNetUsdc)} / fee{" "}
                    {formatUsdc(payment.platformFeeUsdc)}
                  </small>
                </div>
                <div>
                  <span>Settled</span>
                  <strong>{formatDate(payment.settledAt)}</strong>
                  <small>{payment.gatewayTransactionId ?? "No transaction id"}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span>NO PAYMENTS YET</span>
            <strong>Publish one paid item and share the unlock link.</strong>
            <p>Settled x402 payments will appear here with payer, amount, and content.</p>
          </div>
        )}
      </section>

      <section className="section-shell dashboard-integration-panel">
        <div className="dashboard-panel-heading">
          <span>
            <Rows3 aria-hidden="true" size={16} /> Imported Discourse Rules
          </span>
          <strong>{discourseMappings.length} TOPICS</strong>
        </div>

        {discourseMappings.length > 0 ? (
          discourseMappings.map((mapping) => {
            const content = state.catalog.find((item) => item.id === mapping.contentId);
            const rules = rulesByContentId.get(mapping.contentId) ?? [];

            return (
              <article className="integration-rule-card" key={mapping.id}>
                <div>
                  <span>{mapping.externalType} / {mapping.externalId}</span>
                  <strong>{content?.title ?? "Imported Discourse topic"}</strong>
                  <small>
                    Last synced {new Date(mapping.lastSyncedAt).toLocaleString()}
                  </small>
                </div>
                <div className="integration-rule-list">
                  {rules.map((rule) => (
                    <p key={rule.id}>
                      <span>{rule.externalType}</span>
                      {rule.name} / {rule.ruleType}
                      {rule.requiredGroups.length > 0
                        ? ` / groups: ${rule.requiredGroups.join(", ")}`
                        : ""}
                    </p>
                  ))}
                </div>
              </article>
            );
          })
        ) : (
          <div className="empty-state">
            <span>NO DISCOURSE IMPORTS</span>
            <strong>Send a Discourse topic webhook to the sidecar.</strong>
            <p>
              Imported topics, category rules, and group rules will appear here
              after `/webhooks/discourse/topic` syncs.
            </p>
          </div>
        )}
      </section>

      <section className="section-shell dashboard-guardrails">
        <article>
          <LockKeyhole aria-hidden="true" />
          <span>API GUARD</span>
          <p>`POST /content` now requires `x-subgate-internal-secret`.</p>
        </article>
        <article>
          <ShieldCheck aria-hidden="true" />
          <span>WEB PROXY</span>
          <p>The browser submits to Next; Next forwards with the server secret.</p>
        </article>
        <article>
          <RadioTower aria-hidden="true" />
          <span>CATALOG</span>
          <p>Published records become visible to readers and paying agents.</p>
        </article>
      </section>
    </main>
  );
}
