import type { Route } from "@qqbot/sdk";

type ParsedRoute = { route: Route; parts: string[]; wildcard: boolean };
function overlaps(a: ParsedRoute, b: ParsedRoute): boolean {
    if ((!a.wildcard && !b.wildcard && a.parts.length !== b.parts.length) || (a.wildcard && !b.wildcard && b.parts.length < a.parts.length) || (b.wildcard && !a.wildcard && a.parts.length < b.parts.length)) { return false; }

    const count = Math.min(a.parts.length, b.parts.length);

    for (let i = 0; i < count; i++) {
        if (!a.parts[i]!.startsWith(":") && !b.parts[i]!.startsWith(":") && a.parts[i] !== b.parts[i]) { return false; }
    }

    return true;
}

export function validateRoutes<T extends readonly Route[]>(routes: T): T {
    const methods = new Map<Route["method"], ParsedRoute[]>();

    for (const route of routes) {
        const parts = route.path.split("/").filter(Boolean), wildcard = parts.at(-1) === "*";

        if (wildcard) { parts.pop(); }

        const parsed = { route, parts, wildcard }, previous = methods.get(route.method) ?? [];
        const conflict = previous.find(other => overlaps(other, parsed));

        if (conflict) { throw new Error(`路由冲突：${route.method} ${route.path} 与 ${conflict.route.path}`); }

        previous.push(parsed);
        methods.set(route.method, previous);
    }

    return routes;
}
