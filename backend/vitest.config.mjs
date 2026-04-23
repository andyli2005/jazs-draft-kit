import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./tests/setup.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      all: true,
      include: [
        "auth/index.js",
        "controllers/**/*.js",
        "db/index.js",
        "services/**/*.js",
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 75,
        statements: 85,
      },
    },
  },
});
