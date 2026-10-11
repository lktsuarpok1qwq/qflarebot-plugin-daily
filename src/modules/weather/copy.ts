import { commandLink } from "../../shared/interpolation.js";
export const WEATHER_COPY = {
    help: "🌤️ 天气查询\n" + commandLink("✏️ 输入城市", "/天气 ", false) + "\n\n示例：" + commandLink("/天气 北京", "/天气 北京") + " · " + commandLink("/天气 悉尼 明天", "/天气 悉尼 明天") + "\n支持城市名称或候选地点编号",
    current:
        "## 🌤️ {{city}}\n当前 {{condition}} · {{temp}}℃ · 体感 {{feels}}℃\n湿度 {{humidity}}% · 风速 {{wind}} m/s\n今天 {{low}}～{{high}}℃\n白天 {{day}} · 夜间 {{night}}\n获取时间 {{updated}}",
    tomorrow: "## 🌤️ {{city}} · 明天\n{{date}}\n{{low}}～{{high}}℃\n白天 {{day}} · 夜间 {{night}}",
    notConfigured: "天气查询尚未配置，请联系管理员",
    notFound: "没有找到这个地点，请尝试完整城市名\n" + commandLink("✏️ 重新输入城市", "/天气 ", false),
    choose: "找到多个地点，请点击对应命令查询",
    candidate: "{{city}} · {{area}}\n{{command_link}}",
    unavailable: "这个地点暂无所选日期的天气数据，请稍后查询",
};
export const WEATHER_FIELDS = {
    help: { label: "/天气", variables: {} },
    current: {
        label: "/天气 城市",
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
            updated: "当地获取时间",
        },
    },
    tomorrow: {
        label: "/天气 城市 明天",
        variables: {
            city: "地点名称",
            date: "当地预报日期",
            low: "最低温度，℃",
            high: "最高温度，℃",
            day: "白天天气",
            night: "夜间天气",
        },
    },
    notConfigured: { label: "未配置", variables: {} },
    notFound: { label: "未找到地点", variables: {} },
    choose: { label: "选择地点", variables: {} },
    candidate: { label: "地点候选", variables: { city: "地点名称", area: "所属区域", command: "查询命令文本", command_link: "点击发送的完整命令链接" } },
    unavailable: { label: "暂无天气数据", variables: {} },
};
export const ATTRIBUTION = "天气数据：[和风天气](https://www.qweather.com)";
