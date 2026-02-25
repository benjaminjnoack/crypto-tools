import { promises } from "node:fs";
import { getEnvConfig } from "../common/env.js";
import { type Credentials, CredentialsSchema } from "./schemas/credentials.js";
import { logger } from "../log/logger.js";

let credentials: Credentials | null = null;

/**
 * Loads and parses the Coinbase credentials from the JSON file specified
 * in the HELPER_COINBASE_CREDENTIALS_PATH environment variable
 */
export async function getCredentials(): Promise<Credentials> {
  if (!credentials) {
    const { HELPER_COINBASE_CREDENTIALS_PATH } = getEnvConfig();
    logger.debug(`loading credentials from ${HELPER_COINBASE_CREDENTIALS_PATH}`);
    const keyData = await promises.readFile(HELPER_COINBASE_CREDENTIALS_PATH, "utf8");

    if (!keyData) {
      throw new Error("Cannot load credentials.");
    }
    credentials = CredentialsSchema.parse(JSON.parse(keyData));
  }

  return credentials;
}
