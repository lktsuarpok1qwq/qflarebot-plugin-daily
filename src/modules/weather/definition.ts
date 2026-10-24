import { createCopyContract } from "../../shared/copy-contract.js";
import { weatherSamples } from "./samples.js";
import { outputTargets, type CopyDeclaration, type SettingsDeclaration } from "../../shared/declarations.js";
import { WEATHER_CARD_COPY, CARD_VARIABLES } from "./cards/copy.js";
import { WEATHER_COPY, WEATHER_FIELDS } from "./copy.js";

export const commands = [{ name: "天气", description: "查询城市天气" }];
export const outputs = outputTargets([
    { id: "help", command: commands[0]!.name },
    { id: "current", command: commands[0]!.name, suffix: " <地点>" },
]);

function cardVariables(key: string) {
    if (key === "current") { return { temp: CARD_VARIABLES.temp }; }

    const entries = Object.entries(CARD_VARIABLES).filter(([variable]) => {
        if (key === "caption") { return ["city", "date", "current_url"].includes(variable); }

        return variable !== "current_url"
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
            ...field, ...(key === "candidate" ? { buttons: false as const } : {}), category: key === "help" ? "帮助" : key === "current" ? "文字回复" : ["choose", "candidate"].includes(key) ? "地点选择" : "查询提示",
            samples: [key === "choose" || key === "candidate" ? "candidates" : key === "current" ? "weather" : key],
            sampleNames: key === "current" ? { weather: field.label } : undefined,
            targets: key === "current" || key === "help" ? [key] : ["current"],
            path: ["copy", key], inputId: "weatherCopyBody", default: WEATHER_COPY[key as keyof typeof WEATHER_COPY],
        }])), ...Object.fromEntries(Object.entries(WEATHER_CARD_COPY).map(([key, value]) => ["image_" + key, {
            label: ({ city: "城市", area: "地区", current: "当前温度", condition: "天气", feels: "体感", humidity: "湿度", wind: "风速", range: "温度范围", day: "白天", night: "夜间", date: "日期", caption: "图片附言" } as Record<string, string>)[key]!,
            ...(key !== "caption" ? { buttons: false as const } : {}), category: "图片文案", samples: ["weather"], targets: ["current"],
            variables: cardVariables(key), path: ["cardCopy", key], inputId: "weatherCardBody", default: value, allowEmpty: true,
        }]))
    },
    views: outputs.map((target) => ({ id: target.id, targets: [target.id], keys: target.id === "help" ? ["help"] : [target.id, "choose", "candidate", "notFound", "unavailable", ...Object.keys(WEATHER_CARD_COPY).map((key) => "image_" + key)] })),
};
export const connectionFields = [
    { key: "host", id: "weatherHost", label: "API Host", type: "text", maxLength: 200, pattern: String.raw`(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+qweatherapi\.com`, hint: "填写账号专属域名，例如 h2a9cf3mhs.xy.qweatherapi.com" },
    { key: "apiKey", id: "weatherKey", label: "API Key", type: "password", maxLength: 256, pattern: String.raw`[A-Za-z0-9_\-]+`, secret: { saved: "hasKey" }, hint: "密钥不回显" },
] as const;
export const settings: SettingsDeclaration = {
    id: "weather-settings", title: "和风天气", description: "在和风控制台创建 API Key，复制账号专属 API Host",
    link: { label: "打开和风控制台", url: "https://console.qweather.com" },
    fields: [
        { key: "imageEnabled", id: "weatherImageEnabled", label: "启用图片卡片（T2I）", group: "功能开关", type: "checkbox", hint: "关闭或图片准备失败时发送文字" },
        ...connectionFields,
    ],
    test: { action: "test-weather-api", endpoint: "test", resultId: "weatherConnectionResult", hint: "使用当前凭证测试城市搜索、实况和预报，不保存、不发送" },
};

export const copyContract = createCopyContract<{ copy: typeof WEATHER_COPY; cardCopy: typeof WEATHER_CARD_COPY }>(declaration);
export const copyEditor = copyContract.editor;
