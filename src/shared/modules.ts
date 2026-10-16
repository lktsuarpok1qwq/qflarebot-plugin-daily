import { imageCleanupJobs } from "./image-cleanup.js";
import { installMaintenance } from "./maintenance.js";
import type { CopyContract } from "./copy-contract.js";
import type { CommandInput, CronJob, CronMap, Route, RouteInput, Permission } from "@qqbot/sdk";
import type { CommandExecutor, Ctx, Rendered } from "./types.js";
import { registerCommands, type CommandDefinition } from "./declarations.js";
import { createVariables, type VariableCapability, type VariableAPI } from "./variables.js";
import { validateRoutes } from "./routes.js";
import type { CardBinding } from "./cards/store.js";
import { cardAdminRoutes } from "./cards/admin.js";
import { prepareFont, readAsset } from "./cards/assets.js";
export type ModuleServices = { variables: VariableAPI };
export type ModuleDefinition = {
    id: string;
    title: string;
    permissions?: readonly Permission[];
    install?: (ctx: Ctx) => Promise<void>;
    cleanup?: (ctx: Ctx, scheduledAt: number) => Promise<void | { ok: boolean; message: string }>;
    cleanupImages?: (ctx: Ctx, scheduledAt: number) => Promise<boolean>;
    variables?: VariableCapability;
    copy?: CopyContract;
    cards?: CardBinding;
    commands?: { definitions: readonly CommandDefinition[]; render: (input: CommandInput, name: string, services: ModuleServices) => Promise<Rendered> };
    cron?: Record<string, Omit<CronJob, "name" | "handler"> & { handler: (input: Parameters<CronJob["handler"]>[0], services: ModuleServices) => ReturnType<CronJob["handler"]> }>;
    routes?: readonly Route[];
    admin?: (input: RouteInput, services: ModuleServices) => ReturnType<Route["handler"]>;
    ui?: { source?: string } & ({ factory: string; sections?: never } | { sections: readonly { id: string; title: string; factory: string }[]; factory?: never });
};
export function createModules(modules: readonly ModuleDefinition[], reserved: { pages?: readonly string[]; commands?: readonly string[] } = {}) {
    const ids = new Set(reserved.pages), commands = new Set(reserved.commands), jobs = new Set<string>(), keys = new Set(["日期", "星期"]);
    function unique(seen: Set<string>, value: string, kind: string) {
        if (seen.has(value)) { throw new Error(kind + "重复：" + value); }

        seen.add(value);
    }

    for (const module of modules) {
        if (!/^[a-z][a-z0-9_-]*$/.test(module.id)) { throw new Error("模块标识无效：" + module.id); }

        unique(ids, module.id, "模块");
        module.copy?.validateOutputs({ commands: module.commands?.definitions.map((command) => command.name), variables: module.variables?.variables });

        for (const command of module.commands?.definitions ?? []) { unique(commands, command.name, "命令"); }

        for (const key of module.variables?.variables ?? []) { unique(keys, key, "变量"); }

        for (const job of Object.keys(module.cron ?? {})) { unique(jobs, job, "定时任务"); }

        if (module.ui?.sections) {
            if (!module.ui.sections.length) { throw new Error("模块页面不能为空：" + module.id); }

            const sections = new Set<string>();

            for (const section of module.ui.sections) { unique(sections, section.id, "页面分类"); }
        }
    }

    const hasCards = modules.some(module => module.cards);
    const variables = createVariables(modules);
    const services: ModuleServices = { variables };
    const imageModules = modules.filter(module => module.cleanupImages).map(module => ({ id: module.id, run: module.cleanupImages! }));
    const images = imageModules.length ? imageCleanupJobs(imageModules) : undefined;
    const cleanup = modules.filter((module) => module.cleanup);
    const cron: CronMap = Object.fromEntries(modules.flatMap((module) => Object.entries(module.cron ?? {}).map(([name, job]) => [name, { ...job, handler: (input: Parameters<CronJob["handler"]>[0]) => job.handler(input, services) }])));

    if (cleanup.length || images) {
        unique(jobs, "cleanup", "定时任务");
        cron.cleanup = {
            cron: "10 16 * * *", handler: async ({ ctx, scheduledAt }) => {
                const failures: string[] = [];

                for (const module of cleanup) {
                    try {
                        const result = await module.cleanup!(ctx, scheduledAt);

                        if (result && !result.ok) { throw new Error(result.message); }
                    } catch (error) {
                        failures.push(`${module.id}: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }

                if (images) {
                    try { await images.daily(ctx, scheduledAt); } catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
                }

                if (failures.length) { throw new Error(`模块清理失败：${failures.join("；")}`); }
            },
        };
    }

    if (images) {
        unique(jobs, "image_cleanup", "定时任务");
        cron.image_cleanup = { cron: "* * * * *", handler: ({ ctx, scheduledAt }) => images.resume(ctx, scheduledAt) };
    }

    return {
        variables,
        permissions: [...new Set(modules.flatMap((module) => [...module.permissions ?? [], ...(module.admin || module.cards ? ["admin" as const] : []), ...(module.cards ? ["net" as const] : [])]))],
        get pages() { return modules.flatMap((module) => module.ui ? [{ id: module.id, title: module.title, ...module.ui }] : []); },
        async install(ctx: Ctx) {
            if (cleanup.length || images) { await installMaintenance(ctx.db); }

            for (const module of modules) { module.copy?.assertDeclaration(); await module.install?.(ctx); }

            if (hasCards) {
                for (const weight of [400, 700]) { await prepareFont(ctx, weight); }
            }
        },
        commands(execute: CommandExecutor) {
            return Object.fromEntries(modules.flatMap((module) => module.commands ? Object.entries(registerCommands(module.commands.definitions, execute, (input, name) => module.commands!.render(input, name, services))) : []));
        },
        cron,
        routes: validateRoutes([...(hasCards ? [{ method: "GET" as const, path: "/cards/assets/:asset", auth: "public" as const, handler: readAsset }] : []), ...modules.flatMap((module) => [...module.routes ?? [], ...(module.cards ? cardAdminRoutes(module.id, module.cards) : []), ...(module.admin ? (["GET", "POST"] as const).map((method): Route => ({
            method, path: `/api/${module.id}/:action`, auth: "admin", handler: (input) => module.admin!(input, services),
        })) : [])])]),
    };
}
