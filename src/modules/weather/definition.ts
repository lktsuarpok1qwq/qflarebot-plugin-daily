import { createCopyContract } from "../../shared/copy-contract.js";
import { weatherSamples } from "./samples.js";
import { outputTargets, type CopyDeclaration, type SettingsDeclaration } from "../../shared/declarations.js";
import { WEATHER_COPY, WEATHER_FIELDS } from "./copy.js";
export const commands = [{ name: "天气", description: "查询城市天气" }];
export const outputs = outputTargets([
    { id: "help", command: commands[0]!.name },
    { id: "current", command: commands[0]!.name, suffix: " <地点>" },
    { id: "tomorrow", command: commands[0]!.name, suffix: " <地点> 明天" },
]);
const declaration: CopyDeclaration = {
    id: "weather", title: "天气文案", initial: "current", variablesId: "weatherVariables",
    samples: weatherSamples,
    outputs,
    fields: Object.fromEntries(Object.entries(WEATHER_FIELDS).map(([key, field]) => [key, {
        ...field, category: key === "help" ? "帮助" : ["current", "tomorrow"].includes(key) ? "整体文案" : ["choose", "candidate"].includes(key) ? "地点选择" : "查询提示",
        samples: [key === "choose" || key === "candidate" ? "candidates" : key === "current" || key === "tomorrow" ? "weather" : key],
        sampleNames: key === "current" || key === "tomorrow" ? { weather: field.label } : undefined,
        targets: key === "current" || key === "tomorrow" || key === "help" ? [key] : ["current", "tomorrow"],
        path: ["copy", key], inputId: "weatherCopyBody", default: WEATHER_COPY[key as keyof typeof WEATHER_COPY],
    }])),
    views: outputs.map((target) => ({ id: target.id, targets: [target.id], keys: target.id === "help" ? ["help"] : [target.id, "choose", "candidate", "notFound", "unavailable"] })),
};
export const settings: SettingsDeclaration = {
    id: "weather-settings", title: "和风天气", description: "在和风控制台创建 API Key，复制账号专属 API Host",
    link: { label: "打开和风控制台", url: "https://console.qweather.com" },
    fields: [
        { key: "host", id: "weatherHost", label: "API Host", type: "text", hint: "填写账号专属域名，例如 h2a9cf3mhs.xy.qweatherapi.com" },
        { key: "apiKey", id: "weatherKey", label: "API Key", type: "password", secret: { saved: "hasKey", clearId: "weatherClearKey" }, hint: "密钥不回显" },
    ],
    test: { action: "test-weather-api", endpoint: "test", resultId: "weatherConnectionResult", hint: "使用当前凭证测试城市搜索、实况和预报，不保存、不发送" },
};

export const copyContract = createCopyContract<{ copy: typeof WEATHER_COPY }>(declaration);
export const copyEditor = copyContract.editor;
