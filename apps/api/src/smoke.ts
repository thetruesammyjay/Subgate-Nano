import { createDatabase, createDbPool, seedDemoData } from "@subgate/db";
import {
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
  PAYMENT_SIGNATURE_HEADER,
  parsePaymentPayloadHeader,
} from "@subgate/x402";
import type {
  X402PaymentPayload,
  X402PaymentRequired,
  X402SettlementResponse,
} from "@subgate/types";
import { buildApiApp } from "./app.js";
import { loadApiEnv } from "./env.js";
import { loadApiLocalEnvFiles } from "./local-env.js";

const encodeBase64Json = (value: unknown): string => {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
};

const decodeBase64Json = <T>(value: string): T => {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T;
};

const buildSignedPaymentPayload = (
  requirement: X402PaymentRequired,
): X402PaymentPayload => {
  const accepted = requirement.accepts[0];

  if (!accepted) {
    throw new Error("Smoke test payment requirement had no accepted terms.");
  }

  return {
    x402Version: requirement.x402Version,
    resource: requirement.resource,
    accepted,
    payload: {
      authorization: "smoke-test-signature",
      source: "subgate-api-smoke",
    },
  };
};

loadApiLocalEnvFiles();

const env = loadApiEnv({
  ...process.env,
  JWT_SECRET:
    process.env.JWT_SECRET ??
    "smoke-test-jwt-secret-at-least-thirty-two-chars",
  PLATFORM_FEE_PERCENT: process.env.PLATFORM_FEE_PERCENT ?? "5",
  INTERNAL_SERVICE_SECRET:
    process.env.INTERNAL_SERVICE_SECRET ?? "smoke-test-internal-secret",
});

const pool = createDbPool(env.DATABASE_URL);
const db = createDatabase(pool);

