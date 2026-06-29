import { z } from "zod";

const dbEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
});

export type DbEnv = z.infer<typeof dbEnvSchema>;

export const loadDbEnv = (source: NodeJS.ProcessEnv = process.env): DbEnv => {
  return dbEnvSchema.parse(source);
};
