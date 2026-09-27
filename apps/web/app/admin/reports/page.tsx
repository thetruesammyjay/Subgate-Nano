import { AdminReportsView } from "../../../features/admin/admin-data-views";
import { getAdminToken } from "../../../lib/dashboard-auth";
import { getAdminRevenueReport, loadDashboardData } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const token = await getAdminToken();
  if (!token) return null;
  const result = await loadDashboardData(() => getAdminRevenueReport(token));
  return <AdminReportsView report={result.data} error={result.error} />;
}
