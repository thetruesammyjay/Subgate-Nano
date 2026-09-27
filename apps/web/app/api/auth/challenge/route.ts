import { NextResponse } from "next/server";
import { getApiUrl } from "../../../../lib/api-client";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.wallet_address !== "string") {
    return NextResponse.json(
      { message: "A wallet address is required." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${getApiUrl()}/auth/challenge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet_address: body.wallet_address }),
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "The Subgate API is unavailable." },
      { status: 503 },
    );
  }
}
