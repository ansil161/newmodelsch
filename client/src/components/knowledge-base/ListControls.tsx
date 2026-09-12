import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/common/Icon';
import { cx } from '@/utils';

/**
 * A search box that searches as you type, a moment after you stop.
 *
 * The address is the source of truth: when it changes from outside — "Clear
 * filters", the back button — the box follows it.
 */
export function SearchInput({
  value,
  onSearch,
  label,
  placeholder,
}: {
  value: string;
  onSearch: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  const timer = useRef(0);

  if (value !== synced) {
    setSynced(value);
    // Unless the change is just this box's own text arriving back.
    if (value !== text.trim()) setText(value);
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div className="kb-search">
      <Icon name="search" size={16} />
      <input
        type="search"
        className="c-input c-input--compact"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        maxLength={200}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => onSearch(next.trim()), 350);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            window.clearTimeout(timer.current);
            onSearch(text.trim());
          }
        }}
      />
    </div>
  );
}

/** A column heading that sorts by its column, and says which way it is sorted. */
export function SortHeader({
  field,
  label,
  ordering,
  onSort,
  numeric = false,
  descendingFirst = false,
}: {
  field: string;
  label: string;
  ordering: string;
  onSort: (ordering: string) => void;
  numeric?: boolean;
  /** Dates and sizes: the first click wants the newest or largest. */
  descendingFirst?: boolean;
}) {
  const ascending = ordering === field;
  const descending = ordering === `-${field}`;
  const next = ascending ? `-${field}` : descending ? field : descendingFirst ? `-${field}` : field;
  return (
    <th
      scope="col"
      className={numeric ? 'is-num' : undefined}
      aria-sort={ascending ? 'ascending' : descending ? 'descending' : undefined}
    >
      <button type="button" className={cx('c-table__sort', (ascending || descending) && 'is-sorted')} onClick={() => onSort(next)}>
        {label}
        <span className={cx('c-table__sort-icon', ascending && 'is-asc')} aria-hidden="true">
          <Icon name="chevronDown" size={12} />
        </span>
      </button>
    </th>
  );
}

/** A small set of mutually exclusive views: pressed buttons, announced as such. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string; icon?: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="kb-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="kb-segmented__item"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <Icon name={option.icon} size={15} /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}
