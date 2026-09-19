export const usdcAtomicUnits = 1_000_000;
export const toUsdcAtomicUnits = (amountUsdc: number) => Math.round(amountUsdc * usdcAtomicUnits);
export const fromUsdcAtomicUnits = (amount: number) => amount / usdcAtomicUnits;
export type SettlementRequest = { sessionId: string; amountUsdc: number; payer: string; creator: string };
