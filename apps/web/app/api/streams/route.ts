import { NextResponse } from "next/server";
import { getDashboardToken } from "../../../lib/dashboard-auth";
import { getApiUrl } from "../../../lib/api-client";

export async function GET() {
  try {
    const response = await fetch(`${getApiUrl()}/streams`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "The Subgate API is unavailable." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const token = await getDashboardToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  try {
    const response = await fetch(`${getApiUrl()}/streams`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: await request.text(),
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
