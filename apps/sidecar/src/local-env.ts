import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const protectedEnvKeys = new Set(Object.keys(process.env));

const loadEnvFile = (url: URL) => {
  const path = fileURLToPath(url);

  if (!existsSync(path)) {
    return;
  }

  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!protectedEnvKeys.has(key)) {
      process.env[key] = value;
    }
  }
};

export const loadSidecarLocalEnvFiles = () => {
  loadEnvFile(new URL("../../../.env", import.meta.url));
  loadEnvFile(new URL("../.env", import.meta.url));
};
