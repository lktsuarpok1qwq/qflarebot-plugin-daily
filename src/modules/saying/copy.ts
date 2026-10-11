import { commandLink } from "../../shared/interpolation.js";
export const SAYING_COPY = { body: "💬 {{text}}\n\n" + commandLink("🎲 再来一句", "/一言") };
export const SAYING_VARIABLES = ["一言.今日"] as const;
export const SAYING_DESCRIPTIONS = { "一言.今日": "当天固定的一言完整文案，获取失败时为空" };
export const SAYING_FIELDS = { text: "接口返回的一言内容，仅限一言文案使用" };
