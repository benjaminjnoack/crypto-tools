import process from 'node:process';
import { log } from '@core/logger.js';
import notify from 'sd-notify';
import userChannel from '@cb/websocket/UserChannel';
import accountManager from '@cb/accounts/AccountManager';
import { checkEnvironment } from '@core/cache.js';
import delay from '@core/delay.ts';
import { sendErrorNotificationSync } from '@core/notify.js';
import { execSync } from 'node:child_process';
import {
  cleanupPositions,
  positionFireSale,
  initializePositions,
  printStatusOfAllPositions,
  reloadPositions,
  positionSave,
} from './positions.mjs';
import startServer from '@http/server';
import { getVersion } from './project_version.ts';
import { shouldSendEmail } from '@core/email.ts';
import { getBackoffTime, resetBackoffTime } from '@core/backoff.js';
import { getSigningKeys } from '@cb/signing.ts';
import { WebSocketError } from '@cb/websocket/WebsocketConnection';
import tickerChannel from '@cb/websocket/TickerChannel';
import { env } from '@boot/env';
const E = env();

let isAppInitialized = false;
let isCleanupCalled = false;

const version = await getVersion();

/**
 * Cleans up resources and exits the process
 * @param {number} code
 */
async function cleanup(code) {
  if (isCleanupCalled) return;

  try {
    log.warn(`-----------CLEANUP ${version}-----------`);
    isCleanupCalled = true;

    if (E.HELPER_UNDER_SYSTEMCTL && isAppInitialized) {
      cleanupPositions();
    }

    tickerChannel.cleanup();
    userChannel.cleanup();
  } catch (e) {
    log.error(e.message);
  } finally {
    process.exit(code);
  }
}

// Event listeners for process cleanup and error handling
process.on('exit', () => cleanup(0));
process.on('SIGINT', () => cleanup(0));
process.on('uncaughtException', (err) => {
  let message;
  if (err instanceof Error) {
    message = err.message;
    console.error(err.stack); // Log stack trace for better debugging
  } else if (typeof err === 'string') {
    message = err;
    console.error(`Uncaught Exception: ${message}`);
  } else {
    message = `A truly unknown error: ${typeof err}`;
    console.error(message);
  }
  message = message.replace(/"/g, '\\"'); // Escape double quotes
  log.error(`Message: ${message}`);
  sendErrorNotificationSync('Uncaught Exception', message);

  if (err instanceof WebSocketError) {
    log.error(`WebSocketError: ${err.message}`);
  } else {
    if (shouldSendEmail()) {
      try {
        execSync(`node ./src/lib/sendEmailSync.mjs "Uncaught Exception" "${message}"`, {
          stdio: 'inherit',
        });
        log.info('Error notification email sent.');
      } catch (e) {
        log.error(`Failed to send error notification: ${e.message}`);
      }
    } else {
      log.warn(`Not sending email this time.`);
    }
  }

  const backoffTime = getBackoffTime();
  log.info(`Restarting in ${backoffTime} seconds...`);

  setTimeout(() => {
    cleanup(1)
      .then(() => process.exit(1))
      .catch((e) => {
        log.error(`Cleanup error: ${e.message}`);
        process.exit(1);
      });
  }, backoffTime * 1000);
});
process.on('SIGUSR1', async () => {
  try {
    await positionSave();
  } catch (e) {
    log.error(e.message);
  }
});
process.on('SIGHUP', async () => {
  try {
    await reloadPositions();
  } catch (e) {
    log.error(e.message);
  }
});
process.on('SIGUSR2', async () => {
  try {
    await positionFireSale();
  } catch (e) {
    log.error(e.message);
  }
});
/**
 * Initializes the application
 */
log.info(`-----------STARTUP ${version}-----------`);

checkEnvironment();
await getSigningKeys();
await tickerChannel.initialize();
// all positions pull down open orders on init, so we don't need the initial burst of status updates
// however, we do need to receive updates if an order is cancelled during init for re-sizing
await userChannel.initialize();
await accountManager.retrieveAllAccount();

await initializePositions();
await delay(); // wait a second for price data
await printStatusOfAllPositions();

await startServer();

if (E.HELPER_UNDER_SYSTEMCTL) {
  notify.ready();
}

isAppInitialized = true;
await resetBackoffTime();
