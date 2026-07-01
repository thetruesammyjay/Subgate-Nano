import { z } from "zod";

const envSchema = z.object({
  SUBGATE_API_URL: z.string().url().default("http://localhost:3001"),
  AGENT_PAYMENT_MODE: z.enum(["gateway", "mock"]).default("gateway"),
  BUYER_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]+$/).optional(),
  AGENT_MOCK_PAYER_ADDRESS: z
    .string()
    .min(3)
    .default("0x2222222222222222222222222222222222222222"),
  AGENT_DEFAULT_BUDGET_USDC: z.coerce.number().positive().default(0.1),
  AGENT_RELEVANCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.45),
  AGENT_DEPOSIT_AMOUNT_USDC: z.coerce.number().positive().default(1),
  AGENT_MIN_GATEWAY_BALANCE_USDC: z.coerce.number().nonnegative().default(0.05),
});

export type AgentEnv = z.infer<typeof envSchema>;

export const loadAgentEnv = (
  source: NodeJS.ProcessEnv = process.env,
): AgentEnv => {
  return envSchema.parse(source);
};
