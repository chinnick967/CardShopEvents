import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // DB integration tests share one connection pool — run files serially so
    // the concurrency test's behavior is deterministic.
    fileParallelism: false,
  },
});
