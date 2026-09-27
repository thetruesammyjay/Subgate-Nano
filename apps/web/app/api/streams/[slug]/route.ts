import { NextResponse } from "next/server";
import { getApiUrl } from "../../../../lib/api-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const response = await fetch(
      `${getApiUrl()}/streams/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "The Subgate API is unavailable." },
      { status: 503 },
    );
  }
}
