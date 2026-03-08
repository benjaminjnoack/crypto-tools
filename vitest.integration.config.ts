import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "#shared": path.join(rootDir, "src/shared"),
      "#cb": path.join(rootDir, "src/apps/cb"),
      "#hdb": path.join(rootDir, "src/apps/hdb"),
    },
  },
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    exclude: ["helper/**"],
  },
});
