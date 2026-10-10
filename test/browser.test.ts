import { it, expect, vi } from "vitest";
import { chromium, type Browser } from "playwright-core";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { fixture, holidayResponse, referenceResponse } from "./db.js";
import { syncYear } from "../src/modules/holiday/sync.js";
import { HTML } from "../src/ui.js";
import { api } from "../src/admin.js";
import { exportBackup } from "../src/data/backup.js";

it.skipIf(!process.env.DAILY_BROWSER)(
  "真实 QFlareBot Bridge + sandbox/CSP：编辑、主题、确认、重试、备份恢复",
  async () => {
    const e = await fixture();
    await syncYear(e.ctx, 2027, async () =>
      Response.json({
        ...holidayResponse(2027),
        days: referenceResponse().days,
      }),
    );
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
      page.setDefaultTimeout(5000);
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
      await page.evaluate("host.setTheme('dark')");
      await frame.locator('html[data-theme="dark"]').waitFor();
      await frame.locator('[data-action="edit-task"]').click();
      await idle();
      expect(await frame.locator("#weeklyFields").isVisible()).toBe(false);
      expect(await frame.locator("#onceFields").isVisible()).toBe(false);
      await frame.locator("#kind").selectOption("weekly");
      expect(await frame.locator("#weeklyFields").isVisible()).toBe(true);
      expect(await frame.locator("#onceFields").isVisible()).toBe(false);
      await frame.locator("#kind").selectOption("once");
      expect(await frame.locator("#weeklyFields").isVisible()).toBe(false);
      expect(await frame.locator("#onceFields").isVisible()).toBe(true);
      await frame.locator("#kind").selectOption("daily");
      await frame.locator("#taskBody").fill("# 公告\n{{日期}}\n{{假期.概览}}");
      await frame.locator('[data-action="preview-task"]').click();
      await idle();
      expect(await frame.locator("#taskPreview").innerText()).toContain("元旦");
      await frame.locator('[data-action="save-task"]').click();
      await idle();
      expect(await frame.locator("#status").innerText()).toBe("已保存");
      await frame.locator('[data-action="edit-override"]').click();
      await frame.locator("#decision[open]").waitFor();
      await frame.locator("#decisionValue").fill("**沙箱中的** {{日期}}");
      await frame.locator("#decisionAccept").click();
      await idle();
      await frame.locator('[data-action="preview"]').click();
      await idle();
      expect(await frame.locator("#previewResult").textContent()).toContain(
        "沙箱中的",
      );
      expect(await frame.locator("#messagePreview strong").innerText()).toBe(
        "沙箱中的",
      );
      expect(await frame.locator("#messagePreview").innerText()).not.toContain(
        "\\",
      );
      await frame.locator('[data-action="test-task"]').click();
      await idle();
      await frame.locator("#testRecipient").selectOption("r0");
      for (let i = 0; i < 2; i++) {
        await frame.locator('[data-action="send-task-test"]').click();
        expect(await frame.locator("#decision[open]").count()).toBe(0);
        await idle();
      }
      expect(e.send).toHaveBeenCalledTimes(1);
      expect(await frame.locator("#testResult").textContent()).toContain(
        "duplicate",
      );
      expect(await frame.locator("#testResult").textContent()).toContain(
        "发送成功",
      );
      expect(await frame.locator("#testMessage strong").innerText()).toBe(
        "沙箱中的",
      );
      await frame.locator('[data-action="page"][data-id="replies"]').click();
      await idle();
      const rich =
        '# 自定义帮助\n**内容**\n<img src=x onerror="window.previewExecuted=true">\n[坏链接](javascript:alert(1))';
      await frame.locator("#reply-body").fill(rich);
      await frame.locator('[data-action="preview-reply"]').click();
      await idle();
      expect(await frame.locator("#replyPreview strong").innerText()).toBe(
        "内容",
      );
      expect(
        await frame
          .locator("#replyPreview img, #replyPreview script, #replyPreview a")
          .count(),
      ).toBe(0);
      expect(
        await frame
          .locator("body")
          .evaluate(
            () =>
              (window as unknown as { previewExecuted?: boolean })
                .previewExecuted,
          ),
      ).toBeUndefined();
      await frame.locator('[data-action="save-reply"]').click();
      await idle();
      expect(await frame.locator("#status").innerText()).toBe("已保存");
      await frame.locator("#commandName").selectOption("每日 帮助");
      expect(await frame.locator("#reply-body").inputValue()).toContain(
        "自动发送",
      );
      await frame.locator("#commandName").selectOption("每日");
      expect(await frame.locator("#reply-body").inputValue()).toBe(rich);
      await frame.locator('[data-action="reset-reply"]').click();
      await idle();
      await frame.locator("#reply-body").fill("不应保存的临时文案");
      await frame.locator('[data-action="page"][data-id="recipients"]').click();
      await frame.locator("#decisionAccept").click();
      await idle();
      await frame.locator('[data-action="edit-recipient"]').first().click();
      await idle();
      expect(
        await frame.locator("#openid").getAttribute("readonly"),
      ).not.toBeNull();
      expect(await frame.locator("#scene").isDisabled()).toBe(true);
      await frame.locator("#recipientName").fill("重新命名的对象");
      await frame.locator('[data-action="save-recipient"]').click();
      await idle();
      await frame.locator('[data-action="page"][data-id="replies"]').click();
      await idle();
      expect(await frame.locator("#reply-body").inputValue()).not.toContain(
        "不应保存的临时文案",
      );
      await frame.locator('[data-action="page"][data-id="holidays"]').click();
      await idle();
      await frame.locator('[data-action="edit-holiday"]').first().click();
      await frame.locator('[data-action="save-holiday"]').click();
      await idle();
      expect(await frame.locator('[data-action="reset-holiday"]').count()).toBe(
        0,
      );
      await frame.locator('[data-action="edit-holiday"]').first().click();
      await frame.locator("#holidayStart").fill("2027-01-02");
      await frame.locator('[data-action="save-holiday"]').click();
      await idle();
      expect(await frame.locator("#app").innerText()).toContain("2027-01-02");
      const referenceRow = frame.locator("tr").filter({ hasText: "劳动节" });
      expect(await referenceRow.innerText()).toContain(
        "节日日期（放假安排待公布）",
      );
      await referenceRow.locator('[data-action="edit-holiday"]').click();
      await idle();
      expect(await frame.locator("#holidayKind").inputValue()).toBe(
        "reference",
      );
      expect(await frame.locator("#holidayEndField").isVisible()).toBe(false);
      await frame.locator("#holidayStart").fill("2027-05-02");
      await frame.locator('[data-action="save-holiday"]').click();
      await idle();
      expect(await frame.locator("#status").innerText()).toBe("已保存");
      expect(await referenceRow.innerText()).toContain("2027-05-02");
      expect(
        await referenceRow.locator('[data-action="reset-holiday"]').innerText(),
      ).toBe("恢复默认");
      await referenceRow.locator('[data-action="reset-holiday"]').click();
      await idle();
      expect(await frame.locator("#status").innerText()).toBe(
        "已恢复默认，后续跟随接口更新",
      );
      expect(await referenceRow.innerText()).toContain("2027-05-01");
      expect(await referenceRow.innerText()).toContain("UAPI");
      expect(
        await referenceRow.locator('[data-action="reset-holiday"]').count(),
      ).toBe(0);
      await frame.locator('[data-action="new-holiday"]').click();
      await idle();
      await frame.locator("#holidayName").fill("手动假期");
      await frame.locator("#holidayStart").fill("2027-01-01");
      await frame.locator('[data-action="save-holiday"]').click();
      await idle();
      expect(await frame.locator("#status").innerText()).toBe("已保存");
      expect(
        await frame
          .locator("tr")
          .filter({ hasText: "手动假期" })
          .locator('[data-action="reset-holiday"]')
          .count(),
      ).toBe(0);
      await frame
        .locator("#importText")
        .fill('[{"name":"导入假期","start":"2027-01-02"}]');
      await frame.locator('[data-action="preview-import"]').click();
      await idle();
      await frame.locator('[data-action="apply-import"]').click();
      await frame.locator("#decisionAccept").click();
      await idle();
      expect(await frame.locator("#app").innerText()).toContain("导入假期");
      await frame.locator('[data-action="page"][data-id="tasks"]').click();
      await idle();
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
      let sourceFailure = false;
      vi.stubGlobal("fetch", async (url: string) => {
        const year = Number(new URL(url).searchParams.get("year"));
        if (sourceFailure && year === 2026)
          return new Response(null, { status: 503 });
        return Response.json({
          ...holidayResponse(year),
          ...(year === 2027 ? { days: referenceResponse().days } : {}),
        });
      });
      await frame.locator('[data-action="page"][data-id="holidays"]').click();
      await idle();
      await frame.locator('[data-action="sync"]').click();
      await idle();
      expect(await frame.locator("#status").innerText()).toContain(
        "2027 假期数据：已有最新数据",
      );
      expect(await frame.locator("#app").innerText()).toContain(
        "2027-01-01 至 2027-01-03",
      );
      sourceFailure = true;
      await frame.locator('[data-action="sync"]').click();
      await idle();
      expect(await frame.locator("#status.error").innerText()).toContain(
        "HTTP_503",
      );
      expect(scriptErrors).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
      await browser?.close();
      server.close();
      await once(server, "close");
    }
  },
  30_000,
);
