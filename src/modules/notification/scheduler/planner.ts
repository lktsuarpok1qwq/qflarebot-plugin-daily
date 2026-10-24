import type { Plan, Schedule } from "../types.js";
import { dateAt, validDate, at, addDays } from "../../../shared/date.js";

export function nextPlan(s: Schedule, after: number): Plan | null {
    if (s.kind === "once") {
        const due = at(s.date, s.time);

        return due > after ? { due } : null;
    }

    for (let i = 0; i < 8; i++) {
        const date = addDays(dateAt(after), i),
            due = at(date, s.time),
            weekday = new Date(date).getUTCDay() || 7;

        if (!validDate(date)) {
            return null;
        }

        if (due > after && (s.kind === "daily" || s.weekdays.includes(weekday))) {
            return { due };
        }
    }

    return null;
}
