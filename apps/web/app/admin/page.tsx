import { AdminOverview } from "../../features/admin/admin-overview";
import { getAdminToken } from "../../lib/dashboard-auth";
import {
  getAdminOverview,
  listAdminAuditEvents,
  listAdminCreators,
  listAdminSettlements,
  loadDashboardData,
} from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const token = await getAdminToken();
  if (!token) return null;
  const [overview, creators, settlements, audit] = await Promise.all([
    loadDashboardData(() => getAdminOverview(token)),
    loadDashboardData(() => listAdminCreators(token, { limit: 5, approvalStatus: "pending" })),
    loadDashboardData(() => listAdminSettlements(token, 5)),
    loadDashboardData(() => listAdminAuditEvents(token, 5)),
  ]);
  return (
    <AdminOverview
      overview={overview.data}
      pendingCreators={creators.data?.items ?? null}
      settlements={settlements.data?.items ?? null}
      auditEvents={audit.data?.items ?? null}
      errors={[overview, creators, settlements, audit].flatMap((result) => result.error ? [result.error] : [])}
    />
  );
}
