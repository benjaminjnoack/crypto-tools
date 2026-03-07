// file: hdbPaths.js
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';
import { log } from '@core/logger.js';
import promises from 'node:fs/promises';

const ROOT = process.env.HELPER_HDB_ROOT_DIR;
if (!ROOT) throw new Error('HELPER_HDB_ROOT_DIR is not defined in environment.');

/**
 * This is nice because the dir names track with the long form names of the hdb commands
 */
const DIR_STRUCTURE = {
  input: ['coinbase-transactions', 'cointracker-capital-gains'],
  output: [
    'coinbase-transactions',
    'coinbase-lots',
    'cointracker-capital-gains',
    'cointracker-capital-gains-group',
  ],
};

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export const paths = {
  root: ROOT,
  input: {},
  output: {},
};

for (const [category, names] of Object.entries(DIR_STRUCTURE)) {
  const baseDir = path.join(ROOT, category);
  ensureDir(baseDir);

  for (const name of names) {
    const dirPath = path.join(baseDir, name);
    ensureDir(dirPath);
    paths[category][name] = dirPath;
  }
}
// file: hdbPaths.js (continued or top of the file)
export const HdbDir = Object.freeze({
  COINBASE_TRANSACTIONS_INPUT: 'input/coinbase-transactions',
  COINTRACKER_CAPITAL_GAINS_INPUT: 'input/cointracker-capital-gains',
  COINTRACKER_TRANSACTIONS_INPUT: 'input/cointracker-transactions',
  COINBASE_TRANSACTIONS_OUTPUT: 'output/coinbase-transactions',
  COINBASE_LOTS_OUTPUT: 'output/coinbase-lots',
  COINTRACKER_CAPITAL_GAINS_OUTPUT: 'output/cointracker-capital-gains',
  COINTRACKER_CAPITAL_GAINS_GROUP_OUTPUT: 'output/cointracker-capital-gains-group',
  COINTRACKER_TRANSACTIONS_OUTPUT: 'output/cointracker-transactions',
});

/**
 * @param {string} relativePath - from HdbDir enum
 * @returns {string} - absolute path
 */
export function getHdbPath(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  ensureDir(fullPath); // optional: ensure on access
  return fullPath;
}

/**
 * @param {string} message
 */
export function gitCommitUpdatedFiles(message = 'Auto-commit hdb changes') {
  try {
    const root = ROOT;
    // Stage all new/modified files under the root
    execSync(`git add -A`, { cwd: root, stdio: 'inherit' });

    // Commit only if there are staged changes
    const status = execSync(`git diff --cached --quiet || echo dirty`, {
      cwd: root,
    })
      .toString()
      .trim();
    if (status === 'dirty') {
      execSync(`git commit -m "${message}"`, { cwd: root, stdio: 'inherit' });
    }
  } catch (err) {
    console.error('gitCommitUpdatedFiles failed:', err.message);
    throw err;
  }
}

/**
 * @param {string} dir - will be passed to getHdbDir
 * @param {string} basename
 * @param {string[]} lines
 * @returns {Promise<number>}
 * @private
 */
export async function writeHbdFile(dir, basename, lines) {
  const filepath = path.join(getHdbPath(dir), basename);
  log.info(`Writing ${filepath}`);
  await promises.writeFile(filepath, lines.join('\n'));
  gitCommitUpdatedFiles(basename);
  return lines.length;
}
