import {
  createDatabase,
  createDbPool,
  seedDemoData,
} from "@subgate/db";
import {
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
  PAYMENT_SIGNATURE_HEADER,
  parsePaymentPayloadHeader,
} from "@subgate/x402";
import type {
  ContentCatalogItem,
  PricingQuote,
  X402PaymentPayload,
  X402PaymentRequired,
} from "@subgate/types";
import { buildApiApp } from "./app.js";
import { loadApiEnv } from "./env.js";
import { loadApiLocalEnvFiles } from "./local-env.js";

const LOCAL_PAYER_ADDRESS = "0x2222222222222222222222222222222222222222";

const encodeBase64Json = (value: unknown): string => {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
};

const decodeBase64Json = <T>(value: string): T => {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T;
};

const buildLocalPaymentPayload = (
  requirement: X402PaymentRequired,
): X402PaymentPayload => {
  const accepted = requirement.accepts[0];

  if (!accepted) {
    throw new Error("Payment requirement had no accepted terms.");
  }

  return {
    x402Version: requirement.x402Version,
    resource: requirement.resource,
    accepted,
    payload: {
      authorization: `local-demo-signature-${Date.now()}`,
      source: "subgate-local-x402-demo",
      payer: LOCAL_PAYER_ADDRESS,
    },
  };
};

const readHeaderValue = (
  value: string | string[] | number | undefined,
): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return value ?? null;
};

loadApiLocalEnvFiles();

const env = loadApiEnv({
  ...process.env,
  JWT_SECRET:
    process.env.JWT_SECRET ??
    "local-demo-jwt-secret-at-least-thirty-two-chars",
  PLATFORM_FEE_PERCENT: process.env.PLATFORM_FEE_PERCENT ?? "5",
  INTERNAL_SERVICE_SECRET:
    process.env.INTERNAL_SERVICE_SECRET ?? "local-demo-internal-secret",
  X402_FACILITATOR_MODE: "mock",
});

const pool = createDbPool(env.DATABASE_URL);
const db = createDatabase(pool);

try {
  await seedDemoData(db);

  const app = await buildApiApp({ db, env });

  try {
    const catalogResponse = await app.inject({
      method: "GET",
      url: "/catalog",
    });

    if (catalogResponse.statusCode !== 200) {
      throw new Error(`Catalog request failed with HTTP ${catalogResponse.statusCode}.`);
    }

    const catalog = catalogResponse.json<ContentCatalogItem[]>();
    const item = catalog[0];

    if (!item) {
      throw new Error("Seeded catalog did not return any content items.");
    }

    const quoteResponse = await app.inject({
      method: "GET",
      url: `/content/${item.slug}/quote`,
    });

    if (quoteResponse.statusCode !== 200) {
      throw new Error(`Quote request failed with HTTP ${quoteResponse.statusCode}.`);
    }

    const quote = quoteResponse.json<PricingQuote>();

    const gatedResponse = await app.inject({
      method: "GET",
      url: `/content/${item.slug}`,
    });

    if (gatedResponse.statusCode !== 402) {
      throw new Error(
        `Expected unpaid content request to return 402, received ${gatedResponse.statusCode}.`,
      );
    }

    const paymentRequiredHeader = readHeaderValue(
      gatedResponse.headers[PAYMENT_REQUIRED_HEADER.toLowerCase()],
    );

    if (!paymentRequiredHeader) {
      throw new Error("Missing PAYMENT-REQUIRED header.");
    }

    const requirement =
      decodeBase64Json<X402PaymentRequired>(paymentRequiredHeader);
    const paymentPayload = buildLocalPaymentPayload(requirement);
    const paymentSignature = encodeBase64Json(paymentPayload);
    const parsedPaymentPayload = parsePaymentPayloadHeader(paymentSignature);

    if (!parsedPaymentPayload) {
      throw new Error("Local payment payload did not parse.");
    }

    const unlockResponse = await app.inject({
      method: "GET",
      url: `/content/${item.slug}`,
      headers: {
        [PAYMENT_SIGNATURE_HEADER]: paymentSignature,
      },
    });

    if (unlockResponse.statusCode !== 200) {
      throw new Error(
        `Expected paid content request to unlock, received ${unlockResponse.statusCode}: ${unlockResponse.body}`,
      );
    }

    const paymentResponseHeader = readHeaderValue(
      unlockResponse.headers[PAYMENT_RESPONSE_HEADER.toLowerCase()],
    );

    if (!paymentResponseHeader) {
      throw new Error("Missing PAYMENT-RESPONSE header.");
    }

    const unlockBody = unlockResponse.json<{
      accessGrantId?: string;
      paymentId?: string;
      title?: string;
    }>();
    const accessResponse = await app.inject({
      method: "GET",
      url: `/content/${item.id}/access?payerAddress=${encodeURIComponent(
        LOCAL_PAYER_ADDRESS,
      )}`,
    });

    if (accessResponse.statusCode !== 200) {
      throw new Error(`Access check failed with HTTP ${accessResponse.statusCode}.`);
    }

    const accessBody = accessResponse.json<{ hasAccess?: boolean }>();

    if (!accessBody.hasAccess) {
      throw new Error("Access check did not find the paid grant.");
    }

    console.log("Subgate local x402 demo passed.");
    console.log(`Seller: ${item.title}`);
    console.log(`Quote: ${quote.amountUsdc.toFixed(6)} USDC`);
    console.log(`Buyer: ${LOCAL_PAYER_ADDRESS}`);
    console.log(`Payment: ${unlockBody.paymentId}`);
    console.log(`Access grant: ${unlockBody.accessGrantId}`);
  } finally {
    await app.close();
  }
} finally {
  await pool.end();
}
