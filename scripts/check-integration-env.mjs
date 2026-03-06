import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";

function defaultEnvPath() {
  const configHome = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(configHome, "helper", ".env.readonly");
}

function fail(message) {
  console.error(`[integration-preflight] ${message}`);
  process.exit(1);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

const envFile = process.env.HELPER_ENV_FILE ?? defaultEnvPath();

if (!(await pathExists(envFile))) {
  fail(
    `Env file not found: ${envFile}. Create it with HELPER_COINBASE_CREDENTIALS_PATH and rerun npm run test:integration:smoke.`,
  );
}

const envRaw = await fs.readFile(envFile, "utf8");
const parsed = dotenv.parse(envRaw);
const credentialsPath = parsed.HELPER_COINBASE_CREDENTIALS_PATH;

if (!credentialsPath) {
  fail(
    `Missing HELPER_COINBASE_CREDENTIALS_PATH in ${envFile}. Point it to your readonly Coinbase credentials JSON file.`,
  );
}

const resolvedCredentialsPath = path.isAbsolute(credentialsPath)
  ? credentialsPath
  : path.resolve(path.dirname(envFile), credentialsPath);

if (!(await pathExists(resolvedCredentialsPath))) {
  fail(`Credentials file not found: ${resolvedCredentialsPath}`);
}

let parsedCredentials;
try {
  const credentialsRaw = await fs.readFile(resolvedCredentialsPath, "utf8");
  parsedCredentials = JSON.parse(credentialsRaw);
} catch (error) {
  fail(
    `Unable to read/parse credentials JSON at ${resolvedCredentialsPath}: ${error instanceof Error ? error.message : String(error)}`,
  );
}

if (typeof parsedCredentials.name !== "string" || parsedCredentials.name.length === 0) {
  fail(`Credentials JSON at ${resolvedCredentialsPath} is missing non-empty string field 'name'.`);
}

if (typeof parsedCredentials.privateKey !== "string" || parsedCredentials.privateKey.length === 0) {
  fail(`Credentials JSON at ${resolvedCredentialsPath} is missing non-empty string field 'privateKey'.`);
}

console.log(`[integration-preflight] OK env=${envFile} credentials=${resolvedCredentialsPath}`);
