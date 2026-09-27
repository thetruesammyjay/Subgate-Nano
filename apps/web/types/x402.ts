export type X402PaymentRequired = {
  x402Version: number;
  resource: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepts: Array<{
    scheme: string;
    network: string;
    asset: string;
    payTo: string;
    amount: string;
    maxTimeoutSeconds: number;
    extra?: Record<string, unknown>;
  }>;
};
