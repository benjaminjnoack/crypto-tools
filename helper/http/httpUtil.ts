import type { IncomingMessage, ServerResponse } from 'node:http';
import { isRecord } from '@http/validators';

const DEFAULT_MAX_BYTES = 1_000_000; // ~1MB

function isJsonContentType(ct: string | undefined): boolean {
  if (!ct) return false;
  const [mime] = ct.split(';'); // ignore ;charset=...
  return !!mime && mime.trim().toLowerCase() === 'application/json';
}

export async function getBodyFromRequest(req: IncomingMessage): Promise<Record<string, unknown>> {
  // Enforce JSON API contract up front
  const ct = req.headers['content-type'];
  if (!isJsonContentType(typeof ct === 'string' ? ct : Array.isArray(ct) ? ct[0] : undefined)) {
    const err = new Error('Unsupported Content-Type. Expected application/json');
    (err as any).statusCode = 415;
    throw err;
  }

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let raw = '';
    let size = 0;

    // Ensure chunks are strings
    req.setEncoding('utf8');

    const onData = (chunk: string) => {
      raw += chunk;
      size += chunk.length;
      if (size > DEFAULT_MAX_BYTES) {
        cleanup();
        const err = new Error(`Request body too large (>${DEFAULT_MAX_BYTES} bytes)`);
        (err as any).statusCode = 413; // Payload Too Large
        reject(err);
      }
    };

    const onEnd = () => {
      try {
        if (raw.length === 0) {
          const err = new Error('Empty JSON body');
          (err as any).statusCode = 400;
          onError(err);
        } else {
          const parsed: unknown = JSON.parse(raw);
          if (isRecord(parsed)) {
            cleanup();
            resolve(parsed);
          } else {
            const err = new Error('JSON body must be an object');
            (err as any).statusCode = 400;
            onError(err);
          }
        }
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    const onError = (e: unknown) => {
      cleanup();
      reject(e);
    };

    const cleanup = () => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
    };

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

export function writeResponseJSON(res: ServerResponse, json: object): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(json));
}

export function getRandomAlphanumeric(length: number = 4): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export function getQueryStringParameter(
  req: IncomingMessage,
  parameterName: string,
): string | null {
  // Guard: req.url may be undefined
  if (!req.url) return null;

  // Build an absolute URL for parsing (Node’s URL needs a base)
  const base = `https://${req.headers.host ?? 'localhost'}`;

  try {
    const u = new URL(req.url, base);
    // URLSearchParams#get returns string | null — exactly what you want
    return u.searchParams.get(parameterName);
  } catch {
    // If req.url is malformed, treat as absent
    return null;
  }
}
