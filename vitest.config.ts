import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// The live integration suite under test/integration/ is local-only (gitignored).
// Only wire its env setup file when present, so a fresh clone without it still
// runs the committed unit tests cleanly.
const setupFiles = existsSync("./test/integration/setup-env.ts")
  ? ["./test/integration/setup-env.ts"]
  : [];

export default defineConfig({
  test: {
    setupFiles,
  },
});