try {
  const seed = await seedDemoData(db);

  const facilitator = {
    async settle(
      payload: X402PaymentPayload,
    ): Promise<X402SettlementResponse> {
      return {
        success: true,
        transaction: `smoke-${Date.now()}`,
        network: payload.accepted.network,
        payer: "0x2222222222222222222222222222222222222222",
      };
    },
  };

  const app = await buildApiApp({ db, env, facilitator });

  try {
    const magicLinkResponse = await app.inject({
      method: "POST",
      url: "/auth/creator/magic-link",
      payload: {
        email: "demo@subgate.nano",
      },
    });

    if (magicLinkResponse.statusCode !== 200) {
      throw new Error(
        `Expected magic-link request 200, received ${magicLinkResponse.statusCode}.`,
      );
    }

    const magicLinkBody = magicLinkResponse.json<{
      devMagicLinkToken?: string;
    }>();

    if (!magicLinkBody.devMagicLinkToken) {
      throw new Error("Smoke test requires a development magic-link token.");
    }

    const sessionResponse = await app.inject({
      method: "POST",
      url: "/auth/creator/session",
      payload: {
        token: magicLinkBody.devMagicLinkToken,
      },
    });

    if (sessionResponse.statusCode !== 200) {
      throw new Error(
        `Expected creator session exchange 200, received ${sessionResponse.statusCode}.`,
      );
    }

    const sessionBody = sessionResponse.json<{
      token?: string;
      creator?: {
        email?: string;
      };
    }>();

    if (!sessionBody.token || sessionBody.creator?.email !== "demo@subgate.nano") {
      throw new Error("Creator session exchange did not return the demo creator.");
    }

    const verifiedSessionResponse = await app.inject({
      method: "GET",
      url: "/auth/creator/session",
      headers: {
        authorization: `Bearer ${sessionBody.token}`,
      },
    });

    if (verifiedSessionResponse.statusCode !== 200) {
      throw new Error(
        `Expected creator session verification 200, received ${verifiedSessionResponse.statusCode}.`,
      );
    }

    await app.inject({
      method: "POST",
      url: "/auth/creator/logout",
      headers: {
        authorization: `Bearer ${sessionBody.token}`,
      },
    });

    const unauthorizedCreateResponse = await app.inject({
      method: "POST",
      url: "/content",
      payload: {},
    });

    if (unauthorizedCreateResponse.statusCode !== 401) {
      throw new Error(
        `Expected unauthenticated content creation to return 401, received ${unauthorizedCreateResponse.statusCode}.`,
      );
    }

    const quoteResponse = await app.inject({
      method: "GET",
      url: "/content/arc-settlement-explainer/quote",
    });

    if (quoteResponse.statusCode !== 200) {
      throw new Error(`Expected quote 200, received ${quoteResponse.statusCode}.`);
    }

    const paymentRequiredResponse = await app.inject({
      method: "GET",
      url: "/content/arc-settlement-explainer",
    });

    if (paymentRequiredResponse.statusCode !== 402) {
      throw new Error(
        `Expected missing-payment request to return 402, received ${paymentRequiredResponse.statusCode}.`,
      );
    }

    const paymentRequiredHeader =
      paymentRequiredResponse.headers[PAYMENT_REQUIRED_HEADER.toLowerCase()];
    const paymentRequiredValue = Array.isArray(paymentRequiredHeader)
      ? paymentRequiredHeader[0]
      : paymentRequiredHeader;

    if (!paymentRequiredValue) {
      throw new Error("Missing PAYMENT-REQUIRED header.");
    }

    const requirement =
      decodeBase64Json<X402PaymentRequired>(String(paymentRequiredValue));
    const paymentPayload = buildSignedPaymentPayload(requirement);

    const unlockResponse = await app.inject({
      method: "GET",
      url: "/content/arc-settlement-explainer",
      headers: {
        [PAYMENT_SIGNATURE_HEADER]: encodeBase64Json(paymentPayload),
      },
    });

    if (unlockResponse.statusCode !== 200) {
      throw new Error(
        `Expected unlock 200, received ${unlockResponse.statusCode}: ${unlockResponse.body}`,
      );
    }

    const settlementHeader =
      unlockResponse.headers[PAYMENT_RESPONSE_HEADER.toLowerCase()];

    if (!settlementHeader) {
      throw new Error("Missing PAYMENT-RESPONSE header.");
    }

    const parsedPayload = parsePaymentPayloadHeader(
      encodeBase64Json(paymentPayload),
    );

    if (!parsedPayload) {
      throw new Error("Smoke payment payload did not parse.");
    }

    const unlockBody = unlockResponse.json<{
      accessGrantId?: string;
      paymentId?: string;
      body?: string;
    }>();

    if (!unlockBody.accessGrantId || !unlockBody.paymentId || !unlockBody.body) {
      throw new Error("Unlocked response did not include grant, payment, and body.");
    }

    const statsResponse = await app.inject({
      method: "GET",
      url: `/creators/${seed.creatorId}/stats`,
      headers: {
        "x-subgate-internal-secret": env.INTERNAL_SERVICE_SECRET,
      },
    });

    if (statsResponse.statusCode !== 200) {
      throw new Error(
        `Expected creator stats 200, received ${statsResponse.statusCode}.`,
      );
    }

    const statsBody = statsResponse.json<{
      contentCount?: number;
      settledPaymentCount?: number;
      revenueUsdc?: number;
    }>();

    if (
      typeof statsBody.contentCount !== "number" ||
      typeof statsBody.settledPaymentCount !== "number" ||
      typeof statsBody.revenueUsdc !== "number"
    ) {
      throw new Error("Creator stats did not include content and revenue totals.");
    }

    const paymentsResponse = await app.inject({
      method: "GET",
      url: `/creators/${seed.creatorId}/payments`,
      headers: {
        "x-subgate-internal-secret": env.INTERNAL_SERVICE_SECRET,
      },
    });

    if (paymentsResponse.statusCode !== 200) {
      throw new Error(
        `Expected creator payments 200, received ${paymentsResponse.statusCode}.`,
      );
    }

    const paymentsBody = paymentsResponse.json<Array<{ paymentType?: string }>>();

    if (!Array.isArray(paymentsBody) || paymentsBody.length === 0) {
      throw new Error("Creator payments did not include the settled smoke payment.");
    }

    const performanceResponse = await app.inject({
      method: "GET",
      url: `/creators/${seed.creatorId}/content-performance`,
      headers: {
        "x-subgate-internal-secret": env.INTERNAL_SERVICE_SECRET,
      },
    });

    if (performanceResponse.statusCode !== 200) {
      throw new Error(
        `Expected creator content performance 200, received ${performanceResponse.statusCode}.`,
      );
    }

    const performanceBody = performanceResponse.json<
      Array<{ contentId?: string; revenueUsdc?: number }>
    >();

    if (!performanceBody.some((item) => item.contentId && typeof item.revenueUsdc === "number")) {
      throw new Error("Creator content performance did not include content revenue.");
    }

    console.log(
      `Smoke passed: quote -> 402 -> ${PAYMENT_SIGNATURE_HEADER} -> grant ${unlockBody.accessGrantId}.`,
    );
  } finally {
    await app.close();
  }
} finally {
  await pool.end();
}
