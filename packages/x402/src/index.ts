import {
  createHash,
} from "node:crypto";
import {
  x402PaymentPayloadSchema,
  x402PaymentRequiredSchema,
  x402SettlementResponseSchema,
  type X402PaymentPayload,
  type X402PaymentRequired,
  type X402SettlementResponse,
} from "@subgate/types";

export const PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED";
export const PAYMENT_SIGNATURE_HEADER = "PAYMENT-SIGNATURE";
export const PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE";

const encodeBase64Json = (value: unknown): string => {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
};

const decodeBase64Json = (value: string): unknown => {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
};

const toUsdcAtomicUnits = (amountUsdc: number): string => {
  return String(Math.round(amountUsdc * 1_000_000));
};

const readNestedString = (
  value: Record<string, unknown>,
  path: string[],
): string | undefined => {
  let current: unknown = value;

  for (const segment of path) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" ? current : undefined;
};

export const encodePaymentRequired = (value: X402PaymentRequired): string => {
  return encodeBase64Json(x402PaymentRequiredSchema.parse(value));
};

export const encodePaymentResponse = (value: X402SettlementResponse): string => {
  return encodeBase64Json(x402SettlementResponseSchema.parse(value));
};

export const parsePaymentPayloadHeader = (
  value: string | string[] | undefined,
): X402PaymentPayload | null => {
  const header = Array.isArray(value) ? value[0] : value;

  if (!header) {
    return null;
  }

  return x402PaymentPayloadSchema.parse(decodeBase64Json(header));
};

export const getPaymentPayloadIdentifier = (
  payload: X402PaymentPayload,
): string => {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
};

export type BuildPaymentRequiredInput = {
  resourceUrl: string;
  amountUsdc: number;
  payTo: string;
  description: string;
  network: string;
  scheme: string;
  asset: string;
  gatewayWalletAddress: string;
  maxTimeoutSeconds: number;
  mimeType?: string;
};

export const buildPaymentRequired = (
  input: BuildPaymentRequiredInput,
): X402PaymentRequired => {
  return x402PaymentRequiredSchema.parse({
    x402Version: 2,
    resource: {
      url: input.resourceUrl,
      description: input.description,
      mimeType: input.mimeType ?? "application/json",
    },
    accepts: [
      {
        scheme: input.scheme,
        network: input.network,
        asset: input.asset,
        payTo: input.payTo,
        amount: toUsdcAtomicUnits(input.amountUsdc),
        maxTimeoutSeconds: input.maxTimeoutSeconds,
        extra: {
          name: "GatewayWalletBatched",
          version: "1",
          verifyingContract: input.gatewayWalletAddress,
        },
      },
    ],
  });
};

export const assertPaymentMatchesRequirement = (
  payload: X402PaymentPayload,
  requirement: X402PaymentRequired,
) => {
  const accepted = requirement.accepts[0];

  if (!accepted) {
    throw new Error("Payment requirement has no accepted payment options.");
  }

  if (
    payload.accepted.scheme !== accepted.scheme ||
    payload.accepted.network !== accepted.network ||
    payload.accepted.asset !== accepted.asset ||
    payload.accepted.payTo !== accepted.payTo ||
    payload.accepted.amount !== accepted.amount
  ) {
    throw new Error("Payment payload does not match the required payment terms.");
  }
};

export type X402FacilitatorClientOptions = {
  facilitatorUrl: string;
  fetchImpl?: typeof fetch;
};

export class X402FacilitatorClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: X402FacilitatorClientOptions) {
    this.baseUrl = options.facilitatorUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async settle(
    payload: X402PaymentPayload,
    paymentRequired: X402PaymentRequired,
  ): Promise<X402SettlementResponse> {
    const requirements = paymentRequired.accepts[0];

    if (!requirements) {
      throw new Error("Payment requirement has no accepted payment options.");
    }

    const settleResponse = await this.postJson("/v1/x402/settle", {
      paymentPayload: payload,
      paymentRequirements: requirements,
    });

    return this.mapSettlementResponse(settleResponse);
  }

  private async postJson(path: string, body: unknown): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        ...(typeof payload === "object" && payload !== null
          ? (payload as Record<string, unknown>)
          : { payload }),
      };
    }

    return payload;
  }

  private mapSettlementResponse(response: unknown): X402SettlementResponse {
    if (typeof response !== "object" || response === null) {
      return x402SettlementResponseSchema.parse({
        success: false,
        transaction: "",
        network: "unknown",
        message: "Gateway returned a malformed settlement response.",
        raw: response,
      });
    }

    const value = response as Record<string, unknown>;

    return x402SettlementResponseSchema.parse({
      success: value.success === true,
      transaction: typeof value.transaction === "string" ? value.transaction : "",
      network: typeof value.network === "string" ? value.network : "unknown",
      payer:
        typeof value.payer === "string"
          ? value.payer
          : readNestedString(value, ["payload", "payer"]),
      errorReason:
        typeof value.errorReason === "string" ? value.errorReason : undefined,
      message:
        typeof value.message === "string"
          ? value.message
          : typeof value.errorReason === "string"
            ? value.errorReason
            : undefined,
      raw: response,
    });
  }
}
