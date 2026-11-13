import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const cached = path.join(
  os.homedir(),
  "Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
);
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  // The local server has one shared notebook and settings record.
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4174",
    viewport: { width: 1512, height: 1100 },
    launchOptions: {
      executablePath:
        process.env.GRADUS_BROWSER ||
        (fs.existsSync(cached) ? cached : undefined),
    },
  },
  webServer: {
    command: `PORT=4174 GRADUS_DB=${path.join(os.tmpdir(), "gradus-browser-" + Date.now() + ".sqlite")} node server.mjs`,
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
  },
});
