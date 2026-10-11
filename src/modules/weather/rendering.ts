import type { WeatherConfig } from "./types.js";
import type { expand } from "../../shared/interpolation.js";
export type WeatherExample = {
    values?: Record<string, string>;
    fragments?: Record<string, string>;
    candidates?: { city: string; area: string; command: string; command_link: string; command_url: string }[];
};
/** Pure formatting shared with browser samples; dependencies are passed explicitly. */
export function renderWeather(copy: WeatherConfig["copy"], key: keyof WeatherConfig["copy"], data: WeatherExample, interpolate: typeof expand, decorate?: (key: keyof WeatherConfig["copy"], text: string) => string): string {
    if (key === "choose" || key === "candidate") {
        const title = decorate ? decorate("choose", copy.choose) : copy.choose;
        return title + (data.candidates ?? []).map((c) => {
            const text = interpolate(copy.candidate, { city: c.city, area: c.area, command: c.command }, { command_link: c.command_link, command_url: c.command_url });
            return decorate ? decorate("candidate", text) : text;
        }).join("");
    }

    const text = interpolate(copy[key], data.values ?? {}, data.fragments ?? {});
    return decorate ? decorate(key, text) : text;
}
