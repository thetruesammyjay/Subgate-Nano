import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminToken } from "../../../../../lib/dashboard-auth";
import { getApiUrl } from "../../../../../lib/api-client";

export async function POST() {
  const token = await getAdminToken();
  if (token) {
    await fetch(`${getApiUrl()}/auth/admin/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }).catch(() => null);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}
