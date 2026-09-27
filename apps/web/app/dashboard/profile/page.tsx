import { CreatorProfileView } from "../../../features/creator/creator-data-views";
import { getDashboardSession } from "../../../lib/dashboard-auth";

export const dynamic = "force-dynamic";

export default async function CreatorProfilePage() {
  const session = await getDashboardSession();
  if (!session.isAuthenticated) return null;
  return <CreatorProfileView creator={session.creator} />;
}
