import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE } from "../../../../lib/dashboard-auth";
import { getApiUrl } from "../../../../lib/subgate-api";

export const POST = async (request: Request) => {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${DASHBOARD_SESSION_COOKIE}=`))
    ?.slice(DASHBOARD_SESSION_COOKIE.length + 1);

  if (token) {
    await fetch(`${getApiUrl()}/auth/creator/logout`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${decodeURIComponent(token)}`,
      },
    }).catch(() => null);
  }

  const response = NextResponse.json({
    ok: true,
  });

  response.cookies.delete(DASHBOARD_SESSION_COOKIE);

  return response;
};
