/**
 * The API speaks snake_case; the interface speaks camelCase. Keys are
 * converted once, at the edge, so no component ever sees `chunk_count`.
 * Values are never touched — a document title with an underscore in it stays
 * exactly as it was typed.
 */

const toCamel = (key) =>
  key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());

function convert(value) {
  if (Array.isArray(value)) return value.map(convert);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [toCamel(key), convert(item)]),
    );
  }
  return value;
}

export function camelizeKeys(value) {
  return convert(value);
}
