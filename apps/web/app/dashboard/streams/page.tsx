import { CreatorStreamList } from "../../../features/creator/creator-stream-list";
import { getDashboardSession } from "../../../lib/dashboard-auth";
import { listCreatorStreamsForDashboard, loadDashboardData } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function CreatorStreamsPage() {
  const session = await getDashboardSession();
  if (!session.isAuthenticated) return null;
  const result = await loadDashboardData(() => listCreatorStreamsForDashboard(session.token));
  return <CreatorStreamList initialStreams={result.data ?? []} loadError={result.error} />;
}
