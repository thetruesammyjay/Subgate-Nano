import { NextResponse } from "next/server";
import {
  DASHBOARD_SESSION_COOKIE,
  getDashboardCookieOptions,
} from "../../../../lib/dashboard-auth";
import { getApiUrl } from "../../../../lib/subgate-api";

export const POST = async (request: Request) => {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    token?: unknown;
  } | null;

  if (typeof body?.email === "string") {
    const response = await fetch(`${getApiUrl()}/auth/creator/magic-link`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: body.email }),
    });
    const payload = await response.json().catch(() => null);

    return NextResponse.json(payload, { status: response.status });
  }

  if (typeof body?.token !== "string") {
    return NextResponse.json(
      {
        message: "Email or magic-link token is required.",
      },
      { status: 400 },
    );
  }

  const sessionResponse = await fetch(`${getApiUrl()}/auth/creator/session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ token: body.token }),
  });
  const session = (await sessionResponse.json().catch(() => null)) as {
    token?: string;
    creator?: unknown;
    message?: string;
  } | null;

  if (!sessionResponse.ok || !session?.token) {
    return NextResponse.json(
      {
        message:
          session?.message ?? "Magic link is invalid, expired, or already used.",
      },
      { status: sessionResponse.status },
    );
  }

  const response = NextResponse.json({
    ok: true,
    creator: session.creator,
  });

  response.cookies.set(
    DASHBOARD_SESSION_COOKIE,
    session.token,
    getDashboardCookieOptions(),
  );

  return response;
};
