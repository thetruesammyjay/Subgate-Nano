import { GatewayClient } from "@circle-fin/x402-batching/client";

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

export const createGatewayPaymentClient = (
  privateKey: `0x${string}`,
): GatewayPaymentClient => {
  return new GatewayClient({
    chain: "arcTestnet",
    privateKey,
  }) as GatewayPaymentClient;
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
