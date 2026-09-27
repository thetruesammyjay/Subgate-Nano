import { NextResponse } from "next/server";
import {
  DASHBOARD_SESSION_COOKIE,
  getDashboardCookieOptions,
} from "../../../../lib/dashboard-auth";
import { getApiUrl } from "../../../../lib/api-client";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.challenge_id !== "string" ||
    typeof body.wallet_address !== "string" ||
    typeof body.signature !== "string"
  ) {
    return NextResponse.json(
      { message: "Challenge, wallet address, and signature are required." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${getApiUrl()}/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        challenge_id: body.challenge_id,
        wallet_address: body.wallet_address,
        signature: body.signature,
        display_name:
          typeof body.display_name === "string" ? body.display_name : undefined,
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      access_token?: string;
      creator?: unknown;
      expires_at?: string;
      message?: string;
    } | null;

    if (!response.ok || !payload?.access_token) {
      return NextResponse.json(payload, { status: response.status });
    }

    const result = NextResponse.json({
      creator: payload.creator,
      expires_at: payload.expires_at,
    });
    result.cookies.set(
      DASHBOARD_SESSION_COOKIE,
      payload.access_token,
      getDashboardCookieOptions(),
    );
    return result;
  } catch {
    return NextResponse.json(
      { message: "The Subgate API is unavailable." },
      { status: 503 },
    );
  }
}
