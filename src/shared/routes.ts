import type { Route } from "@qqbot/sdk";

function overlaps(left: string, right: string): boolean {
    const a = left.split("/").filter(Boolean), b = right.split("/").filter(Boolean);
    const aw = a.at(-1) === "*", bw = b.at(-1) === "*";

    if (aw) { a.pop(); }

    if (bw) { b.pop(); }

    if ((!aw && !bw && a.length !== b.length) || (aw && !bw && b.length < a.length) || (bw && !aw && a.length < b.length)) { return false; }

    return a.slice(0, Math.min(a.length, b.length)).every((part, index) => part.startsWith(":") || b[index]!.startsWith(":") || part === b[index]);
}

export function validateRoutes<T extends readonly Route[]>(routes: T): T {
    for (let i = 0; i < routes.length; i++) {
        const route = routes[i]!;
        const conflict = routes.slice(0, i).find((other) => other.method === route.method && overlaps(other.path, route.path));

        if (conflict) { throw new Error(`路由冲突：${route.method} ${route.path} 与 ${conflict.path}`); }
    }

    return routes;
}
