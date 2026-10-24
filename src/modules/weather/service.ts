import { analyzeTemplate } from "../../shared/templates.js";
import { renderWeather } from "./rendering.js";
import type { WeatherCardData } from "./cards/copy.js";
import type { Forecast, Current } from "./types.js";
import type { WeatherConfig } from "./types.js";
import { lookup, request, parseCurrent, parseForecast, CURRENT_FIELDS, FORECAST_FIELDS, NoWeatherData } from "./provider.js";
import { expand, commandLink, commandUrl } from "../../shared/interpolation.js";

// GeoAPI 提供包含夏令时的当前 UTC 偏移量
export function localDay(now: number, utcOffset: number) {
    return new Date(now + utcOffset * 60_000).toISOString().slice(0, 10);
}

export async function queryWeather(
    config: WeatherConfig,
    args: string[],
    now = Date.now(),
    fetcher: typeof fetch = fetch,
    image = false,
): Promise<{ text: string; card?: WeatherCardData }> {
    const copy = config.copy;

    if (!args.length) {
        return { text: copy.help };
    }

    const query = args.join(" ").trim();

    if (!query) {
        return { text: copy.help };
    }

    const body = copy.current, needed = analyzeTemplate(body).keys;

    if (!image && !needed.size) { return { text: body }; }

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
                    const command = "/天气 " + c.id;

                    return { city: c.name, area: c.area, command, command_link: commandLink(command, command), command_url: commandUrl(command) };
                })
            }, expand),
        };
    }

    const day = localDay(now, city.utcOffset);
    const suffix = "/" + city.lat + "/" + city.lon;
    const cardCopy = config.cardCopy;
    const custom = image && config.cardDesigns?.config.weather?.enabled ? config.cardDesigns.config.weather : undefined;
    const selected = new Set(custom?.regions.flatMap(region => region.text === undefined ? [region.field] : [...analyzeTemplate(region.text).keys]));
    const cardFields = custom ? new Set([...selected, "caption", ...(selected.has("temperature") ? ["current"] : []), ...(selected.has("first") ? ["feels"] : [])]) : null;
    const imageBody = image ? Object.entries(cardCopy).filter(([key]) => !cardFields || cardFields.has(key)).map(([, value]) => value).join("") : "";

    for (const key of analyzeTemplate(imageBody).keys) { needed.add(key); }

    const forecastFields = new Set<Exclude<keyof Forecast["days"][number], "date">>(FORECAST_FIELDS.filter(key => needed.has(key)));
    const currentFields: (keyof Current)[] = CURRENT_FIELDS.filter(key => needed.has(key));

    if (image) {
        // 自定义背景无需主题数据，各动态图标分别声明所需的预报数据
        if (!custom || selected.has("icon")) {
            currentFields.push("code");
            forecastFields.add("sunrise");
            forecastFields.add("sunset");
        }

        if (!custom || selected.has("day_icon")) { forecastFields.add("code"); }

        if (!custom || selected.has("night_icon")) { forecastFields.add("nightCode"); }
    }

    try {
        const [forecast, current] = await Promise.all([
            forecastFields.size
                ? request(config, "/weather/v1/daily" + suffix + "?days=1&localTime=true&lang=zh", fetcher).then((data) => parseForecast(data, [...forecastFields]))
                : Promise.resolve(null),
            currentFields.length
                ? request(config, "/weather/v1/current" + suffix + "?localTime=true&lang=zh", fetcher).then(
                    (data) => parseCurrent(data, currentFields),
                )
                : Promise.resolve(null),
        ]);
        const daily: Forecast["days"][number] | undefined = forecast ? forecast.days.find((item) => item.date === day) : { date: day };

        if (!daily) {
            return { text: copy.unavailable };
        }

        const cityLabel = city.name + " · " + city.area;
        const date = Number(day.slice(5, 7)) + "月" + Number(day.slice(8, 10)) + "日";

        let card: WeatherCardData | undefined;

        if (image) {
            const sunrise = Date.parse(daily.sunrise ?? ""), sunset = Date.parse(daily.sunset ?? "");
            const night = Number.isFinite(sunrise) && Number.isFinite(sunset) && (now < sunrise || now >= sunset);
            card = {
                values: {
                    ...Object.fromEntries(Object.entries(daily).filter((entry): entry is [string, string] => typeof entry[1] === "string")), ...current,
                    city: city.name, area: city.area, date, condition: current?.condition ?? ""
                },
                code: current?.code ?? "999", dayCode: daily.code ?? "999", nightCode: daily.nightCode ?? "999",
                night,
                fragments: { current_url: commandUrl("/天气 " + city.id) },
            };
        }

        return {
            card,
            text: renderWeather(copy, "current", { values: { ...daily, ...current!, city: cityLabel, updated: date } }, expand),
        };
    } catch (error) {
        if (error instanceof NoWeatherData) {
            return { text: copy.unavailable };
        }

        throw error;
    }
}
