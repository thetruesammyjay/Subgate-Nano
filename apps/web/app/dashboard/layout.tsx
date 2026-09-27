import { redirect } from "next/navigation";
import { CreatorSidebar } from "../../features/creator/creator-sidebar";
import { getDashboardSession } from "../../lib/dashboard-auth";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getDashboardSession();
  if (!session.isAuthenticated) {
    redirect("/creator/login?next=/dashboard");
  }

  return <CreatorSidebar creator={session.creator}>{children}</CreatorSidebar>;
}
