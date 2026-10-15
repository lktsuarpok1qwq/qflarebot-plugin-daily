import { renderSearch } from "./search.js";
import type { ModuleDefinition } from "../../shared/modules.js";
import { expand, commandUrl } from "../../shared/interpolation.js";
import { copyContract, commands } from "./definition.js";
import { NEWS_COPY, newsVariables } from "./copy.js";
import { install } from "./repository.js";
import { command, createResolver } from "./service.js";
import { sync } from "./sync.js";
import { api } from "./admin.js";
import { renderNews } from "./rendering.js";
import { normalSample } from "./samples.js";
import { newsPage } from "./ui/page.js";
export const news: ModuleDefinition = {
    id: "news", title: "新闻", permissions: ["db", "net"], install, copy: copyContract,
    commands: { definitions: commands, render: (input, name) => command(input.ctx, name, input.args) },
    variables: { ...newsVariables, createResolver, sampleVariables: () => ({ "新闻.游戏": renderNews(NEWS_COPY, normalSample, expand, commandUrl) }) },
    cron: { game_news_sync: { cron: "0 * * * *", handler: async ({ ctx, scheduledAt }) => { await sync(ctx, scheduledAt); } } },
    admin: api,
    ui: {
        get source() { return `const renderNewsSample = ${renderNews.toString()}; const renderSearchSample = ${renderSearch.toString()};` + newsPage; }, sections: [
            { id: "settings", title: "游戏设置", factory: "createSettingsEditor" },
            { id: "cache", title: "游戏缓存", factory: "createNewsCache" },
            { id: "copy", title: "文案", factory: "createNewsCopyEditor" },
        ]
    },
};
