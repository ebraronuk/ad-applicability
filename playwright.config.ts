import { defineConfig, devices } from "@playwright/test";

/**
 * The suite runs against a production build, not the dev server: a build is
 * what a reviewer and CI actually run, and dev-only behaviour (overlays, lazy
 * compilation) would make the assertions unreliable.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3111",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npx next start --port 3111",
    url: "http://127.0.0.1:3111",
    reuseExistingServer: !process.env["CI"],
    timeout: 180_000,
  },
});
