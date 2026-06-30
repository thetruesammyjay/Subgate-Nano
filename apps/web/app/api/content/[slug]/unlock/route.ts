import { NextResponse } from "next/server";
import type { ContentUnlock, X402PaymentRequired } from "@subgate/types";
import { getApiUrl } from "../../../../../lib/subgate-api";

const PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED";
const PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE";
const PAYMENT_SIGNATURE_HEADER = "PAYMENT-SIGNATURE";

const decodeBase64Json = <T>(value: string): T => {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T;
};

const forwardUnlockRequest = async (
  slug: string,
  paymentSignature?: string,
): Promise<NextResponse> => {
  const headers = new Headers();

  if (paymentSignature) {
    headers.set(PAYMENT_SIGNATURE_HEADER, paymentSignature);
  }

  const response = await fetch(`${getApiUrl()}/content/${encodeURIComponent(slug)}`, {
    cache: "no-store",
    headers,
  });

  if (response.status === 402) {
    const paymentRequiredHeader = response.headers.get(PAYMENT_REQUIRED_HEADER);

    if (!paymentRequiredHeader) {
      return NextResponse.json(
        {
          status: "error",
          message: "The API returned 402 without PAYMENT-REQUIRED terms.",
        },
        { status: 502 },
      );
    }

    const paymentRequired =
      decodeBase64Json<X402PaymentRequired>(paymentRequiredHeader);

    return NextResponse.json(
      {
        status: "payment_required",
        paymentRequired,
        paymentRequiredHeader,
      },
      {
        status: 402,
        headers: {
          [PAYMENT_REQUIRED_HEADER]: paymentRequiredHeader,
        },
      },
    );
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Unlock request failed with status ${response.status}.`;

    return NextResponse.json({ status: "error", message }, { status: response.status });
  }

  const content = (await response.json()) as ContentUnlock;
  const paymentResponseHeader = response.headers.get(PAYMENT_RESPONSE_HEADER);

  const responseBody = {
    status: "unlocked",
    content,
    paymentResponseHeader,
  };

  if (!paymentResponseHeader) {
    return NextResponse.json(responseBody);
  }

  return NextResponse.json(responseBody, {
    headers: {
      [PAYMENT_RESPONSE_HEADER]: paymentResponseHeader,
    },
  });
};

export const GET = async (
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await context.params;

  return forwardUnlockRequest(slug);
};

export const POST = async (
  request: Request,
  context: { params: Promise<{ slug: string }> },
) => {
  const body = (await request.json().catch(() => null)) as {
    paymentSignature?: unknown;
  } | null;
  const paymentSignature =
    typeof body?.paymentSignature === "string"
      ? body.paymentSignature.trim()
      : "";

  if (!paymentSignature) {
    return NextResponse.json(
      {
        status: "error",
        message: "paymentSignature is required.",
      },
      { status: 400 },
    );
  }

  const { slug } = await context.params;

  return forwardUnlockRequest(slug, paymentSignature);
};
