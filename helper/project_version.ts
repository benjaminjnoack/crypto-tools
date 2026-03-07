import { readFile } from 'fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, '..', 'package.json');
let project_version = '';

export async function getVersion() {
  if (!project_version) {
    const data = await readFile(packageJsonPath, 'utf-8');
    const json = JSON.parse(data);
    project_version = json.version;
  }
  return project_version;
}
