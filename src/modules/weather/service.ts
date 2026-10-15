import { renderWeather } from "./rendering.js";
import { WEATHER_CARD_COPY, type WeatherCardData } from "./cards/copy.js";
import type { Forecast, Current } from "./types.js";
import type { WeatherConfig } from "./types.js";
import { lookup, request, parseCurrent, parseForecast, CURRENT_FIELDS, FORECAST_FIELDS, NoWeatherData } from "./provider.js";
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
    image = false,
): Promise<{ text: string; card?: WeatherCardData }> {
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

    const body = tomorrow ? copy.tomorrow : copy.current;

    if (!/\{\{[^{}]+\}\}/.test(body)) { return { text: body }; }

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
    const cardCopy = config.cardCopy ?? WEATHER_CARD_COPY;
    const custom = image && config.cardDesigns?.config.weather?.enabled ? config.cardDesigns.config.weather : undefined;
    const selected = new Set(custom?.regions.flatMap(region => region.text === undefined ? [region.field] : [...region.text.matchAll(/\{\{([^{}]+)\}\}/g)].map(match => match[1]!)));
    const cardFields = custom ? new Set([...selected, "caption", ...(selected.has("temperature") ? [tomorrow ? "tomorrow" : "current"] : []), ...(selected.has("first") ? [tomorrow ? "minimum" : "feels"] : [])]) : null;
    const imageBody = image ? Object.entries(cardCopy).filter(([key]) => cardFields ? cardFields.has(key) : tomorrow ? !["current", "feels"].includes(key) : !["tomorrow", "minimum"].includes(key)).map(([, value]) => value).join("") : "";
    const needed = body + imageBody;
    const forecastFields = new Set<Exclude<keyof Forecast["days"][number], "date">>(FORECAST_FIELDS.filter(key => needed.includes("{{" + key + "}}")));
    const currentFields: (keyof Current)[] = tomorrow ? [] : CURRENT_FIELDS.filter(key => needed.includes("{{" + key + "}}"));

    if (tomorrow) {
        if (needed.includes("{{condition}}")) { forecastFields.add("day"); }

        for (const key of ["humidity", "wind"] as const) {
            if (needed.includes("{{" + key + "}}")) { forecastFields.add(key); }
        }
    }

    if (image) {
        // A custom background needs no theme data; each dynamic icon declares its own forecast needs.
        if (!custom || selected.has("icon")) {
            if (tomorrow) { forecastFields.add("code"); }
            else { currentFields.push("code"); forecastFields.add("sunrise"); forecastFields.add("sunset"); }
        }

        if (!custom || selected.has("day_icon")) { forecastFields.add("code"); }

        if (!custom || selected.has("night_icon")) { forecastFields.add("nightCode"); }
    }

    try {
        const [forecast, current] = await Promise.all([
            forecastFields.size
                ? request(config, "/weather/v1/daily" + suffix + "?days=2&localTime=true&lang=zh", fetcher).then((data) => parseForecast(data, [...forecastFields]))
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

        let card: WeatherCardData | undefined;

        if (image) {
            const date = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", timeZone: "UTC" }).format(Date.parse(day));
            const sunrise = Date.parse(daily.sunrise ?? ""), sunset = Date.parse(daily.sunset ?? "");
            const night = Number.isFinite(sunrise) && Number.isFinite(sunset) && (now < sunrise || now >= sunset);
            card = {
                values: {
                    ...Object.fromEntries(Object.entries(daily).filter((entry): entry is [string, string] => typeof entry[1] === "string")), ...current,
                    city: city.name, area: city.area, date, condition: tomorrow ? daily.day ?? "" : current?.condition ?? ""
                },
                code: tomorrow ? daily.code ?? "999" : current?.code ?? "999", dayCode: daily.code ?? "999", nightCode: daily.nightCode ?? "999",
                night: !tomorrow && night, tomorrow,
                fragments: { current_url: commandUrl("/天气 " + city.id), tomorrow_url: commandUrl("/天气 " + city.id + " 明天") },
            };
        }

        if (tomorrow) {
            return {
                card,
                text: renderWeather(copy, "tomorrow", { values: { ...daily, city: cityLabel }, fragments: { current_url: commandUrl("/天气 " + city.id) } }, expand),
            };
        }

        const updated = new Intl.DateTimeFormat("zh-CN", {
            timeZone: city.tz,
            month: "long",
            day: "numeric",
        }).format(now);
        return {
            card,
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
