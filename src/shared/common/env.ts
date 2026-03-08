import dotenv from "dotenv";
import os from "node:os";
import path from "node:path";
import { type Env, EnvSchema } from "./schemas/env.js";

let didLoadDotenv = false;
let cachedEnv: Env | null = null;

function defaultEnvPath(): string {
  const configHome = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(configHome, "helper", ".env");
}

function loadDotenv(explicitPath?: string) {
  if (didLoadDotenv) {return;}

  const envPath = explicitPath ?? process.env.HELPER_ENV_FILE ?? defaultEnvPath();
  dotenv.config({ path: envPath, quiet: true });

  didLoadDotenv = true;
}

export function primeEnv(explicitPath?: string): void {
  if (cachedEnv) {return;}
  loadDotenv(explicitPath);
  cachedEnv = EnvSchema.parse(process.env);
}

export function getEnvConfig(): Env {
  if (!cachedEnv) {
    primeEnv();
  }
  if (!cachedEnv) {
    throw new Error("Failed to load environment configuration");
  }
  return cachedEnv;
}
