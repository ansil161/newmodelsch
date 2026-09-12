import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { ApiError } from '@/lib/apiClient';

export interface Resource<T> {
  data: T | undefined;
  error: ApiError | null;
  /** The first load for these dependencies is in flight: nothing to show yet. */
  loading: boolean;
  /** A reload is in flight while the previous data is still on screen. */
  refreshing: boolean;
  reload: () => void;
  /** Replace the data locally — with what a mutation returned, say. */
  mutate: (next: T | ((current: T | undefined) => T)) => void;
}

interface State<T> {
  key: string;
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  refreshing: boolean;
}

const UNEXPECTED = new ApiError(0, 'unexpected', 'Something went wrong. Please try again.');

/**
 * One request, its state, and a way to repeat it.
 *
 * A reload keeps the current data on screen — a list that blanks and redraws
 * every time it polls is unreadable. A change of dependencies does not: the
 * documents of one knowledge base must never sit on screen under the name of
 * another while the new ones load. Requests are aborted when superseded or
 * unmounted, so a slow answer can never overwrite a newer one.
 */
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
): Resource<T> {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<State<T>>({
    key,
    data: undefined,
    error: null,
    loading: true,
    refreshing: false,
  });
  const [attempt, setAttempt] = useState(0);
  const loader = useRef(load);

  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => {
      const fresh = current.key !== key;
      return {
        key,
        data: fresh ? undefined : current.data,
        error: null,
        loading: fresh || current.data === undefined,
        refreshing: !fresh && current.data !== undefined,
      };
    });

    loader.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setState({ key, data, error: null, loading: false, refreshing: false });
        }
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState((current) => ({
          ...current,
          error: error instanceof ApiError ? error : UNEXPECTED,
          loading: false,
          refreshing: false,
        }));
      },
    );
    return () => controller.abort();
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  const mutate = useCallback((next: T | ((current: T | undefined) => T)) => {
    setState((current) => ({
      ...current,
      data: typeof next === 'function' ? (next as (value: T | undefined) => T)(current.data) : next,
    }));
  }, []);

  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : null,
    loading: current ? state.loading : true,
    refreshing: current && state.refreshing,
    reload,
    mutate,
  };
}
