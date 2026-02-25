import pkg from "jsonwebtoken";
const { sign } = pkg;
import { getCredentials } from "./credentials.js";

const algorithm = "ES256";
const url = "api.coinbase.com";

let API_KEY: string;
let SIGNING_KEY: string;

export function hasSigningKeys() {
  return !!API_KEY && !!SIGNING_KEY;
}

export async function getSigningKeys() {
  const { name, privateKey } = await getCredentials();
  API_KEY = name;
  SIGNING_KEY = privateKey;
}

/**
 * Signs a Coinbase API request.
 */
export function signUrl(request_method: string, request_path: string): string {
  if (!API_KEY || !SIGNING_KEY) {
    throw new Error("signUrl => missing credentials");
  }
  const uri = request_method + " " + url + request_path;

  return sign(
    {
      iss: "cdp",
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 120,
      sub: API_KEY,
      uri,
    },
    SIGNING_KEY,
    {
      // algorithm,
      header: {
        alg: algorithm,
        kid: API_KEY,
        // nonce: crypto.randomBytes(16).toString('hex'),
      },
    },
  );
}
