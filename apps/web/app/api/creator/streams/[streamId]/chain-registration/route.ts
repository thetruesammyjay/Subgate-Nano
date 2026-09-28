import { NextResponse } from "next/server";
import { getDashboardToken } from "../../../../../../lib/dashboard-auth";
import { getApiUrl } from "../../../../../../lib/api-client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ streamId: string }> },
) {
  const token = await getDashboardToken();
  if (!token) return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  const { streamId } = await params;
  try {
    const response = await fetch(
      `${getApiUrl()}/creator/streams/${encodeURIComponent(streamId)}/chain-registration`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: await request.text(),
        cache: "no-store",
      },
    );
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ detail: "The Subgate API is unavailable." }, { status: 503 });
  }
}
