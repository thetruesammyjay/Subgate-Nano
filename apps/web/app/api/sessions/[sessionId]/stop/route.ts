import { NextResponse } from "next/server";
import { getApiUrl } from "../../../../../lib/api-client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const paymentSignature = request.headers.get("PAYMENT-SIGNATURE");
  const headers = new Headers({ "content-type": "application/json" });
  if (paymentSignature) headers.set("PAYMENT-SIGNATURE", paymentSignature);
  try {
    const response = await fetch(`${getApiUrl()}/sessions/${sessionId}/stop`, {
      method: "POST",
      headers,
      body: await request.text(),
    });
    const payload = await response.json().catch(() => null);
    const result = NextResponse.json(payload, { status: response.status });
    const paymentRequired = response.headers.get("PAYMENT-REQUIRED");
    if (paymentRequired) result.headers.set("PAYMENT-REQUIRED", paymentRequired);
    return result;
  } catch {
    return NextResponse.json({ message: "The Subgate API is unavailable." }, { status: 503 });
  }
}
