import { it, expect } from "vitest";
import { buildPlugin } from "@qqbot/plugin-cli";
import { mkdtemp, cp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
it("宿主安装构建不依赖插件本地 node_modules，清单与产物自包含", async () => {
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
        version: "1.4.0",
        type: "module",
      }),
    );
    const result = await buildPlugin({ cwd: dir });
    expect(result.thirdPartyPackages).toEqual([]);
    expect(result.manifest.apiVersion).toBe(2);
    expect(result.manifest.hasMiddleware).toBe(false);
    expect(result.manifest.services).toEqual([]);
    expect(result.manifest.routes.every((r) => r.auth === "admin")).toBe(true);
    expect(result.manifest.cron.find((c) => c.name === "sync")?.cron).toBe(
      "10,11,12 19 * * *",
    );
    expect(result.manifest.commands.some((c) => c.name === "每日 下次")).toBe(
      false,
    );
    const bundle = await readFile(result.outFile, "utf8");
    expect(bundle).not.toContain("node:sqlite");
    expect(bundle).not.toContain("playwright");
    expect(bundle).not.toMatch(/(?:window\.)?(?:confirm|prompt)\(/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
