import { useRef } from 'react';
import type { RefObject } from 'react';
import { gsap } from '@/lib/gsap';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';

/**
 * May return a teardown function. GSAP calls it on revert, which is the only
 * safe place to unbind listeners that drive animations built in the same
 * callback — a separate `useEffect` would outlive the context and end up
 * holding a reverted timeline.
 */
type ScopeCallback = (ctx: gsap.Context, scope: HTMLElement) => void | (() => void);

/**
 * Runs GSAP setup inside a scoped `gsap.context()` so every tween and
 * ScrollTrigger created in the callback is reverted automatically on unmount —
 * the single most common source of leaks in React + GSAP apps.
 *
 * Setup is deferred until webfonts have loaded, because SplitText measures
 * line boxes and a late font swap would break the splits.
 */
export function useGsapScope<T extends HTMLElement = HTMLElement>(
  setup: ScopeCallback,
  deps: unknown[] = [],
): RefObject<T | null> {
  const scopeRef = useRef<T>(null);

  useIsomorphicLayoutEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    let ctx: gsap.Context | undefined;
    let cancelled = false;

    const start = () => {
      if (cancelled) return;
      // Returning the teardown from the context function is what makes GSAP
      // run it during `revert()`.
      ctx = gsap.context((self) => setup(self, scope), scope);
    };

    if (document.fonts?.status === 'loaded') {
      start();
    } else {
      document.fonts?.ready.then(start).catch(start);
    }

    return () => {
      cancelled = true;
      ctx?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return scopeRef;
}
