import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const apiEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_HOST: z.string().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  JWT_SECRET: z.string().min(32),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100),
  CIRCLE_API_KEY: z.string().optional(),
  ARC_RPC_URL: optionalUrl,
  X402_FACILITATOR_URL: z
    .string()
    .url()
    .default("https://gateway-api-testnet.circle.com"),
  X402_FACILITATOR_MODE: z.enum(["gateway", "mock"]).default("gateway"),
  X402_NETWORK: z.string().min(1).default("eip155:5042002"),
  X402_SCHEME: z.string().min(1).default("exact"),
  X402_ASSET: z
    .string()
    .min(1)
    .default("0x3600000000000000000000000000000000000000"),
  X402_GATEWAY_WALLET_ADDRESS: z
    .string()
    .min(1)
    .default("0x0077777d7EBA4688BDeF3E311b846F25870A19B9"),
  X402_MAX_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(604900),
  INTERNAL_SERVICE_SECRET: z.string().min(16),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const loadApiEnv = (source: NodeJS.ProcessEnv = process.env): ApiEnv => {
  return apiEnvSchema.parse(source);
};
