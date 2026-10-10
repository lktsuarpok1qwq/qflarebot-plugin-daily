import { it, expect } from "vitest";
import { chromium, type Browser } from "playwright-core";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { fixture } from "./db.js";
import { HTML } from "../src/ui.js";
import { api } from "../src/admin.js";
import { exportBackup } from "../src/data/backup.js";

it.skipIf(!process.env.DAILY_BROWSER)(
  "真实 QFlareBot Bridge + sandbox/CSP：编辑、主题、确认、重试、备份恢复",
  async () => {
    const e = await fixture();
    const saved = await exportBackup(e.ctx);
    const root = new URL("../../QFlareBot/", import.meta.url);
    const esbuild = createRequire(
      new URL("packages/plugin-cli/package.json", root),
    )("esbuild");
    const bundle = async (name: string) =>
      (
        await esbuild.build({
          entryPoints: [
            fileURLToPath(
              new URL("packages/ui-bridge/src/" + name + ".ts", root),
            ),
          ],
          bundle: true,
          write: false,
          format: "esm",
        })
      ).outputFiles[0].text;
    const bridge = await bundle("index"),
      host = await bundle("host"),
      tokens = await readFile(
        new URL("packages/ui-bridge/src/tokens.css", root),
        "utf8",
      );
    const routes = await readFile(
      new URL("packages/runtime/src/routes.ts", root),
      "utf8",
    );
    const sandbox = routes.match(
      /const ADMIN_PAGE_CSP = 'sandbox ([^']+)'/,
    )![1]!;
    expect(sandbox).not.toContain("allow-modals");
    let dropTest = true;
    const server = createServer(async (req, res) => {
      try {
        res.setHeader("access-control-allow-origin", "*");
        res.setHeader(
          "access-control-allow-headers",
          "authorization,content-type",
        );
        if (req.method === "OPTIONS") {
          res.end();
          return;
        }
        const url = new URL(req.url!, "http://localhost");
        if (url.pathname === "/") {
          res.setHeader("content-type", "text/html");
          res.end(
            `<iframe sandbox="${sandbox}" style="width:100%;height:1200px" src="/p/daily/ui/?token=bridge-secret"></iframe><script type="module">import {attachBridgeHost} from '/host.js';window.host=attachBridgeHost({iframe:document.querySelector('iframe'),plugin:'daily',base:'/p/daily',theme:'light',getToken:async()=>'bridge-secret'});</script>`,
          );
          return;
        }
        if (url.pathname === "/p/daily/ui/") {
          res.setHeader("content-security-policy", "sandbox " + sandbox);
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.end(HTML);
          return;
        }
        if (["/bridge.js", "/host.js", "/tokens.css"].includes(url.pathname)) {
          res.setHeader(
            "content-type",
            url.pathname.endsWith(".css")
              ? "text/css"
              : "application/javascript",
          );
          res.end(
            url.pathname === "/bridge.js"
              ? bridge
              : url.pathname === "/host.js"
                ? host
                : tokens,
          );
          return;
        }
        if (url.pathname.startsWith("/p/daily/api/")) {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const action = url.pathname.split("/").pop()!;
          const response = await api({
            ctx: e.ctx,
            request: new Request("http://localhost" + req.url, {
              method: req.method,
              headers: { "content-type": "application/json" },
              ...(req.method === "POST"
                ? { body: Buffer.concat(chunks).toString() }
                : {}),
            }),
            params: { action },
            authenticated: req.headers.authorization === "Bearer bridge-secret",
          });
          if (action === "test" && dropTest) {
            dropTest = false;
            res.statusCode = 503;
            res.end(JSON.stringify({ error: "模拟发送结果响应丢失" }));
            return;
          }
          res.statusCode = response.status;
          res.setHeader("content-type", "application/json");
          res.end(await response.text());
          return;
        }
        res.statusCode = 404;
        res.end();
      } catch (error) {
        res.statusCode = 500;
        res.end(String(error));
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({
        executablePath:
          process.env.DAILY_BROWSER === "1"
            ? undefined
            : process.env.DAILY_BROWSER,
        headless: true,
      });
      const page = await browser.newPage({ colorScheme: "light" });
      const scriptErrors: string[] = [];
      page.on("pageerror", (error) => scriptErrors.push(error.message));
      await page.addInitScript(() => {
        window.confirm = () => {
          throw Error("native confirm called");
        };
        window.prompt = () => {
          throw Error("native prompt called");
        };
      });
      await page.goto(
        `http://127.0.0.1:${(server.address() as { port: number }).port}/`,
      );
      const frame = page.frameLocator("iframe");
      const idle = () => frame.locator("body:not(.busy)").waitFor();
      await frame.locator('[data-action="edit-override"]').waitFor();
      await idle();
      expect(await frame.locator("nav button").count()).toBe(5);
      await page.evaluate("host.setTheme('dark')");
      await frame.locator('html[data-theme="dark"]').waitFor();
      expect(
        await frame
          .locator("body")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      ).toBe("rgb(11, 15, 13)");
      await frame.locator('[data-action="edit-override"]').click();
      await frame.locator("#decision[open]").waitFor();
      await frame.locator("#decisionValue").fill("沙箱中的 {{date.today}}");
      await frame.locator("#decisionAccept").click();
      await idle();
      await frame.locator('[data-action="preview"]').click();
      await idle();
      expect(await frame.locator("#previewResult").textContent()).toContain(
        "沙箱中的",
      );
      for (let i = 0; i < 2; i++) {
        await frame.locator('[data-action="test"]').click();
        expect(await frame.locator("#decision[open]").count()).toBe(0);
        await idle();
      }
      expect(e.send).toHaveBeenCalledTimes(1);
      expect(await frame.locator("#previewResult").textContent()).toContain(
        "duplicate",
      );
      await frame.locator('[data-action="delete-task"]').click();
      await frame.locator("#decisionCancel").click();
      await idle();
      expect(await frame.locator('[data-action="delete-task"]').count()).toBe(
        1,
      );
      await frame.locator('[data-action="delete-task"]').click();
      await frame.locator("#decisionAccept").click();
      await idle();
      expect(await frame.locator('[data-action="delete-task"]').count()).toBe(
        0,
      );
      await frame.locator('[data-action="page"][data-id="status"]').click();
      await idle();
      await frame.locator("#backupFile").setInputFiles({
        name: "backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(saved)),
      });
      await idle();
      await frame.locator('[data-action="preview-restore"]').click();
      await idle();
      await frame.locator('[data-action="restore"]').click();
      await frame.locator("#decisionAccept").click();
      await idle();
      expect(await frame.locator("#status").textContent()).toContain(
        "恢复完成",
      );
      const download = page.waitForEvent("download");
      await frame.locator('[data-action="export-backup"]').click();
      await idle();
      const file = await download;
      expect(
        JSON.parse(await readFile((await file.path())!, "utf8")).config.tasks,
      ).toHaveLength(1);
      expect(scriptErrors).toEqual([]);
    } finally {
      await browser?.close();
      server.close();
      await once(server, "close");
    }
  },
  30_000,
);
