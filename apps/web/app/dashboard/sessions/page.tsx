import { CreatorSessionsView } from "../../../features/creator/creator-data-views";
import { getDashboardToken } from "../../../lib/dashboard-auth";
import { listCreatorSessions, loadDashboardData } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function CreatorSessionsPage() {
  const token = await getDashboardToken();
  if (!token) return null;
  const result = await loadDashboardData(() => listCreatorSessions(token));
  return <CreatorSessionsView page={result.data} error={result.error} />;
}
