import type { VariableProvider } from "../shared/variables.js";
import type { Command, CronJob, Route } from "@qqbot/sdk";
import type { Ctx, CommandExecutor } from "../shared/types.js";
export type ModuleAPI = VariableProvider & {
    install: (ctx: Ctx) => Promise<void>;
    initialConfig?: () => Record<string, unknown>;
    commands?: (execute: CommandExecutor) => Record<string, Command>;
    cron?: Record<string, Omit<CronJob, "name">>;
    admin: Route["handler"];
    ui: { title: string; source: string; factory: string };
};
