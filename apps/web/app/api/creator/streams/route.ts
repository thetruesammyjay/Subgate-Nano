import { NextResponse } from "next/server";
import { getDashboardToken } from "../../../../lib/dashboard-auth";
import { getApiUrl } from "../../../../lib/api-client";

export async function GET() {
  const token = await getDashboardToken();
  if (!token) return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  try {
    const response = await fetch(`${getApiUrl()}/creator/streams`, {
      cache: "no-store",
      headers: { authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ message: "The Subgate API is unavailable." }, { status: 503 });
  }
}
