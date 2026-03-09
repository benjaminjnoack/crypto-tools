import fs from "node:fs/promises";
import path from "node:path";

const sourceDir = path.resolve("src/apps/hdb-portal/public");
const targetDir = path.resolve("dist/apps/hdb-portal/public");

await fs.mkdir(targetDir, { recursive: true });
await fs.cp(sourceDir, targetDir, { recursive: true });
