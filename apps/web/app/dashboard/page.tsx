import { FileText, LockKeyhole, RadioTower, Rows3, ShieldCheck } from "lucide-react";
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

export default async function DashboardPage() {
  const session = await getDashboardSession();

  if (!session.isAuthenticated) {
    redirect("/login?next=/dashboard");
  }

  const state = await fetchDashboardState();
  const creator = session.creator;
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
            <span>Creators</span>
            <strong>{state.creators.length}</strong>
          </div>
          <div>
            <span>Catalog</span>
            <strong>{state.catalog.length}</strong>
          </div>
          <div>
            <span>Rules</span>
            <strong>{state.externalAccessRules.length}</strong>
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
                  <span>{item.pricing.type}</span>
                  <strong>{item.title}</strong>
                  <small>{item.summary}</small>
                </div>
                <p>{formatPricing(item)}</p>
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
