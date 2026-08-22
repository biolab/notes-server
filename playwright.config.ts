import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 3210);
const BASE_URL = `http://localhost:${PORT}`;
const NOTES_CONFIG = path.resolve(__dirname, "e2e", "notes.config.yml");

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results/e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "yarn e2e:bootstrap && yarn dev",
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      NOTES_CONFIG,
      NEXT_PUBLIC_DEVELOPMENT: "true",
      SHOW_UNPUBLISHED: "true",
    },
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "mobile-webkit-iphone",
      use: {
        ...devices["iPhone 13"],
        browserName: "webkit",
      },
    },
  ],
});
