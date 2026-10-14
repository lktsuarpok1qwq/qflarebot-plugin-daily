import { createCopyContract } from "../../shared/copy-contract.js";
import { weatherSamples } from "./samples.js";
import { outputTargets, type CopyDeclaration, type SettingsDeclaration } from "../../shared/declarations.js";
import { WEATHER_CARD_COPY, CARD_VARIABLES } from "./cards/copy.js";
import { WEATHER_COPY, WEATHER_FIELDS } from "./copy.js";
export const commands = [{ name: "天气", description: "查询城市天气" }];
export const outputs = outputTargets([
    { id: "help", command: commands[0]!.name },
    { id: "current", command: commands[0]!.name, suffix: " <地点>" },
    { id: "tomorrow", command: commands[0]!.name, suffix: " <地点> 明天" },
]);
function cardVariables(key: string) {
    if (key === "current") { return { temp: CARD_VARIABLES.temp }; }

    if (key === "tomorrow") { return { low: CARD_VARIABLES.low, high: CARD_VARIABLES.high }; }

    const entries = Object.entries(CARD_VARIABLES).filter(([variable]) => {
        if (key === "caption") { return ["city", "date", "current_url", "tomorrow_url"].includes(variable); }

        return !["current_url", "tomorrow_url"].includes(variable)
            && (!["temp", "feels"].includes(variable) || key === "feels");
    });
    return Object.fromEntries(entries);
}
const declaration: CopyDeclaration = {
    id: "weather", title: "天气文案", initial: "current", variablesId: "weatherVariables",
    description: "卡面使用纯文字，温度大字区仅支持数字和单位；图片附言支持 Markdown，图片不可用时发送文字回复",
    samples: weatherSamples,
    outputs,
    fields: {
        ...Object.fromEntries(Object.entries(WEATHER_FIELDS).map(([key, field]) => [key, {
            ...field, category: key === "help" ? "帮助" : ["current", "tomorrow"].includes(key) ? "文字回复" : ["choose", "candidate"].includes(key) ? "地点选择" : "查询提示",
            samples: [key === "choose" || key === "candidate" ? "candidates" : key === "current" || key === "tomorrow" ? "weather" : key],
            sampleNames: key === "current" || key === "tomorrow" ? { weather: field.label } : undefined,
            targets: key === "current" || key === "tomorrow" || key === "help" ? [key] : ["current", "tomorrow"],
            path: ["copy", key], inputId: "weatherCopyBody", default: WEATHER_COPY[key as keyof typeof WEATHER_COPY],
        }])), ...Object.fromEntries(Object.entries(WEATHER_CARD_COPY).map(([key, value]) => ["image_" + key, {
            label: ({ city: "城市", area: "地区", current: "当前温度", tomorrow: "预报温度", condition: "天气", feels: "体感", minimum: "最低温度", humidity: "湿度", wind: "风速", range: "温度范围", day: "白天", night: "夜间", date: "日期", caption: "图片附言" } as Record<string, string>)[key]!,
            category: "图片文案", samples: ["weather"], targets: key === "current" || key === "feels" ? ["current"] : key === "tomorrow" || key === "minimum" ? ["tomorrow"] : ["current", "tomorrow"],
            variables: cardVariables(key), path: ["cardCopy", key], inputId: "weatherCardBody", default: value, allowEmpty: true,
        }]))
    },
    views: outputs.map((target) => ({ id: target.id, targets: [target.id], keys: target.id === "help" ? ["help"] : [target.id, "choose", "candidate", "notFound", "unavailable", ...Object.keys(WEATHER_CARD_COPY).filter((key) => target.id === "current" ? !["tomorrow", "minimum"].includes(key) : !["current", "feels"].includes(key)).map((key) => "image_" + key)] })),
};
export const settings: SettingsDeclaration = {
    id: "weather-settings", title: "和风天气", description: "在和风控制台创建 API Key，复制账号专属 API Host",
    link: { label: "打开和风控制台", url: "https://console.qweather.com" },
    fields: [
        { key: "imageEnabled", id: "weatherImageEnabled", label: "启用图片卡片（T2I）", group: "功能开关", type: "checkbox", hint: "关闭或图片准备失败时发送文字" },
        { key: "host", id: "weatherHost", label: "API Host", type: "text", hint: "填写账号专属域名，例如 h2a9cf3mhs.xy.qweatherapi.com" },
        { key: "apiKey", id: "weatherKey", label: "API Key", type: "password", secret: { saved: "hasKey", clearId: "weatherClearKey" }, hint: "密钥不回显" },
    ],
    test: { action: "test-weather-api", endpoint: "test", resultId: "weatherConnectionResult", hint: "使用当前凭证测试城市搜索、实况和预报，不保存、不发送" },
};

export const copyContract = createCopyContract<{ copy: typeof WEATHER_COPY; cardCopy: typeof WEATHER_CARD_COPY }>(declaration);
export const copyEditor = copyContract.editor;
