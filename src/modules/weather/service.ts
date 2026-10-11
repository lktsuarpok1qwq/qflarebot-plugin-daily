import { renderWeather } from "./rendering.js";
import type { WeatherConfig } from "./types.js";
import { lookup, request, parseCurrent, parseForecast, NoWeatherData } from "./provider.js";
import { expand, commandLink, commandUrl } from "../../shared/interpolation.js";
export function localDay(now: number, tz: string, offset = 0) {
    const parts = new Intl.DateTimeFormat("en", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);
    const part = (key: string) => parts.find((p) => p.type === key)!.value;
    const day = `${part("year")}-${part("month")}-${part("day")}`;
    return new Date(Date.parse(day) + offset * 86_400_000).toISOString().slice(0, 10);
}
export async function queryWeather(
    config: WeatherConfig,
    args: string[],
    now = Date.now(),
    fetcher: typeof fetch = fetch,
) {
    const copy = config.copy;

    if (!args.length) {
        return { text: copy.help };
    }

    const tomorrow = args.at(-1) === "明天",
        words = tomorrow ? args.slice(0, -1) : args;
    const query = words.join(" ").trim();

    if (!query) {
        return { text: copy.help };
    }

    if (!config.host || !config.apiKey) {
        throw new Error("天气 API 尚未配置");
    }

    const cities = await lookup(config, query, fetcher);

    if (!cities.length) {
        return { text: copy.notFound };
    }

    const exact = cities.filter(
        (city) => city.id === query || city.name.toLocaleLowerCase() === query.toLocaleLowerCase(),
    );
    const city = exact.length === 1 ? exact[0] : cities.length === 1 ? cities[0] : undefined;

    if (!city) {
        return {
            text: renderWeather(copy, "candidate", {
                candidates: cities.map((c) => {
                    const command = "/天气 " + c.id + (tomorrow ? " 明天" : "");
                    return { city: c.name, area: c.area, command, command_link: commandLink(command, command), command_url: commandUrl(command) };
                })
            }, expand),
        };
    }

    const day = localDay(now, city.tz, tomorrow ? 1 : 0);
    const suffix = "/" + city.lat + "/" + city.lon;
    const body = tomorrow ? copy.tomorrow : copy.current;
    const needsForecast = ["low", "high", "day", "night"].some((key) => body.includes("{{" + key + "}}"));
    const needsCurrent = !tomorrow && ["condition", "temp", "feels", "humidity", "wind"].some((key) => body.includes("{{" + key + "}}"));

    try {
        const [forecast, current] = await Promise.all([
            needsForecast
                ? request(config, "/weather/v1/daily" + suffix + "?days=2&localTime=true&lang=zh", fetcher).then(parseForecast)
                : Promise.resolve(null),
            needsCurrent
                ? request(config, "/weather/v1/current" + suffix + "?localTime=true&lang=zh", fetcher).then(
                    parseCurrent,
                )
                : Promise.resolve(null),
        ]);
        const daily = forecast ? forecast.days.find((item) => item.date === day) : { date: day };

        if (!daily) {
            return { text: copy.unavailable };
        }

        const cityLabel = city.name + " · " + city.area;

        if (tomorrow) {
            return {
                text: renderWeather(copy, "tomorrow", { values: { ...daily, city: cityLabel }, fragments: { current_url: commandUrl("/天气 " + city.id) } }, expand),
            };
        }

        const updated = new Intl.DateTimeFormat("zh-CN", {
            timeZone: city.tz,
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        }).format(now);
        return {
            text:
                renderWeather(copy, "current", { values: { ...daily, ...current!, city: cityLabel, updated }, fragments: { tomorrow_url: commandUrl("/天气 " + city.id + " 明天") } }, expand),
        };
    } catch (error) {
        if (error instanceof NoWeatherData) {
            return { text: copy.unavailable };
        }

        throw error;
    }
}
