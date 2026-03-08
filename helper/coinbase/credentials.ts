import { promises } from 'node:fs';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { env } from '@boot/env';
import { log } from '@core/logger';
const E = env();
import { z } from 'zod';

const CredentialsSchema = z.object({
  name: z.string(),
  privateKey: z.string(),
});

export type Credentials = z.infer<typeof CredentialsSchema>;
let credentials: Credentials | null = null;

/**
 * Loads and parses the Coinbase credentials from the JSON file specified
 * in the HELPER_COINBASE_CREDENTIALS_PATH environment variable
 * or from AWS SecretsManager
 */
export async function getCredentials(): Promise<Credentials> {
  if (!credentials) {
    let keyData;
    if (E.HELPER_COINBASE_CREDENTIALS_PATH) {
      log.debug(`loading credentials from ${E.HELPER_COINBASE_CREDENTIALS_PATH}`);
      keyData = await promises.readFile(E.HELPER_COINBASE_CREDENTIALS_PATH, 'utf8');
    } else {
      log.debug(`loading credentials from AWS`);
      const client = new SecretsManagerClient({
        region: 'us-east-2',
      });

      const response = await client.send(
        new GetSecretValueCommand({
          SecretId: 'coinbase/trade',
        }),
      );
      keyData = response.SecretString;
    }

    if (!keyData) {
      throw new Error(`Cannot load credentials.`);
    }
    credentials = CredentialsSchema.parse(JSON.parse(keyData));
  }

  return credentials;
}
