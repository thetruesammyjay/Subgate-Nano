import { AdminSettlementsView } from "../../../features/admin/admin-data-views";
import { getAdminToken } from "../../../lib/dashboard-auth";
import { listAdminSettlements, loadDashboardData } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminSettlementsPage() {
  const token = await getAdminToken();
  if (!token) return null;
  const result = await loadDashboardData(() => listAdminSettlements(token));
  return <AdminSettlementsView page={result.data} error={result.error} />;
}
