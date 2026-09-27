import { AdminAuditView } from "../../../features/admin/admin-data-views";
import { getAdminToken } from "../../../lib/dashboard-auth";
import { listAdminAuditEvents, loadDashboardData } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const token = await getAdminToken();
  if (!token) return null;
  const result = await loadDashboardData(() => listAdminAuditEvents(token, 50));
  return <AdminAuditView page={result.data} error={result.error} />;
}
