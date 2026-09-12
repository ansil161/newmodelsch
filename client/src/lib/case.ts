/**
 * The API speaks snake_case; the interface speaks camelCase. Keys are
 * converted once, at the edge, so no component ever sees `chunk_count`.
 * Values are never touched — a document title with an underscore in it stays
 * exactly as it was typed.
 */

const toCamel = (key: string): string =>
  key.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());

function convert(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(convert);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [toCamel(key), convert(item)]),
    );
  }
  return value;
}

export function camelizeKeys<T>(value: unknown): T {
  return convert(value) as T;
}
