import { AdminCreatorsView } from "../../../features/admin/admin-data-views";
import { getAdminToken } from "../../../lib/dashboard-auth";
import { listAdminCreators, loadDashboardData } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminCreatorsPage() {
  const token = await getAdminToken();
  if (!token) return null;
  const result = await loadDashboardData(() => listAdminCreators(token));
  return <AdminCreatorsView page={result.data} error={result.error} />;
}
