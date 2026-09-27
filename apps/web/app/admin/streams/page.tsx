import { AdminStreamsView } from "../../../features/admin/admin-data-views";
import { getAdminToken } from "../../../lib/dashboard-auth";
import { listAdminStreams, loadDashboardData } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminStreamsPage() {
  const token = await getAdminToken();
  if (!token) return null;
  const result = await loadDashboardData(() => listAdminStreams(token));
  return <AdminStreamsView page={result.data} error={result.error} />;
}
