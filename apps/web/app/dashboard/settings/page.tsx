import { CreatorSettingsView } from "../../../features/creator/creator-data-views";
import { getDashboardToken } from "../../../lib/dashboard-auth";
import { getCreatorSettings, loadDashboardData } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function CreatorSettingsPage() {
  const token = await getDashboardToken();
  if (!token) return null;
  const result = await loadDashboardData(() => getCreatorSettings(token));
  return <CreatorSettingsView settings={result.data} error={result.error} />;
}
