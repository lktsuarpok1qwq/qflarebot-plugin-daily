/** User-authored Markdown fragments are inserted once; external values are escaped. */
export function expand(
  body: string,
  values: Record<string, string>,
  fragments: Record<string, string> = {},
) {
  return body.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) =>
    Object.hasOwn(fragments, key)
      ? fragments[key]!
      : (values[key] ?? "").replace(/([\\`*_{}[\]()<>#+.!|~-])/g, "\\$1"),
  );
}
