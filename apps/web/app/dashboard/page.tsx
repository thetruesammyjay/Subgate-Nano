import { CreatorOverview } from "../../features/creator/creator-overview";
import { getDashboardSession } from "../../lib/dashboard-auth";
import {
  getCreatorOverview,
  listCreatorReceipts,
  listCreatorStreamsForDashboard,
  loadDashboardData,
} from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getDashboardSession();
  if (!session.isAuthenticated) return null;
  const [overview, streams, receipts] = await Promise.all([
    loadDashboardData(() => getCreatorOverview(session.token)),
    loadDashboardData(() => listCreatorStreamsForDashboard(session.token)),
    loadDashboardData(() => listCreatorReceipts(session.token, 5)),
  ]);
  return <CreatorOverview
    creator={session.creator}
    initialStreams={streams.data ?? []}
    streamsError={streams.error}
    overview={overview.data}
    recentReceipts={receipts.data?.items ?? null}
    dataErrors={[overview.error, streams.error, receipts.error].filter((error): error is string => Boolean(error))}
  />;
}
