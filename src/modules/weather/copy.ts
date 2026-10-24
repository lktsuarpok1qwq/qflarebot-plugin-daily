import { commandLink } from "../../shared/interpolation.js";

export const WEATHER_COPY = {
    help: "🌤️ **天气查询**\n\n📍 想了解哪里的天气？\n" + commandLink("✏️ 输入城市", "/天气 ", false) + "\n\n💡 试试看：" + commandLink("/天气 北京", "/天气 北京") + " · " + commandLink("/天气 悉尼", "/天气 悉尼") + "\n输入城市名称或地点编号，就能查询\n\n" + commandLink("🏠 每日助手", "/每日"),
    current:
        "## 📍 {{city}}\n🌤️ 当前 {{condition}}\n🌡️ {{temp}}℃ · 体感 {{feels}}℃\n💧 湿度 {{humidity}}% · 🍃 风速 {{wind}} m/s\n📊 今天 {{low}}～{{high}}℃\n☀️ 白天 {{day}} · 🌙 夜间 {{night}}\n📅 获取日期 {{updated}}\n\n" + commandLink("✏️ 换个城市", "/天气 ", false),
    notFound: "🔎 没找到这个地点，试试完整城市名吧\n" + commandLink("✏️ 重新输入城市", "/天气 ", false),
    choose: "📍 找到几个同名地点，点选你想查询的那一个\n\n",
    candidate: "📌 **{{city}}** · {{area}}\n{{command_link}}\n\n",
    unavailable: "☁️ 暂时没有这个地点的天气信息，稍后再来看看吧\n" + commandLink("✏️ 换个城市", "/天气 ", false),
};
export const WEATHER_FIELDS = {
    help: { label: "帮助", variables: {} },
    current: {
        label: "当前天气",
        variables: {
            city: "地点名称",
            date: "当地预报日期",
            condition: "当前天气",
            temp: "当前温度，℃",
            feels: "体感温度，℃",
            humidity: "湿度百分比",
            wind: "风速，米每秒",
            low: "最低温度，℃",
            high: "最高温度，℃",
            day: "白天天气",
            night: "夜间天气",
            updated: "当地获取日期，月日",
        },
    },
    notFound: { label: "未找到地点", variables: {} },
    choose: { label: "选择地点", variables: {} },
    candidate: { label: "地点候选", variables: { city: "地点名称", area: "所属区域", command: "查询命令文本", command_link: "以查询命令为文字的完整链接", command_url: "查询命令链接地址，用于 [文字]({{command_url}})" } },
    unavailable: { label: "暂无天气数据", variables: {} },
};
