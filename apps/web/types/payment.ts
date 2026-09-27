export type PaymentRequirement = {
  resource_url: string;
  description: string;
  network: string;
  asset: string;
  amount_atomic: number;
  pay_to: string;
  gateway_wallet: string;
  max_timeout_seconds: number;
};

export type PaymentRequiredResponse = {
  message: string;
  payment_required: PaymentRequirement;
  payment_required_header?: string;
};
