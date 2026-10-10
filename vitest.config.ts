import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": fileURLToPath(
        new URL(
          "../QFlareBot/packages/plugin-cli/src/stubs/cloudflare-workers.ts",
          import.meta.url,
        ),
      ),
    },
  },
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
