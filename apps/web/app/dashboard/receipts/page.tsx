import { CreatorReceiptsView } from "../../../features/creator/creator-data-views";
import { getDashboardToken } from "../../../lib/dashboard-auth";
import { listCreatorReceipts, loadDashboardData } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function CreatorReceiptsPage() {
  const token = await getDashboardToken();
  if (!token) return null;
  const result = await loadDashboardData(() => listCreatorReceipts(token));
  return <CreatorReceiptsView page={result.data} error={result.error} />;
}
