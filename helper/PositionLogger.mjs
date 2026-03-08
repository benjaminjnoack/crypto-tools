import { log } from '@core/logger.ts';

class PositionLogger {
  constructor(product_id) {
    this.product_id = product_id;
  }

  info(message) {
    log.info(`${this.product_id}: ${message}`);
  }

  warn(message) {
    log.warn(`${this.product_id}: ${message}`);
  }

  error(message) {
    log.error(`${this.product_id}: ${message}`);
  }

  debug(message) {
    log.debug(`${this.product_id}: ${message}`);
  }
}

export default PositionLogger;
