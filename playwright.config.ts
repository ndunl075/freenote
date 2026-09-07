import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against the real production static export, not the dev server —
 * freenote's whole deployment story is "it's just static files", so the tests
 * should exercise exactly what gets deployed.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : [["list"]],
  timeout: 45_000,

  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    // Ink is pointer-driven; a stable viewport keeps page coordinates
    // predictable across runs.
    viewport: { width: 1280, height: 900 },
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        },
      },
    },
  ],

  webServer: {
    command: "pnpm build && npx serve out -l 4173 --no-clipboard",
    url: "http://127.0.0.1:4173",
    // Never reuse a running server. Reuse skips the build step, which means a
    // green run can silently reflect a stale bundle rather than the working
    // tree — a test suite that can lie about which code it tested is worse
    // than no suite at all.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
