import { endClient, getClient } from '../client.js';
import { log } from '@core/logger.js';
import { env } from '@boot/env';
const E = env();

/**
 * Wrapper to provide and end database client
 * @param {function} handler
 * @param {object} options
 * @returns {Promise<void>}
 */
export async function handleAction(handler, options) {
  const { debug } = options;
  if (debug) {
    E.HELPER_LOG_LEVEL = 'debug';
  }
  let client;
  try {
    client = await getClient();
    const res = await handler(options);
    if (debug) {
      console.dir(res);
    }
  } catch (e) {
    log.error(e.message);
  } finally {
    if (client) await endClient();
    process.stdin.pause();
  }
}

/**
 * Wrapper to provide and end database client
 * @param {function} handler
 * @param {string} arg
 * @param {object} options
 * @returns {Promise<void>}
 */
export async function handleActionWithArgument(handler, arg, options) {
  const { debug } = options;
  if (debug) {
    E.HELPER_LOG_LEVEL = 'debug';
  }
  let client;
  try {
    client = await getClient();
    const res = await handler(arg, options);
    if (debug) {
      console.dir(res);
    }
  } catch (e) {
    log.error(e.message);
  } finally {
    if (client) await endClient();
    process.stdin.pause();
  }
}

/**
 * @returns {Promise<void>}
 */
export async function handleTestAction() {
  const client = await getClient();
  const res = await client.query('SELECT NOW()');
  console.log(res.rows[0]['now']);
}
