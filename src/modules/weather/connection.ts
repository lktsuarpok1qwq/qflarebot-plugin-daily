import type { WeatherConfig } from "./types.js";
import { lookup, request, parseCurrent, parseForecast, NoWeatherData } from "./provider.js";
export async function testConnection(config: WeatherConfig, fetcher: typeof fetch = fetch) {
    if (!config.host || !config.apiKey) {
        throw new Error("请先填写 API Host 和 API Key");
    }

    async function check<T>(label: string, run: () => Promise<T>): Promise<T> {
        try {
            return await run();
        } catch (error) {
            const reason =
                error instanceof NoWeatherData ? "暂无数据" : error instanceof Error ? error.message : "请求失败";
            throw new Error(label + "：" + reason);
        }
    }

    const cities = await check("城市搜索", () => lookup(config, "101010100", fetcher));
    const city = cities[0];

    if (!city) {
        throw new Error("城市搜索：未返回测试地点");
    }

    const suffix = "/" + city.lat + "/" + city.lon;
    await Promise.all([
        check("实时天气", async () =>
            parseCurrent(await request(config, "/weather/v1/current" + suffix + "?lang=zh&localTime=true", fetcher)),
        ),
        check("每日预报", async () => {
            const result = parseForecast(
                await request(config, "/weather/v1/daily" + suffix + "?days=1&lang=zh&localTime=true", fetcher),
            );

            if (!result.days.length) {
                throw new Error("暂无预报数据");
            }

            return result;
        }),
    ]);
    return { message: "连接正常：城市搜索、实时天气和每日预报均可用" };
}
