import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/src/**/*.test.ts", "test/setup/no-network.test.ts"],
    exclude: ["helper/**"],
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
