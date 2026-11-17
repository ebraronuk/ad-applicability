import { defineConfig } from "vitest/config";

// e2e/ belongs to Playwright; vitest would try to run it with the wrong runner.
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
});
