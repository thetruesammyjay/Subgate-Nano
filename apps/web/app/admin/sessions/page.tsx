import { AdminSessionsView } from "../../../features/admin/admin-data-views";
import { getAdminToken } from "../../../lib/dashboard-auth";
import { listAdminSessions, loadDashboardData } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminSessionsPage() {
  const token = await getAdminToken();
  if (!token) return null;
  const result = await loadDashboardData(() => listAdminSessions(token));
  return <AdminSessionsView page={result.data} error={result.error} />;
}
