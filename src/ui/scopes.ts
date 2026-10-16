export const scopes = String.raw`
function createScope(app, id) {
    const scope = { id, state: null, config: null, synchronized: false };

    for (const key of ["dirty", "page"]) {
        Object.defineProperty(scope, key, {
            get: () => app[key],
            set: (value) => {
                app[key] = value;
            },
        });
    }

    for (const key of ["resource", "status", "confirmAction", "run", "render", "refresh", "focus", "resetDrafts"]) {
        scope[key] = (...args) => app[key](...args);
    }

    scope.api = (action, data) => app.api(id + "/" + action, data);
    scope.load = (redraw = true) => app.load(scope, redraw);
    scope.save = (message, afterSave) => app.save(message, afterSave, scope);
    return scope;
}
`;
