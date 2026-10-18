import type { WeatherCardField } from "./values.js";
import type { CardRegion } from "../../../shared/cards/types.js";
type DefaultRegion = Omit<CardRegion, "color" | "field"> & { field: WeatherCardField; color: "header" | "panel" };
export const WEATHER_REGIONS: readonly DefaultRegion[] = [
    { x: 32, y: 42, width: 476, height: 78, id: "city", field: "city", size: 28, color: "header", weight: 400, align: "left", lineHeight: 34 },
    { x: 32, y: 121, width: 476, height: 54, id: "area", field: "area", size: 24, color: "header", weight: 400, align: "left", lineHeight: 30 },
    { x: 32, y: 220, width: 300, height: 90, id: "temperature", field: "temperature", size: 64, color: "header", weight: 400, align: "left", lineHeight: 70 },
    { x: 32, y: 330, width: 300, height: 70, id: "condition", field: "condition", size: 28, color: "header", weight: 400, align: "left", lineHeight: 34 },
    { x: 32, y: 490, width: 144, height: 66, id: "first", field: "first", size: 24, color: "panel", weight: 400, align: "center", lineHeight: 30 },
    { x: 198, y: 490, width: 144, height: 66, id: "humidity", field: "humidity", size: 24, color: "panel", weight: 400, align: "center", lineHeight: 30 },
    { x: 366, y: 490, width: 144, height: 66, id: "wind", field: "wind", size: 24, color: "panel", weight: 400, align: "center", lineHeight: 30 },
    { x: 32, y: 585, width: 476, height: 38, id: "range", field: "range", size: 24, color: "panel", weight: 400, align: "left", lineHeight: 30 },
    { x: 32, y: 650, width: 220, height: 106, id: "day", field: "day", size: 24, color: "panel", weight: 400, align: "center", lineHeight: 70 },
    { x: 288, y: 650, width: 220, height: 106, id: "night", field: "night", size: 24, color: "panel", weight: 400, align: "center", lineHeight: 70 },
    { x: 32, y: 796, width: 476, height: 36, id: "date", field: "date", size: 24, color: "header", weight: 400, align: "left", lineHeight: 30 },
    { id: "day-icon", field: "day_icon", x: 126, y: 683, width: 32, height: 32, size: 32, lineHeight: 32, weight: 400, color: "panel", align: "left" },
    { id: "night-icon", field: "night_icon", x: 382, y: 683, width: 32, height: 32, size: 32, lineHeight: 32, weight: 400, color: "panel", align: "left" }
];
export const weatherHeaderColor = (theme: string) => ["rainy", "heavy-rain", "thunderstorm", "clear-night", "cloudy-night"].includes(theme) ? "#ffffff" : "#092754";
