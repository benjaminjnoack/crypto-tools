import { log } from '@core/logger.js';
import path from 'node:path';
import Position from './Position.mjs';
import delay from '@core/delay.ts';
import { getRandomAlphanumeric } from '@http/httpUtil';
import { getPositionFileNames } from '@core/cache';
import { sendMail } from '@core/email.ts';

/**
 * Position Name, Position
 * @type {Map<string, Position>}
 */
const positions = new Map();

/**
 * /path/to/positions/btc1.json => btc1
 * @param {string} filename
 * @returns {string}
 */
export function getPositionNameFromFileName(filename) {
  return path.basename(filename).split('.')[0];
}

/**
 * Find position, even by product name, throws error if not found
 * @param {string} positionName
 * @returns {Position}
 */
export function findPosition(positionName) {
  if (positions.has(positionName)) {
    return positions.get(positionName);
  }

  const found = [];
  for (const position of positions.values()) {
    if (position.currency.toLowerCase() === positionName.toLowerCase()) {
      found.push(position);
    }
  }

  switch (found.length) {
    case 0:
      throw new Error(`findPosition => cannot find ${positionName}`);
    case 1:
      return found.pop();
    default:
      throw new Error(`findPosition => found ${found.length} positions`);
  }
}

/**
 * Initializes and sets up all positions
 * @returns {Promise<void>}
 */
export async function initializePositions() {
  const positionFilenames = getPositionFileNames();
  const positionPromises = positionFilenames.map(async (positionFilename) => {
    try {
      await randomDelay(positionFilenames.length);
      const positionName = getPositionNameFromFileName(positionFilename);
      const position = new Position(positionName);
      await setupPosition(position);
    } catch (e) {
      log.error(`Error initializing position ${positionFilename}: ${e.message}`);
      await sendMail(
        `Error Initializing Position`,
        `Error initializing ${positionFilename}: ${e.message}`,
      );
    }
  });

  await Promise.all(positionPromises);
  log.info('All positions initialized');
}

/**
 * Sets up a position with event listeners and initializes it
 * @param {Position} position - The position to set up
 * @param {boolean} forceUpdate
 * @returns {Promise<void>}
 */
export async function setupPosition(position, forceUpdate = false) {
  await position.initialize(forceUpdate);
  positions.set(position.positionName, position);
  log.debug(`Setup ${position.positionName}`);
}
/**
 * print status of all positions with line breaks
 */
export async function printStatusOfAllPositions() {
  for (const [name, position] of positions) {
    log.info(
      `*************************************${name}*************************************************`,
    );
    await position.printState();
    log.info(
      `***********************************************************************************************`,
    );
  }
}

/**
 * Generates a random delay to prevent request throttling
 * @param {number} n_positions - Number of positions
 * @returns {Promise<string>}
 */
async function randomDelay(n_positions) {
  return new Promise((resolve) => {
    const delay = Math.random() * (n_positions * 1000);
    setTimeout(() => {
      resolve(`Completed ${delay.toFixed(2)} millisecond delay`);
    }, delay);
  });
}

export function cleanupPositions() {
  positions.forEach((position) => {
    try {
      position.saveJSON();
    } catch (e) {
      log.error(`error saving ${position.positionName}: ${e.message}`);
    }
  });
}

export async function reloadPositions() {
  log.info('Reloading positions...');
  const positionFileNames = getPositionFileNames();
  for (const fileName of positionFileNames) {
    const positionName = getPositionNameFromFileName(fileName);
    if (!positions.has(positionName)) {
      log.info(`Found new position ${positionName}`);
      const position = new Position(positionName);
      await setupPosition(position, true);
      await delay();
      await position.mailState('Position Opened');
    }
  }
}

/*******************************************************************************************************************
 *                                          Position API
 ******************************************************************************************************************/

/**
 * @param {string|null} positionName
 * @returns {{success: string[]}}
 */
function getResponse(positionName = null) {
  const response = {
    success: [],
  };
  if (positionName) {
    response.success.push(positionName);
  }
  return response;
}

/**
 * @param {string} positionName
 * @returns {Promise<{success: string[]}>}
 */
export async function positionAsk(positionName) {
  const position = findPosition(positionName);
  await position.ask();
  return getResponse(position.positionName);
}

/**
 * @param {string} positionName
 * @returns {Promise<{success: string[]}>}
 */
export async function positionBreakEven(positionName) {
  const position = findPosition(positionName);
  await position.breakEven();
  return getResponse(position.positionName);
}

/**
 * @param {string} positionName
 * @returns {Promise<{success: string[]}>}
 */
export async function positionCancel(positionName) {
  const position = findPosition(positionName);
  await position.cancel('API Request');
  return getResponse(position.positionName);
}

export async function positionClear(positionName) {
  if (positionName) {
    const position = findPosition(positionName);
    position.clear();
    positions.delete(positionName);
    return getResponse(position.positionName);
  } else {
    const response = getResponse(null);
    for (const [key, position] of positions) {
      if (position.isCancelled || position.isComplete) {
        position.clear();
        positions.delete(key);
        response.success.push(position.positionName);
      }
    }
    return response;
  }
}

/**
 * @param {string} positionName
 * @returns {Promise<{success: string[]}>}
 */
export async function execPosition(positionName) {
  const position = findPosition(positionName);
  await position.exec();
  return getResponse(position.positionName);
}

