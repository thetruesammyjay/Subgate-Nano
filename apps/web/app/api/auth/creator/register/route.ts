import { NextResponse } from "next/server";
import { CREATOR_SESSION_COOKIE, getDashboardCookieOptions } from "../../../../../lib/dashboard-auth";
import { getApiUrl } from "../../../../../lib/api-client";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string" || typeof body.username !== "string") {
    return NextResponse.json({ message: "Email, password, and username are required." }, { status: 400 });
  }
  try {
    const response = await fetch(`${getApiUrl()}/auth/creator/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.access_token) return NextResponse.json(payload, { status: response.status });
    const result = NextResponse.json({ creator: payload.creator, expires_at: payload.expires_at }, { status: 201 });
    result.cookies.set(CREATOR_SESSION_COOKIE, payload.access_token, getDashboardCookieOptions());
    return result;
  } catch {
    return NextResponse.json({ message: "The Subgate API is unavailable." }, { status: 503 });
  }
}
