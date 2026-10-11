import type { WeatherState } from "./types.js";
import { ATTRIBUTION } from "./copy.js";
import { lookup, request, parseCurrent, parseForecast, NoWeatherData } from "./provider.js";
import { expand, commandLink } from "../../shared/interpolation.js";
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
function sourceText(values: string[]) {
    return (
        ATTRIBUTION +
        "\n" +
        [...new Set(values)]
            .map((value) => {
                if (/^https:\/\/[^\s<>()[\]\\]+$/.test(value)) {
                    return "[数据来源声明](" + value + ")";
                }

                return expand("{{value}}", { value });
            })
            .join("\n")
    );
}
export async function queryWeather(
    state: WeatherState,
    args: string[],
    now = Date.now(),
    fetcher: typeof fetch = fetch,
) {
    const copy = state.config.copy;

    if (!args.length) {
        return { text: copy.help };
    }

    const tomorrow = args.at(-1) === "明天",
        words = tomorrow ? args.slice(0, -1) : args;
    const query = words.join(" ").trim();

    if (!query) {
        return { text: copy.help };
    }

    if (!state.config.host || !state.config.apiKey) {
        return { text: copy.notConfigured };
    }

    const cities = await lookup(state.config, query, fetcher);

    if (!cities.length) {
        return { text: copy.notFound };
    }

    const exact = cities.filter(
        (city) => city.id === query || city.name.toLocaleLowerCase() === query.toLocaleLowerCase(),
    );
    const city = exact.length === 1 ? exact[0] : cities.length === 1 ? cities[0] : undefined;

    if (!city) {
        return {
            text:
                copy.choose +
                "\n\n" +
                cities
                    .map((c) => {
                        const command = "/天气 " + c.id + (tomorrow ? " 明天" : "");
                        return expand(copy.candidate, { city: c.name, area: c.area, command }, {
                            command_link: commandLink(command, command),
                        });
                    })
                    .join("\n\n") +
                "\n\n" +
                ATTRIBUTION,
        };
    }

    const day = localDay(now, city.tz, tomorrow ? 1 : 0);
    const suffix = "/" + city.lat + "/" + city.lon;

    try {
        const [forecast, current] = await Promise.all([
            request(state.config, "/weather/v1/daily" + suffix + "?days=2&localTime=true&lang=zh", fetcher).then(
                parseForecast,
            ),
            tomorrow
                ? Promise.resolve(null)
                : request(state.config, "/weather/v1/current" + suffix + "?localTime=true&lang=zh", fetcher).then(
                    parseCurrent,
                ),
        ]);
        const daily = forecast.days.find((item) => item.date === day);

        if (!daily) {
            return { text: copy.unavailable };
        }

        const cityLabel = city.name + " · " + city.area;

        if (tomorrow) {
            return {
                text: expand(copy.tomorrow, { ...daily, city: cityLabel }) + "\n\n" + sourceText(forecast.attributions),
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
                expand(copy.current, { ...daily, ...current!, attributions: "", city: cityLabel, updated }) +
                "\n\n" +
                sourceText([...forecast.attributions, ...current!.attributions]),
        };
    } catch (error) {
        if (error instanceof NoWeatherData) {
            return { text: copy.unavailable };
        }

        throw error;
    }
}
