import { TextField } from '@/components/console';

/** Comma-separated text as a list: trimmed, lower-cased, without repeats. */
export function parseTags(text) {
  const tags = new Set();
  for (const part of text.split(',')) {
    const tag = part.trim().toLowerCase();
    if (tag) tags.add(tag);
  }
  return [...tags].slice(0, 20);
}

/** Comma-separated text as a list, keeping case — for category names. */
export function parseList(text) {
  const items = new Set();
  for (const part of text.split(',')) {
    const item = part.trim();
    if (item) items.add(item);
  }
  return [...items].slice(0, 20);
}

export function TagsField({
  value,
  onChange,
  error,
  label = 'Tags',
  hint = 'Separate tags with commas, e.g. fees, transport.',
}) {
  return (
    <TextField
      label={label}
      optional
      value={value}
      onChange={(event) => onChange(event.target.value)}
      hint={hint}
      error={error}
      maxLength={500}
      autoComplete="off"
    />
  );
}
