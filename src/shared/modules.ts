import type { CopyContract } from "./copy-contract.js";
import type { CommandInput, CronJob, Route, RouteInput, Permission } from "@qqbot/sdk";
import type { CommandExecutor, Ctx, Rendered } from "./types.js";
import { registerCommands, type CommandDefinition } from "./declarations.js";
import { createVariables, type VariableCapability, type VariableAPI } from "./variables.js";
export type ModuleServices = { variables: VariableAPI };
export type ModuleDefinition = {
    id: string;
    title: string;
    permissions?: readonly Permission[];
    install?: (ctx: Ctx) => Promise<void>;
    variables?: VariableCapability;
    copy?: CopyContract;
    commands?: { definitions: readonly CommandDefinition[]; render: (input: CommandInput, name: string, services: ModuleServices) => Promise<Rendered> };
    cron?: Record<string, Omit<CronJob, "name" | "handler"> & { handler: (input: Parameters<CronJob["handler"]>[0], services: ModuleServices) => ReturnType<CronJob["handler"]> }>;
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

    const variables = createVariables(modules);
    const services: ModuleServices = { variables };
    return {
        variables,
        permissions: [...new Set(modules.flatMap((module) => [...module.permissions ?? [], ...(module.admin ? ["admin" as const] : [])]))],
        pages: modules.flatMap((module) => module.ui ? [{ id: module.id, title: module.title, ...module.ui }] : []),
        async install(ctx: Ctx) {
            for (const module of modules) { await module.install?.(ctx); }
        },
        commands(execute: CommandExecutor) {
            return Object.fromEntries(modules.flatMap((module) => module.commands ? Object.entries(registerCommands(module.commands.definitions, execute, (input, name) => module.commands!.render(input, name, services))) : []));
        },
        cron: Object.fromEntries(modules.flatMap((module) => Object.entries(module.cron ?? {}).map(([name, job]) => [name, { ...job, handler: (input: Parameters<CronJob["handler"]>[0]) => job.handler(input, services) }]))),
        routes: modules.flatMap((module) => module.admin ? (["GET", "POST"] as const).map((method): Route => ({
            method, path: `/api/${module.id}/:action`, auth: "admin", handler: (input) => module.admin!(input, services),
        })) : []),
    };
}
