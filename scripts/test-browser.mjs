import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "test/browser.test.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DAILY_BROWSER: process.env.DAILY_BROWSER || "1",
    },
  },
);
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
