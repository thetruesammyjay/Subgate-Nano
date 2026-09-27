import { NextResponse } from "next/server";
import { getApiUrl } from "../../../../../lib/api-client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await request.text();

  try {
    const streamResponse = await fetch(
      `${getApiUrl()}/streams/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    const stream = (await streamResponse.json().catch(() => null)) as {
      id?: string;
    } | null;
    if (!streamResponse.ok || !stream?.id) {
      return NextResponse.json(stream, { status: streamResponse.status });
    }

    const paymentSignature = request.headers.get("PAYMENT-SIGNATURE");
    const headers = new Headers({ "content-type": "application/json" });
    if (paymentSignature) headers.set("PAYMENT-SIGNATURE", paymentSignature);
    const response = await fetch(`${getApiUrl()}/streams/${stream.id}/sessions`, {
      method: "POST",
      headers,
      body,
    });
    const payload = await response.json().catch(() => null);
    const result = NextResponse.json(payload, { status: response.status });
    const paymentRequired = response.headers.get("PAYMENT-REQUIRED");
    if (paymentRequired) result.headers.set("PAYMENT-REQUIRED", paymentRequired);
    return result;
  } catch {
    return NextResponse.json(
      { message: "The Subgate API is unavailable." },
      { status: 503 },
    );
  }
}
