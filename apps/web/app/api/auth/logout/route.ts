import { NextResponse } from "next/server";
import {
  DASHBOARD_SESSION_COOKIE,
  getDashboardToken,
} from "../../../../lib/dashboard-auth";
import { getApiUrl } from "../../../../lib/api-client";

export async function POST() {
  const token = await getDashboardToken();
  if (token) {
    await fetch(`${getApiUrl()}/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }).catch(() => null);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(DASHBOARD_SESSION_COOKIE);
  return response;
}
