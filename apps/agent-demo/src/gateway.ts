import { GatewayClient } from "@circle-fin/x402-batching/client";
import type { X402PaymentPayload, X402PaymentRequired } from "@subgate/types";

export type GatewayPaymentClient = {
  pay: (
    url: string,
    options?: { method?: string; body?: unknown },
  ) => Promise<{
    status: number;
    data: unknown;
    formattedAmount?: string;
  }>;
  supports?: (url: string) => Promise<{ supported: boolean }>;
  getBalances?: () => Promise<{
    gateway: {
      available: bigint;
      formattedAvailable: string;
    };
  }>;
  deposit?: (amount: string) => Promise<{ depositTxHash: string }>;
};

const PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED";
const PAYMENT_SIGNATURE_HEADER = "PAYMENT-SIGNATURE";

const encodeBase64Json = (value: unknown): string => {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
};

const decodeBase64Json = <T>(value: string): T => {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T;
};

const formatAtomicUsdc = (amount: string): string => {
  return (Number(amount) / 1_000_000).toFixed(6);
};

export const createGatewayPaymentClient = (
  privateKey: `0x${string}`,
): GatewayPaymentClient => {
  return new GatewayClient({
    chain: "arcTestnet",
    privateKey,
  }) as GatewayPaymentClient;
};

export const createLocalMockPaymentClient = (options: {
  payerAddress: string;
  fetchImpl?: typeof fetch;
}): GatewayPaymentClient => {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async supports() {
      return { supported: true };
    },
    async pay(url, requestOptions) {
      const method = requestOptions?.method ?? "GET";
      const requestBody =
        requestOptions?.body === undefined
          ? undefined
          : JSON.stringify(requestOptions.body);
      const bodyHeaders =
        requestBody === undefined ? {} : { "content-type": "application/json" };
      const requestInit: RequestInit = {
        method,
        headers: bodyHeaders,
        ...(requestBody === undefined ? {} : { body: requestBody }),
      };
      const initialResponse = await fetchImpl(url, requestInit);

      if (initialResponse.status !== 402) {
        const data = await initialResponse.json().catch(() => null);

        if (!initialResponse.ok) {
          throw new Error(
            `Expected local seller to return 402, received HTTP ${initialResponse.status}.`,
          );
        }

        return {
          status: initialResponse.status,
          data,
        };
      }

      const paymentRequiredHeader = initialResponse.headers.get(
        PAYMENT_REQUIRED_HEADER,
      );

      if (!paymentRequiredHeader) {
        throw new Error("Seller returned 402 without PAYMENT-REQUIRED.");
      }

      const requirement =
        decodeBase64Json<X402PaymentRequired>(paymentRequiredHeader);
      const accepted = requirement.accepts[0];

      if (!accepted) {
        throw new Error("Seller returned no accepted x402 payment terms.");
      }

      const paymentPayload: X402PaymentPayload = {
        x402Version: requirement.x402Version,
        resource: requirement.resource,
        accepted,
        payload: {
          authorization: `local-demo-signature-${Date.now()}`,
          source: "subgate-agent-demo",
          payer: options.payerAddress,
        },
      };
      const paidResponse = await fetchImpl(url, {
        method,
        headers: {
          ...bodyHeaders,
          [PAYMENT_SIGNATURE_HEADER]: encodeBase64Json(paymentPayload),
        },
        ...(requestBody === undefined ? {} : { body: requestBody }),
      });
      const data = await paidResponse.json().catch(() => null);

      if (!paidResponse.ok) {
        throw new Error(
          `Local x402 payment retry failed with HTTP ${paidResponse.status}.`,
        );
      }

      return {
        status: paidResponse.status,
        data,
        formattedAmount: formatAtomicUsdc(accepted.amount),
      };
    },
  };
};

export const ensureGatewayBalance = async (
  gateway: GatewayPaymentClient,
  options: {
    minBalanceUsdc: number;
    depositAmountUsdc: number;
  },
) => {
  if (!gateway.getBalances || !gateway.deposit) {
    return;
  }

  const balances = await gateway.getBalances();
  const minAtomicUnits = BigInt(Math.round(options.minBalanceUsdc * 1_000_000));

  if (balances.gateway.available >= minAtomicUnits) {
    return;
  }

  const result = await gateway.deposit(String(options.depositAmountUsdc));

  console.log(`Deposited ${options.depositAmountUsdc} USDC into Gateway: ${result.depositTxHash}`);
};
