import fs from 'node:fs';
import path from 'node:path';
import { log } from '@core/logger';

// Default crash counter file (kept for backward compatibility)
export const CRASH_FILE = '/tmp/helper_restart_backoff.json';

/**
 * Compute the next backoff delay (seconds) and persist attempt count.
 * Attempts start at 0 (missing/invalid file), increment by 1 per call,
 * and delay = min(10 * attempts, 60).
 */
export function getBackoffTime(filePath: string = CRASH_FILE): number {
  let attempts = 0;

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as Partial<{ attempts: number }>;
    attempts = Number.isFinite(data.attempts) ? (data.attempts as number) : 0;
  } catch {
    // File missing / invalid JSON → treat as 0 attempts
  }

  attempts += 1;

  const delay = Math.min(10 * attempts, 60); // cap at 60s
  // Ensure parent dir exists if a custom path is used
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  } catch {
    /* ignore */
  }
  fs.writeFileSync(filePath, JSON.stringify({ attempts }));

  return delay;
}

/** Reset attempts to zero. */
export function resetBackoffTime(filePath: string = CRASH_FILE): void {
  log.info({ filePath }, 'Reset backoff time');
  const attempts = 0;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  } catch {
    /* ignore */
  }
  fs.writeFileSync(filePath, JSON.stringify({ attempts }));
}
