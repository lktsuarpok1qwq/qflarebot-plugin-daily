import type { Command, CommandInput } from "@qqbot/sdk";
import type { CommandExecutor, Rendered } from "./types.js";
import type { VariableComposition } from "./variables.js";
export type CommandDefinition = { name: string; description: string };
export type OutputDefinition = {
    id: string;
    suffix?: string;
} & (
        | { command: string; variable?: never; label?: never }
        | { variable: string; command?: never; label?: never }
        | { label: string; command?: never; variable?: never }
    );
export type CopyField = {
    label: string;
    category: string;
    samples: readonly string[];
    sampleNames?: Readonly<Record<string, string>>;
    variables: Readonly<Record<string, string>>;
    path: readonly string[];
    default: string;
    inputId?: string;
    uses?: readonly string[];
    targets?: readonly string[];
};
export type CopyView = { samples?: readonly string[]; id: string; keys: readonly string[]; targets: readonly string[] };
export type CopySample = {
    id: string;
    name: string;
    values?: Record<string, string>;
    fragments?: Record<string, string>;
};
export type CopyDeclaration = {
    id: string;
    title: string;
    initial: string;
    description?: string;
    variablesId?: string;
    categoryParents?: Readonly<Record<string, string>>;
    variableCompositions?: Readonly<Record<string, VariableComposition>>;
    samples?: readonly CopySample[];
    fields: Record<string, CopyField>;
    views: readonly CopyView[];
    outputs: readonly OutputTarget[];
};
export type OutputTarget = OutputDefinition & { name: string };
export function outputTargets(outputs: readonly OutputDefinition[]): OutputTarget[] {
    return outputs.map((output) => {
        const name = output.variable ? "{{" + output.variable + "}}" : output.command ? "/" + output.command + (output.suffix ?? "") : output.label!;
        return { ...output, name };
    });
}
export function registerCommands(definitions: readonly CommandDefinition[], execute: CommandExecutor, render: (input: CommandInput, name: string) => Promise<Rendered>): Record<string, Command> {
    return Object.fromEntries(definitions.map(({ name, description }) => [name, {
        description, scenes: ["group", "c2c"], handler: (input: CommandInput) => execute(input, name, () => render(input, name)),
    }]));
}
export type SettingField = {
    key: string;
    id: string;
    label: string;
    type: "text" | "password" | "number" | "checkbox" | "select";
    hint?: string;
    valueType?: "number";
    options?: readonly { id: string; name: string }[];
    secret?: { saved: string; clearId: string };
};
export type SettingsDeclaration = {
    id: string;
    title: string;
    description?: string;
    link?: { label: string; url: string };
    fields: readonly SettingField[];
    test?: { action: string; endpoint: string; resultId: string; hint: string };
};
