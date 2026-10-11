import type { Command, CronJob, Route, DBStatement } from "@qqbot/sdk";
import type { Ctx, RestorePart, CommandExecutor } from "../shared/types.js";
export type ModuleAPI = {
    id: string;
    install: (ctx: Ctx) => Promise<void>;
    variables?: readonly string[];
    variableGroups?: readonly { label: string; variables: readonly string[] }[];
    variableDescriptions?: Readonly<Record<string, string>>;
    createResolver?: (ctx: Ctx) => (at: number) => Promise<Record<string, string>>;
    commands: (execute: CommandExecutor) => Record<string, Command>;
    cron?: Record<string, Omit<CronJob, "name">>;
    routes: Route[];
    ui: { title: string; source: string; factory: string };
    backup: {
        read: DBStatement[];
        decode: (rows: { results: unknown[] }[]) => { revision: number; data: unknown };
        validate: (value: unknown) => Promise<void>;
        restore: (value: unknown, revision: number, now: number) => RestorePart;
    };
};
