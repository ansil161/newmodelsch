import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * A list's search, filters, sort and page, kept in the address.
 *
 * So a filtered view survives a reload, the back button undoes a filter, and
 * a link to "the failed documents" can be pasted to a colleague. A value equal
 * to its default is left out of the address, and changing any filter returns
 * to the first page — page 4 of the old filter means nothing under a new one.
 *
 * `defaults` must be a constant defined outside the component.
 */
export function useListParams<K extends string>(defaults: Readonly<Record<K, string>>) {
  const [params, setParams] = useSearchParams();

  const values = {} as Record<K, string>;
  for (const key of Object.keys(defaults) as K[]) values[key] = params.get(key) ?? defaults[key];
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1);

  const update = useCallback(
    (changes: Partial<Record<K, string>>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes) as Array<[K, string | undefined]>) {
            if (value && value !== defaults[key]) next.set(key, value);
            else next.delete(key);
          }
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams, defaults],
  );

  const setPage = useCallback(
    (value: number) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (value > 1) next.set('page', String(value));
        else next.delete('page');
        return next;
      });
    },
    [setParams],
  );

  return { values, page, update, setPage };
}
