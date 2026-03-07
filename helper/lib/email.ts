import fs from 'node:fs';
import { log } from '@core/logger';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@boot/env';
const E = env();

const ERROR_LOG_FILE = '/tmp/helper_crash_log.json';

interface CrashRecord {
  lastCrash: number; // ms since epoch
  crashCount: number; // consecutive crashes within window
}

// Create a reusable transporter (Gmail service)
const transporter: Transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: E.HELPER_GMAIL_USER,
    pass: E.HELPER_GMAIL_PASS,
  },
});

/**
 * Decide whether we should send an email given the crash history.
 * - Resets the counter if last crash was > 10 minutes ago.
 * - Allows up to 3 emails within the window, then suppresses.
 * - Persists the updated record to ERROR_LOG_FILE.
 */
export function shouldSendEmail(): boolean {
  let rec: CrashRecord = { lastCrash: 0, crashCount: 0 };

  try {
    const raw = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<CrashRecord>;
    if (typeof parsed.lastCrash === 'number') rec.lastCrash = parsed.lastCrash;
    if (typeof parsed.crashCount === 'number') rec.crashCount = parsed.crashCount;
  } catch {
    // No prior file or invalid JSON → start fresh
  }

  const now = Date.now();
  const sendThresholdMs = 10 * 60 * 1000; // 10 minutes

  if (now - rec.lastCrash > sendThresholdMs) {
    rec.crashCount = 0; // reset if sufficient time has passed
  }

  rec.crashCount += 1;
  rec.lastCrash = now;

  try {
    fs.writeFileSync(ERROR_LOG_FILE, JSON.stringify(rec));
  } catch (err) {
    log.warn({ err }, 'Failed to persist crash record');
  }

  return rec.crashCount <= 3;
}

interface MailOptions {
  from: string;
  to: string;
  subject: string;
  text: string;
}

/**
 * Send a plain‑text email. Never throws (errors are logged and swallowed).
 */
export async function sendMail(subject: string, text: string): Promise<void> {
  const mailOptions: MailOptions = {
    from: E.HELPER_GMAIL_USER,
    to: E.HELPER_ADMIN_EMAIL,
    subject,
    text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    log.debug({ response: info.response }, 'Email sent successfully');
  } catch (error) {
    log.error({ error }, 'Error sending email');
    // never rethrow
  }
}
