import { createCopyContract } from "../shared/copy-contract.js";
import { outputTargets, type CopyDeclaration, type SettingsDeclaration } from "../shared/declarations.js";
import { COPY } from "../copy.js";
export const commands = [{ name: "每日", description: "每日助手帮助" }];
export const outputs = outputTargets([
    { id: "command:每日", command: commands[0]!.name },
    { id: "feedback:error", label: "命令处理失败" },
    { id: "feedback:tooLong", label: "消息过长" },
]);
const declaration: CopyDeclaration = {
    id: "reply", title: "系统文案", initial: "command:每日", outputs,
    fields: Object.fromEntries(outputs.map((target) => {
        const feedback = !target.command, key = target.id.split(":")[1]!;
        return [target.id, {
            label: target.name!, category: feedback ? "通用提示" : "帮助", samples: [target.id], inputId: "reply-body", path: feedback ? ["commandFeedback", key] : ["replies", key, "body"],
            default: feedback ? COPY.commandFeedback[key as keyof typeof COPY.commandFeedback] : COPY.replies.每日.body,
            variables: { year: "当前年份", today: "今天日期", ...(!feedback ? { commands: "模块一级命令链接，点击发送" } : {}) },
            uses: feedback ? ["所有命令"] : undefined,
        }];
    })),
    views: outputs.map((target) => ({ id: target.id, keys: [target.id], targets: [target.id] })),
};

export const copyContract = createCopyContract<{ replies: typeof COPY.replies; commandFeedback: typeof COPY.commandFeedback }>(declaration);
export const copyEditor = copyContract.editor;
copyContract.validateOutputs({ commands: commands.map((command) => command.name) });

export const settings: SettingsDeclaration = {
    id: "image-settings", title: "图片设置",
    fields: [{ key: "imagePublicUrl", id: "imagePublicUrl", label: "图片公开地址", type: "text", hint: "填写当前 R2 桶的 HTTPS 自定义域名，例如 https://img.example.com，留空使用机器人地址" }],
};
