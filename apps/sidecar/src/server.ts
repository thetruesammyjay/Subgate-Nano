import { buildSidecarApp } from "./app.js";
import { loadSidecarEnv } from "./env.js";

const env = loadSidecarEnv();
const app = await buildSidecarApp({ env });

const start = async () => {
  try {
    await app.listen({ port: env.SIDECAR_PORT, host: env.SIDECAR_HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
