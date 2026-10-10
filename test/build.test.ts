import { it, expect } from "vitest";
import { buildPlugin } from "@qqbot/plugin-cli";
import { mkdtemp, cp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runCommand } from "@qqbot/sdk/testing";
import { database } from "./db.js";
import { COPY } from "../src/copy.js";
it("宿主安装构建不依赖插件本地 node_modules，清单与产物自包含", async () => {
  const currentPackage = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const dir = await mkdtemp(join(tmpdir(), "daily-install-"));
  try {
    await cp(
      fileURLToPath(new URL("../src", import.meta.url)),
      join(dir, "src"),
      { recursive: true },
    );
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({
        name: "qflarebot-plugin-daily",
        version: currentPackage.version,
        type: "module",
      }),
    );
    const result = await buildPlugin({ cwd: dir });
    expect(result.thirdPartyPackages).toEqual([]);
    expect(result.manifest.apiVersion).toBe(2);
    expect(result.manifest.routes.every((r) => r.auth === "admin")).toBe(true);
    expect(result.manifest.cron.find((c) => c.name === "sync")?.cron).toBe(
      "10,11,12,13 19 * * *",
    );
    const bundle = await readFile(result.outFile, "utf8");
    expect(bundle).not.toContain("node:sqlite");
    expect(bundle).not.toContain("playwright");
    // Exercise the deployed bundle, including default-copy initialization.
    const deployed = (await import(pathToFileURL(result.outFile).href)).default;
    const e = database();
    await deployed.hooks.onInstall(e.ctx);
    const help = await runCommand(deployed, "每日", "", {
      ctx: { db: e.db, botId: "bot" },
    });
    expect(help.replies).toEqual([{ text: COPY.replies.每日.body }]);
    const stateRoute = deployed.routes.find(
      (r: { method: string; path: string }) =>
        r.method === "GET" && r.path === "/api/:action",
    );
    const response = await stateRoute.handler({
      ctx: e.ctx,
      authenticated: true,
      params: { action: "state" },
      request: new Request("https://test/p/daily/api/state"),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      config: { replies: COPY.replies },
      replyDefaults: COPY.replies,
      draftDefaults: COPY.drafts,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
