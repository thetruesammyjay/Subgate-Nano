import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const telegramBotEnvSchema = z.object({
  TELEGRAM_BOT_HOST: z.string().min(1).default("0.0.0.0"),
  TELEGRAM_BOT_PORT: z.coerce.number().int().positive().default(3003),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: optionalNonEmptyString,
  SUBGATE_API_URL: z.string().url().default("http://localhost:3001"),
  SUBGATE_WEB_URL: z.string().url().default("http://localhost:3000"),
  INTERNAL_SERVICE_SECRET: z.string().min(16),
  DEFAULT_CREATOR_ID: z.string().uuid(),
  DEFAULT_CHANNEL_ID: optionalNonEmptyString,
  DEFAULT_PRICE_USDC: z.coerce.number().nonnegative().default(0.003),
});

export type TelegramBotEnv = z.infer<typeof telegramBotEnvSchema>;

export const loadTelegramBotEnv = (
  source: NodeJS.ProcessEnv = process.env,
): TelegramBotEnv => {
  return telegramBotEnvSchema.parse(source);
};
