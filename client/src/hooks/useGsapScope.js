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
 *
 * "Loaded" has to be asked at the right moment. The site's faces are served
 * with `display=swap` and a face is only requested once text that needs it is
 * laid out - so on first render, before any layout, `document.fonts.status`
 * already reads 'loaded' (nothing has been asked for yet) and the old check
 * built every split against the fallback font, seconds before the real one
 * arrived and re-wrapped the lines. Forcing layout on the scope first makes
 * the browser request this section's faces, and only then is the status
 * meaningful. The wait is capped: a slow network must never hold a section in
 * its pre-animation state, and ScrollTrigger re-measures when the fonts do
 * land (see SmoothScrollProvider).
 */
const FONT_WAIT_CAP = 1200;

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
    let cap = 0;

    const start = () => {
      if (cancelled || ctx) return;
      window.clearTimeout(cap);
      // Returning the teardown from the context function is what makes GSAP
      // run it during `revert()`.
      ctx = gsap.context((self) => setup(self, scope), scope);
    };

    // Lay the scope out so its faces are requested before the status is read.
    void scope.offsetHeight;

    const fonts = document.fonts;
    if (!fonts || fonts.status === 'loaded') {
      start();
    } else {
      cap = window.setTimeout(start, FONT_WAIT_CAP);
      fonts.ready.then(start, start);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(cap);
      ctx?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return scopeRef;
}
