import { getSigningKeys, hasSigningKeys, signUrl } from "../jwt-signing-service.js";
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type Method,
} from "axios";
import { z, type ZodType } from "zod";
import { delay } from "../../common/delay.js";
import { primeEnv } from "../../common/env.js";
import { logger } from "../../log/logger.js";

const HOST = "https://api.coinbase.com";
const MAX_RETRIES = 5;
const LIVE_EXCHANGE_OPT_IN = "HELPER_ALLOW_LIVE_EXCHANGE";

export const http: AxiosInstance = axios.create({
  baseURL: HOST,
  maxBodyLength: Infinity,
  headers: { "Content-Type": "application/json" },
});

function assertLiveExchangeEnabled(): void {
  primeEnv();
  if (process.env.HELPER_ALLOW_LIVE_EXCHANGE === "true") {
    return;
  }
  throw new Error(
    `Live exchange calls are disabled by default. Set ${LIVE_EXCHANGE_OPT_IN}=true in your env file to enable Coinbase API requests.`,
  );
}

export async function getSignedConfig(
  method: Method,
  requestPath: string,
  queryString: string | null = null,
  data: unknown = null,
): Promise<AxiosRequestConfig> {
  assertLiveExchangeEnabled();

  if (!hasSigningKeys()) {
    await getSigningKeys();
  }

  const config: AxiosRequestConfig = {
    method,
    maxBodyLength: Infinity,
    url: HOST + (queryString ? requestPath + queryString : requestPath),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${signUrl(method, requestPath)}`,
    },
  };

  if (data) {
    config.data = JSON.stringify(data);
  }

  return config;
}

export async function requestWithSchema<S extends ZodType>(
  config: AxiosRequestConfig,
  schema: S,
  maxRetries: number = MAX_RETRIES,
): Promise<z.output<S>> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await http.request(config);
      return schema.parse(res.data);
    } catch (e) {
      lastErr = e;

      if ((e as AxiosError).isAxiosError) {
        const ax = e as AxiosError;
        const status = ax.response?.status;
        const data = ax.response?.data;
        logger.error(
          `[HTTP] ${config.method} ${config.url} -> ${status ?? "ERR"} ${
            typeof data === "string" ? data : JSON.stringify(data)
          }`,
        );
      } else if (e instanceof z.ZodError) {
        logger.error("[HTTP] Response validation failed:", e.message);
        throw e;
      } else {
        logger.error(`[HTTP] ${config.method} ${config.url} failed:`, String(e));
      }

      if (attempt < maxRetries) {
        await delay(1000 * attempt);
      }
    }
  }

  throw new Error(
    `${config.method} ${config.url} failed after ${maxRetries} attempts: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}
