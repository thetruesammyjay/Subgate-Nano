import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "../../features/admin/admin-sidebar";
import { getAdminSession } from "../../lib/dashboard-auth";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const requestPath = requestHeaders.get("next-url") ?? requestHeaders.get("x-invoke-path") ?? "";
  if (requestHeaders.get("x-subgate-public-auth") === "1" || requestPath === "/admin/login" || requestPath.startsWith("/admin/login?")) return children;
  const session = await getAdminSession();
  if (!session.isAuthenticated) redirect("/admin/login?next=/admin");
  return <AdminSidebar admin={session.admin}>{children}</AdminSidebar>;
}
