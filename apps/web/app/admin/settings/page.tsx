import { AdminSettingsView } from "../../../features/admin/admin-data-views";
import { getAdminToken } from "../../../lib/dashboard-auth";
import { getAdminSettings, loadDashboardData } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const token = await getAdminToken();
  if (!token) return null;
  const result = await loadDashboardData(() => getAdminSettings(token));
  return <AdminSettingsView settings={result.data} error={result.error} />;
}
