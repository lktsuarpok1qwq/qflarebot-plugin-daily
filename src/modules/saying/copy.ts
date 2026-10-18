import { declareVariables } from "../../shared/variables.js";
export const SAYING_COPY = { today: "🌱 {{text}}", body: "💬 {{text}}" };
export const sayingVariables = declareVariables({ "一言.今日": { description: "当天固定的一言完整文案，获取失败时为空", group: "完整文案" } });
export const SAYING_FIELDS = { text: "接口返回的一言内容，仅限一言文案使用" };
