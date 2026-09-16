/** Locale-aware integer formatting for the counters in section 07. */
export const formatCount = (value) =>
  Math.round(value).toLocaleString('en-IN');

/** `04` from `4` — used for section indices and card numbering. */
export const pad2 = (value) => String(value).padStart(2, '0');

/** Clamps a number into a range. */
export const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value));

/** Maps `value` from one range to another, clamped to the output range. */
export const mapRange = (
  value,
  inMin,
  inMax,
  outMin,
  outMax,
) => {
  if (inMax === inMin) return outMin;
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + t * (outMax - outMin);
};

/** Joins truthy class names — a dependency-free `clsx`. */
export const cx = (...parts) =>
  parts.filter(Boolean).join(' ');

/* --------------------------------------------------------------------------
   Console formatting — sizes, times and durations, in the reader's locale
   -------------------------------------------------------------------------- */

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'];

/** `1.4 MB` from `1468006`. An empty size is a dash, not "0 B". */
export const formatBytes = (bytes) => {
  if (!bytes) return '—';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit > 0 && value < 10 ? value.toFixed(1) : Math.round(value)} ${BYTE_UNITS[unit]}`;
};

export const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

const RELATIVE_STEPS = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [7, 'day'],
];

/** `3 minutes ago` for recent things; a date once it is more than a week old. */
export const formatRelative = (iso) => {
  if (!iso) return '—';
  let delta = (new Date(iso).getTime() - Date.now()) / 1000;
  if (Math.abs(delta) < 45) return 'just now';
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [size, unit] of RELATIVE_STEPS) {
    if (Math.abs(delta) < size) return formatter.format(Math.round(delta), unit);
    delta /= size;
  }
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** `340 ms`, `2.4 s`, `18 s`. */
export const formatDuration = (ms) => {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
};

/** `1 chunk`, `12 chunks`. */
export const plural = (count, one, many = `${one}s`) =>
  `${formatCount(count)} ${count === 1 ? one : many}`;

/** A relevance score as the console shows it: three decimals, or a dash. */
export const formatScore = (score) =>
  score === null || score === undefined ? '—' : score.toFixed(3);

/** `p. 4`, or `pp. 4–6` for a passage that runs across pages. Empty when unknown. */
export const formatPages = (page, pages = []) => {
  if (pages.length > 1) return `pp. ${Math.min(...pages)}–${Math.max(...pages)}`;
  const only = pages[0] ?? page;
  return only ? `p. ${only}` : '';
};

/** `example.org/admissions/fees` — an address without its scheme, for reading. */
export const displayUrl = (url) => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.host}${path}${parsed.search}`;
  } catch {
    return url;
  }
};
