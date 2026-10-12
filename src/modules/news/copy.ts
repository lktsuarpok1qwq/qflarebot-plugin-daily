import { commandLink } from "../../shared/interpolation.js";
import { declareVariables } from "../../shared/variables.js";
export const NEWS_COPY = {
    help: "📰 **新闻**\n\n" + commandLink("🔎 搜索新闻", "/新闻 搜 ", false) + "\n" + commandLink("📰 今日精选", "/新闻 游戏") + " ｜ " + commandLink("📌 我的关注", "/新闻 游戏 订阅") + "\n" + commandLink("🌍 发现", "/新闻 游戏 发现") + " ｜ " + commandLink("🕒 最近三天", "/新闻 游戏 最新"),
    body: "🎮 游戏新闻 · {{date}}\n\n{{groups}}{{navigation}}",
    subscribed: "📌 订阅资讯\n{{items}}",
    discovery: "🌍 发现\n{{items}}",
    latest: "🕒 最近三天\n{{items}}",
    item: "{{index}}. [{{title}}]({{url}})\n   {{source}} · {{time}}\n\n",
    navigation: "📖 {{page}} / {{pages}} 页 {{previous}}{{next}}",
    previous: "[⬅️ 上一页]({{url}}) ",
    next: "[下一页 ➡️]({{url}})",
    empty: "📰 暂时没有符合条件的新闻\n" + commandLink("看看最近三天", "/新闻 游戏 最新"),
    unavailable: "🛠️ 暂时无法获取新闻，请稍后再来看看",
    invalid: "🔢 页码请输入正整数，例如 /新闻 游戏 最新 2",
    outOfRange: "📖 已经没有这一页了\n" + commandLink("返回今日精选", "/新闻 游戏"),
};
export type NewsCopy = typeof NEWS_COPY;
export const newsVariables = declareVariables({ "新闻.游戏": { description: "当天订阅优先的新闻简报，无合格新闻时为空", group: "完整文案" } });
export const ITEM_FIELDS = { index: "本页序号", title: "新闻标题", url: "原文链接", source: "新闻来源", time: "发布时间", game: "匹配到的订阅游戏，未匹配时为空", category: "识别出的新闻类型，未知时为空" };

export const SEARCH_COPY = {
    body: "🔎 {{query}}\n\n{{results}}",
    item: "{{index}}. [{{title}}]({{url}})\n   {{source}} · {{time}}\n\n",
    empty: "🔎 没有找到与「{{query}}」相关的中文新闻，换个关键词试试",
    usage: "🔎 输入关键词搜索新闻，例如 /新闻 搜 人工智能\n" + commandLink("填写关键词", "/新闻 搜 ", false),
};
export type SearchCopy = typeof SEARCH_COPY;
export const SEARCH_FIELDS = { index: "本次序号", title: "新闻标题", url: "文章链接，可能是转载页面", source: "新闻来源", time: "发布时间，缺失时为空" };
