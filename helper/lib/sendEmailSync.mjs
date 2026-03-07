import { sendMail } from './email.mjs';
import { log } from '@core/logger.js';

// Get subject and text from command line arguments
const args = process.argv.slice(2);
const subject = args[0];
const text = args[1];

if (!subject || !text) {
  log.error('Please provide both a subject and text as arguments.');
  process.exit(1);
}

sendMail(subject, text).catch((err) => log.error(err.message));
