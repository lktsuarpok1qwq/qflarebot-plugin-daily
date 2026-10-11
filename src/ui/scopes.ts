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

    for (const key of ["status", "confirmAction", "run", "render", "focus", "resetDrafts"]) {
        scope[key] = (...args) => app[key](...args);
    }

    scope.api = (action, data) => app.api(id + "/" + action, data);
    scope.load = () => app.load(scope);
    scope.save = (message) => app.save(message, scope);
    return scope;
}
`;
