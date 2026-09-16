import { useRef } from 'react';
import { gsap } from '@/lib/gsap';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';

/**
 * Runs GSAP setup inside a scoped `gsap.context()` so every tween and
 * ScrollTrigger created in the callback is reverted automatically on unmount —
 * the single most common source of leaks in React + GSAP apps.
 *
 * Setup is deferred until webfonts have loaded, because SplitText measures
 * line boxes and a late font swap would break the splits.
 */
export function useGsapScope(
  setup,
  deps = [],
) {
  const scopeRef = useRef(null);

  useIsomorphicLayoutEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    let ctx;
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
