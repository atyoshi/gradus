import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
import path from "node:path";
export default defineConfig({
  ...base,
  testMatch: "**/autosave.spec.ts",
  webServer: {
    command: `PORT=4174 GRADUS_DB=${path.resolve("test-results", "autosave.sqlite")} node server.mjs --dev`,
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
  },
});
