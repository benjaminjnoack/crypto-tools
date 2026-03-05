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
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup/no-network.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/shared/bin/**", "src/apps/hdb/cli.ts", "src/apps/cb/cli.ts"],
    },
  },
});
