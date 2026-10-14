import type { Region } from "../../../shared/t2i/index.js";
export const WEATHER_REGIONS = {
    city: { x: 32, y: 42, width: 476, height: 78 }, area: { x: 32, y: 121, width: 476, height: 54 },
    temperature: { x: 32, y: 220, width: 300, height: 90 }, condition: { x: 32, y: 330, width: 300, height: 70 },
    symbol: { x: 350, y: 232, width: 128, height: 128 },
    first: { x: 32, y: 490, width: 144, height: 66 }, humidity: { x: 198, y: 490, width: 144, height: 66 }, wind: { x: 366, y: 490, width: 144, height: 66 },
    range: { x: 32, y: 585, width: 476, height: 38 },
    day: { x: 32, y: 650, width: 220, height: 106 }, night: { x: 288, y: 650, width: 220, height: 106 },
    date: { x: 32, y: 796, width: 476, height: 36 },
} satisfies Record<string, Region>;