/**
 * @param {string} positionName
 * @returns {Promise<{fills: {class: string, side, order_id, filled_value, total_fees, total_value_after_fees}[]}>}
 */
export async function positionFills(positionName) {
  const position = findPosition(positionName);
  return position.fills();
}

export async function positionFireSale() {
  log.warn('FIRE SALE');
  const fireSales = [];

  for (const position of positions.values()) {
    fireSales.push(position.fireSale());
  }

  try {
    await Promise.all(fireSales);
  } catch (error) {
    log.error('An error occurred during the fireSale operations:', error);
  }
}

/**
 * @param {string} positionName
 * @param {string|null} price
 * @param {string|null} stopPrice
 * @param {string|null} targetPrice
 * @param {string|null} orderId
 * @returns {Promise<{success: string[]}>} - actually has errors and modified arrays too
 */
export async function positionModify(positionName, price, stopPrice, targetPrice, orderId) {
  const position = findPosition(positionName);
  const { errors, modified } = await position.modify(price, stopPrice, targetPrice, orderId);
  const response = getResponse(position.positionName);
  response.errors = errors;
  response.modified = modified;
  return response;
}

/**
 * @param {string} product
 * @param {string} price
 * @param {string} value
 * @param {string} target
 * @param {string} stop
 * @returns {Promise<{success: string[]}>}
 */
export async function positionOpen(product, price, value, target, stop) {
  const positionName = `${product}-${getRandomAlphanumeric()}`;
  log.info(`openPosition => opening ${positionName}`);
  const position = new Position(positionName);
  await position.open(product, price, value, target, stop);
  positions.set(position.positionName, position);
  return getResponse(position.positionName);
}

/**
 * @param {string} product
 * @param {string} buyPrice
 * @param {string} value
 * @param {string} takeProfitPrice
 * @param {string} stopPrice
 * @returns {Promise<{success: string[]}>}
 */
export async function positionPrep(product, buyPrice, value, takeProfitPrice, stopPrice) {
  const positionName = `${product}-${getRandomAlphanumeric()}`;
  log.info(`prepPosition => prepping ${positionName}`);
  const position = new Position(positionName);
  await position.prep(product, buyPrice, value, takeProfitPrice, stopPrice);
  positions.set(position.positionName, position);
  return getResponse(position.positionName);
}

/**
 * @param {string} product
 * @param {string} buyPrice
 * @param {string} value
 * @param {string} stopPrice
 * @param {string} schedule
 * @param {string|null} zeroPrice
 * @param {string} onePrice
 * @returns {Promise<{success: string[]}>}
 */
export async function positionPrepWithSchedule(
  product,
  buyPrice,
  value,
  stopPrice,
  schedule,
  zeroPrice,
  onePrice,
) {
  const positionName = `${product}-${getRandomAlphanumeric()}`;
  log.info(`prepPosition => prepping ${positionName}`);
  const position = new Position(positionName);
  await position.prepWithSchedule(
    product,
    buyPrice,
    value,
    stopPrice,
    schedule,
    zeroPrice,
    onePrice,
  );
  positions.set(position.positionName, position);
  return getResponse(position.positionName);
}

/**
 * @returns {Promise<{success: string[]}>}
 */
export async function positionSave() {
  const response = getResponse(null);
  for (const position of positions.values()) {
    try {
      await position.save();
      response.success.push(position.positionName);
    } catch (e) {
      log.error(`${position} ${e.message}`);
    }
  }
  return response;
}

/**
 * @param {string} positionName
 * @param {string} schedule
 * @param {string|null} zeroPrice
 * @param {string} onePrice
 * @returns {Promise<{success: string[]}>}
 */
export async function positionSchedule(positionName, schedule, zeroPrice, onePrice) {
  const position = findPosition(positionName);
  await position.setSchedule(schedule, zeroPrice, onePrice);
  return getResponse(position.positionName);
}

/**
 * @param {string} positionName
 * @returns {Promise<{success: string[]}>}
 */
export async function positionSell(positionName) {
  const position = findPosition(positionName);
  await position.sell();
  return getResponse(position.positionName);
}

/**
 * @param {string} [positionName=""]
 * @returns {Promise<*[]>}
 */
export async function positionState(positionName = '') {
  const positionStates = [];
  if (positionName) {
    const position = findPosition(positionName);
    const state = await position.getState();
    positionStates.push(state);
  } else {
    for (const position of positions.values()) {
      const state = await position.getState();
      positionStates.push(state);
    }
  }
  return positionStates;
}

/**
 * @returns {{}}
 */
export function positionStatuses() {
  const positionStatuses = {};
  positions.forEach((position) => {
    positionStatuses[position.positionName] = position.getPositionStatus();
  });
  return positionStatuses;
}

/**
 * @param {string} positionName
 * @param {string} takeProfitPrice
 * @returns {Promise<{success: string[]}>}
 */
export async function positionTakeProfit(positionName, takeProfitPrice) {
  const position = findPosition(positionName);
  await position.takeProfit(takeProfitPrice);
  return getResponse(position.positionName);
}

/**
 * @param {string} positionName
 * @param {string} stopLossPrice
 * @param {string} targetPrice
 * @returns {Promise<{success: string[]}>}
 */
export async function positionTrail(positionName, stopLossPrice, targetPrice) {
  const position = findPosition(positionName);
  await position.trail(stopLossPrice, targetPrice);
  return getResponse(position.positionName);
}
