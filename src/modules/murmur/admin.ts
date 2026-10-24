import type { RouteInput } from "@qqbot/sdk";
import { adminHandler, configAdmin } from "../../shared/admin.js";
import { AdminError, validateInput } from "../../shared/admin-errors.js";
import { body } from "../../shared/request.js";
import { fields } from "../../shared/validation.js";
import { dateAt } from "../../shared/date.js";
import { copyContract } from "./definition.js";
import { MAX_BATCH, validateText } from "./config.js";
import { addEntries, deleteEntry, entries, entry, moveEntry, save, saveEntry, snapshot } from "./repository.js";

const config = configAdmin({ label: "絮语", snapshot, save, present: state => state, declaration: () => ({ copyEditor: copyContract.editor }) });

function presentEntry<T extends { usedDay: string | null }>(value: T, day = dateAt(Date.now())) {
    return { ...value, locked: value.usedDay === day };
}

function integer(value: unknown, allowZero = false): number {
    if (!Number.isSafeInteger(value) || (value as number) < (allowZero ? 0 : 1)) { throw new Error("文案编号或版本无效"); }

    return value as number;
}

export const api = adminHandler({ GET: ["state", "entries", "entry"], POST: ["config", "entry-save", "entry-delete", "entries-add", "entry-move"] }, async (input: RouteInput) => {
    const { ctx, params, request } = input;

    if (params.action === "state" || params.action === "config") { return config(input); }

    if (request.method === "GET") {
        const query = new URL(request.url).searchParams;

        if (params.action === "entry") { return Response.json(presentEntry(await entry(ctx.db, validateInput(() => integer(Number(query.get("id"))))))); }

        const status = query.get("status") ?? "queued";

        if (!["queued", "used"].includes(status)) { throw new AdminError("validation", "文案状态无效"); }

        const cursor = validateInput(() => integer(Number(query.get("after") ?? 0), true));

        const result = await entries(ctx.db, status === "used", cursor), day = dateAt(Date.now());

        return Response.json({ ...result, items: result.items.map(row => presentEntry(row, day)) });
    }

    const data = await body(request);

    if (params.action === "entries-add") {
        const texts = validateInput(() => {
            fields(data, ["texts"]);

            if (!Array.isArray(data.texts) || !data.texts.length || data.texts.length > MAX_BATCH) { throw new Error("每批请录入 1～" + MAX_BATCH + " 篇文案"); }

            for (const text of data.texts) { validateText(text); }

            return data.texts as string[];
        });

        return Response.json({ items: (await addEntries(ctx.db, texts)).map(row => presentEntry(row)) });
    }

    if (params.action === "entry-move") {
        const move = validateInput(() => {
            fields(data, ["id", "revision", "direction"]);

            if (data.direction !== "up" && data.direction !== "down") { throw new Error("移动方向无效"); }

            return { id: integer(data.id), revision: integer(data.revision), direction: data.direction as "up" | "down" };
        });

        return Response.json({ items: await moveEntry(ctx.db, move.id, move.revision, move.direction) });
    }

    const id = validateInput(() => {
        fields(data, params.action === "entry-save" ? ["id", "revision", "text"] : ["id", "revision"]);

        return data.id === null && params.action === "entry-save" ? null : integer(data.id);
    });
    const revision = validateInput(() => integer(data.revision, id === null));

    if (id === null && revision !== 0) { throw new AdminError("validation", "新增文案版本无效"); }

    if (params.action === "entry-save") {
        const text = validateInput(() => {
            validateText(data.text);

            return data.text;
        });

        return Response.json(presentEntry(await saveEntry(ctx.db, id, revision, text)));
    }

    await deleteEntry(ctx.db, id!, revision);

    return Response.json({ ok: true });
});
