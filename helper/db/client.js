import pkg from 'pg';
const { Client } = pkg;
import { log } from '@core/logger.js';

// Configure the connection
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'AlexJonesWasRight',
  port: 5432,
});

let connected = false;

/**
 * @returns {Promise<Client>}
 */
export async function getClient() {
  if (!connected) {
    await client.connect();
    connected = true;
    log.debug('Client connected successfully.');
  }
  return client;
}

export async function endClient() {
  await client.end();
  log.debug('Connection closed.');
}
