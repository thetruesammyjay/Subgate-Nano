#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const protectedEnvKeys = new Set(Object.keys(process.env));

const envFiles = {
  root: [".env"],
  api: [".env", "apps/api/.env"],
  web: [".env", "apps/web/.env"],
  worker: [".env", "apps/worker/.env"],
  sidecar: [".env", "apps/sidecar/.env"],
  telegram: [".env", "apps/bot-telegram/.env"],
};

const parseEnvFile = (relativePath) => {
  const path = resolve(root, relativePath);

  if (!existsSync(path)) {
    return {
      path,
      exists: false,
      values: {},
    };
  }

  const values = {};
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
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return {
    path,
    exists: true,
    values,
  };
};

const loadEnvScope = (files) => {
  const env = { ...process.env };
  const sources = {};

  for (const relativePath of files) {
    const parsed = parseEnvFile(relativePath);

    if (!parsed.exists) {
      continue;
    }

    for (const [key, value] of Object.entries(parsed.values)) {
      if (protectedEnvKeys.has(key)) {
        continue;
      }

      env[key] = value;
      sources[key] = relativePath;
    }
  }

  return { env, sources };
};

const isPlaceholder = (value) => {
  return !value || value.includes("replace-with");
};

const checks = [
  {
    scope: "api",
    keys: ["DATABASE_URL", "JWT_SECRET", "INTERNAL_SERVICE_SECRET"],
  },
  {
    scope: "web",
    keys: ["INTERNAL_SERVICE_SECRET"],
  },
  {
    scope: "worker",
    keys: ["DATABASE_URL"],
  },
  {
    scope: "sidecar",
    keys: ["INTERNAL_SERVICE_SECRET", "DEFAULT_CREATOR_ID"],
  },
  {
    scope: "telegram",
    keys: ["INTERNAL_SERVICE_SECRET", "DEFAULT_CREATOR_ID", "TELEGRAM_BOT_TOKEN"],
  },
];

const print = (message = "") => {
  process.stdout.write(`${message}\n`);
};

const failures = [];
const warnings = [];

print("Subgate local smoke checklist");
print("");

for (const [scope, files] of Object.entries(envFiles)) {
  const existing = files.filter((file) => parseEnvFile(file).exists);

  if (existing.length === 0) {
    warnings.push(`${scope}: no env file found (${files.join(", ")}).`);
  }
}

for (const check of checks) {
  const { env, sources } = loadEnvScope(envFiles[check.scope]);

  for (const key of check.keys) {
    const value = env[key];

    if (isPlaceholder(value)) {
      failures.push(
        `${check.scope}: ${key} is missing or still uses a placeholder` +
          (sources[key] ? ` (${sources[key]})` : ""),
      );
    }
  }
}

const apiEnv = loadEnvScope(envFiles.api).env;
const workerEnv = loadEnvScope(envFiles.worker).env;

if (!apiEnv.WORKER_HEALTH_FILE) {
  warnings.push("api: WORKER_HEALTH_FILE is not configured; diagnostics will show worker as unknown.");
}

if (!workerEnv.WORKER_HEALTH_FILE) {
  warnings.push("worker: WORKER_HEALTH_FILE is not configured; default runtime path will be used.");
}

if (warnings.length > 0) {
  print("Warnings");
  for (const warning of warnings) {
    print(`- ${warning}`);
  }
  print("");
}

if (failures.length > 0) {
  print("Missing local configuration");
  for (const failure of failures) {
    print(`- ${failure}`);
  }
  print("");
  print("Fix the env values, then rerun pnpm smoke:local.");
  process.exit(1);
}

const rootEnv = loadEnvScope(envFiles.root).env;
const commands = [
  {
    name: "workspace typecheck",
    args: ["typecheck"],
  },
  {
    name: "sidecar smoke",
    args: ["--filter", "@subgate/sidecar", "smoke"],
  },
  {
    name: "telegram bot smoke",
    args: ["--filter", "@subgate/bot-telegram", "smoke"],
  },
  {
    name: "worker smoke",
    args: ["--filter", "@subgate/worker", "smoke"],
  },
  {
    name: "api smoke",
    args: ["--filter", "@subgate/api", "smoke"],
  },
];

for (const command of commands) {
  print(`> ${command.name}`);

  const result = spawnSync(pnpm, command.args, {
    cwd: root,
    env: rootEnv,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    print("");
    print(`Local smoke failed during ${command.name}.`);
    process.exit(result.status ?? 1);
  }

  print("");
}

print("Local smoke passed.");
print("Run pnpm dev:all to start API, web, worker, sidecar, and Telegram bot together.");
