import { StreamForm } from "../../../../features/creator/stream-form";
import { getDashboardSession } from "../../../../lib/dashboard-auth";

export const dynamic = "force-dynamic";

export default async function NewStreamPage() {
  const session = await getDashboardSession();
  if (!session.isAuthenticated) return null;
  return <StreamForm creator={session.creator} />;
}
