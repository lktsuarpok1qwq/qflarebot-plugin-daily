import type { CopyDeclaration, CopyField } from "./declarations.js";
import { validateCopyText } from "./templates.js";
import { fields } from "./validation.js";

type Branch = { children: Map<string, Branch>; field?: CopyField; variables?: readonly string[]; keys: string[] };
export type CopyContract = ReturnType<typeof createCopyContract>;
function object(value: unknown, label: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) { throw new Error(label + "格式错误"); }

    return value as Record<string, unknown>;
}
export function createCopyContract<Copy extends object>(editor: CopyDeclaration) {
    const tree: Branch = { children: new Map(), keys: [] };
    const compiled = Object.entries(editor.fields).map(([key, field]) => ({ key, field, variables: Object.keys(field.variables) }));
    const outputs = new Set<string>(), views = new Set<string>(), samples = new Set<string>();
    const fail = (message: string): never => { throw new Error(editor.id + "文案声明：" + message); };
    function unique(set: Set<string>, id: string) {
        if (!id || set.has(id)) { fail("标识为空或重复：" + id); }

        set.add(id);
    }
    function references(ids: readonly string[], exists: (id: string) => boolean, label: string) {
        if (new Set(ids).size !== ids.length || ids.some((id) => !exists(id))) { fail(label + "引用无效"); }
    }

    for (const output of editor.outputs) { unique(outputs, output.id); }

    for (const sample of editor.samples ?? []) { unique(samples, sample.id); }

    for (const { key, field, variables } of compiled) {
        if (!field.path.length || !field.category || !field.samples.length) { fail(key + "缺少路径、分类或样例"); }

        let node = tree;

        for (const part of field.path) {
            if (!part || ["__proto__", "prototype", "constructor"].includes(part) || node.field) { fail(key + "字段路径冲突或无效"); }

            let child = node.children.get(part);

            if (!child) { child = { children: new Map(), keys: [] }; node.children.set(part, child); node.keys.push(part); }

            node = child;
        }

        if (node.field || node.children.size) { fail(key + "字段路径重复或冲突"); }

        node.field = field;
        node.variables = variables;
        validateCopyText(field.default, { label: field.label, variables, allowEmpty: field.allowEmpty });
        references(field.targets ?? [], (id) => outputs.has(id), key + "输出");

        if (editor.samples) { references(field.samples, (id) => samples.has(id), key + "样例"); }

        references(Object.keys(field.sampleNames ?? {}), (id) => field.samples.includes(id), key + "情景名称");
    }

    const usedFields = new Set<string>(), usedOutputs = new Set<string>();
    const categories = new Set(compiled.map(({ field }) => field.category));

    for (const [category, parent] of Object.entries(editor.categoryParents ?? {})) {
        if (!categories.has(category) || !categories.has(parent)) { fail("分类层级引用无效：" + category); }

        const ancestors = new Set([category]);
        let current: string | undefined = parent;

        while (current) {
            if (ancestors.has(current)) { fail("分类层级存在循环：" + category); }

            ancestors.add(current);
            current = editor.categoryParents?.[current];
        }
    }

    for (const view of editor.views) {
        unique(views, view.id);

        if (!view.keys.length || !view.targets.length) { fail(view.id + "缺少字段或输出"); }

        references(view.keys, (id) => Object.hasOwn(editor.fields, id), view.id + "字段");
        references(view.targets, (id) => outputs.has(id), view.id + "输出");

        if (editor.samples && view.samples) { references(view.samples, (id) => samples.has(id), view.id + "样例"); }

        for (const key of view.keys) {
            const field = editor.fields[key]!;

            if (!view.targets.some((id) => !field.targets || field.targets.includes(id))) { fail(key + "不适用于入口" + view.id); }

            if (view.samples && !field.samples.some((id) => view.samples!.includes(id))) { fail(key + "在入口" + view.id + "没有适用样例"); }

            usedFields.add(key);
        }

        for (const id of view.targets) { usedOutputs.add(id); }
    }

    if (!views.has(editor.initial) || compiled.some(({ key }) => !usedFields.has(key)) || [...outputs].some((id) => !usedOutputs.has(id))) { fail("初始入口无效或存在未接入的字段、输出"); }

    function check(value: unknown, node: Branch, shapeOnly: boolean, root = false) {
        if (node.field) {
            if (shapeOnly) {
                if (typeof value !== "string") { throw new Error(node.field.label + "格式错误"); }
            } else {
                validateCopyText(value, { label: node.field.label, variables: node.variables!, allowEmpty: node.field.allowEmpty });
            }

            return;
        }

        const data = object(value, editor.title);

        if (!root) { fields(data, node.keys); }

        for (const [key, child] of node.children) {
            if (!Object.hasOwn(data, key)) { throw new Error(editor.title + "缺少字段：" + (child.field?.label ?? key)); }

            check(data[key], child, shapeOnly);
        }
    }
    return {
        editor,
        defaults<const Base extends object>(base: Base): Base & Copy {
            const result = structuredClone(base) as Record<string, unknown>;

            for (const { field } of compiled) {
                let target = result;

                for (const key of field.path.slice(0, -1)) {
                    target[key] ??= {};
                    target = object(target[key], editor.title);
                }

                target[field.path[field.path.length - 1]!] = field.default;
            }

            return result as Base & Copy;
        },
        validate(value: unknown, shapeOnly = false) {
            check(value, tree, shapeOnly, true);
        },
        validateOutputs(scope: { commands?: readonly string[]; variables?: readonly string[] }) {
            for (const output of editor.outputs) {
                if (output.command && !scope.commands?.includes(output.command)) { fail("未声明命令：" + output.command); }

                if (output.variable && !scope.variables?.includes(output.variable)) { fail("未声明变量：" + output.variable); }
            }
        },
    };
}
