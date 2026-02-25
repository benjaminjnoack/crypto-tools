#!/usr/bin/env node

import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getCredentials } from "../coinbase/credentials.js";
import { getEnvConfig, primeEnv } from "../common/env.js";
import { logger } from "../log/logger.js";

type Args = {
  envFilePath?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value) {continue;}

    if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    }

    if (value === "--env-file") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("--env-file requires a path argument");
      }
      args.envFilePath = next;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

function defaultEnvPath(): string {
  const configHome = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(configHome, "helper", ".env");
}

function printHelp(): void {
  logger.log("Validate helper environment and Coinbase credentials.");
  logger.log("");
  logger.log("Usage:");
  logger.log("  helper-env-check [--env-file <path>]");
  logger.log("");
  logger.log("Options:");
  logger.log("  --env-file <path>  Override env file path");
  logger.log("  -h, --help         Show this help message");
}

async function run(): Promise<void> {
  const { envFilePath } = parseArgs(process.argv.slice(2));
  const resolvedEnvPath = envFilePath ?? process.env.HELPER_ENV_FILE ?? defaultEnvPath();

  await access(resolvedEnvPath);

  primeEnv(envFilePath);
  const loadedEnv = getEnvConfig();
  await getCredentials();

  logger.log("Environment configuration is valid.");
  logger.log(`Env file: ${resolvedEnvPath}`);
  logger.log(`Credentials file: ${loadedEnv.HELPER_COINBASE_CREDENTIALS_PATH}`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`Environment validation failed: ${message}`);
  process.exit(1);
});
