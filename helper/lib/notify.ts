import { env } from 'node:process';
import { exec, execSync } from 'child_process';
import { log } from '@core/logger';

/**
 * Send an optionally critical notification asynchronously
 */
export async function sendNotification(
  title: string,
  message: string,
  critical: boolean = false,
): Promise<void> {
  if (!env.DISPLAY) {
    log.warn(`Running without desktop notifications!`);
    return;
  }
  try {
    const urgency = critical ? '-u critical ' : '';
    await new Promise<void | Error>((resolve, reject) => {
      exec(`notify-send ${urgency}"${title}" "${message}"`, (error) => {
        error ? reject(error) : resolve();
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      log.error(`Error sending notification: ${error.message}`);
    } else {
      log.error(`Error sending notification: ${error}`);
    }
  }
}

/**
 * Send a critical notification synchronously
 */
export function sendErrorNotificationSync(title: string, message: string): void {
  if (!env.DISPLAY) {
    log.warn(`Running without desktop notifications!`);
    return;
  }
  try {
    execSync(`notify-send -u critical "${title}" "${message}"`);
  } catch (error) {
    if (error instanceof Error) {
      log.error(`Error sending notification: ${error.message}`);
    } else {
      log.error(`Error sending notification: ${error}`);
    }
  }
}
