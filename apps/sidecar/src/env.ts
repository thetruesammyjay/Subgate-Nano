import { z } from "zod";

const sidecarEnvSchema = z.object({
  SIDECAR_HOST: z.string().min(1).default("0.0.0.0"),
  SIDECAR_PORT: z.coerce.number().int().positive().default(3002),
  SUBGATE_API_URL: z.string().url().default("http://localhost:3001"),
  INTERNAL_SERVICE_SECRET: z.string().min(16),
  GHOST_WEBHOOK_SECRET: z.string().optional(),
  DISCOURSE_WEBHOOK_SECRET: z.string().optional(),
  DEFAULT_CREATOR_ID: z.string().uuid(),
  DEFAULT_PRICE_USDC: z.coerce.number().nonnegative().default(0.003),
});

export type SidecarEnv = z.infer<typeof sidecarEnvSchema>;

export const loadSidecarEnv = (
  source: NodeJS.ProcessEnv = process.env,
): SidecarEnv => {
  return sidecarEnvSchema.parse(source);
};
