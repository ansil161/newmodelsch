import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import { useReducedMotion } from '@/hooks/useMediaQuery';

const SmoothScrollContext = createContext(null);

export function SmoothScrollProvider({ children }) {
  const lenisRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const [, force] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      lenisRef.current?.destroy();
      lenisRef.current = null;
      return;
    }

    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.8,
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;
    force((n) => n + 1);

    // A handle on the scroller, in development only.
    //
    // Lenis owns the scroll position on this site, so `window.scrollTo` from a
    // console or a test harness fights it: the two disagree about where the
    // page is and the result has repeatedly been a frozen renderer rather than
    // a moved viewport. Anything that needs to jump the page has to ask Lenis,
    // and until now nothing outside React could reach it. Stripped from
    // production builds by the constant folding on `import.meta.env.DEV`.
    if (import.meta.env.DEV) {
      window.__lenis = lenis;
    }

    // Lenis drives ScrollTrigger. Because Lenis scrolls `window` natively (it
    // does not transform a wrapper), ScrollTrigger needs no scrollerProxy —
    // it only needs to be told when a scroll frame happened.
    lenis.on('scroll', ScrollTrigger.update);

    const tick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // Pinned sections change document height; refresh once everything settles.
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', refresh);
    const timer = window.setTimeout(refresh, 600);

    // A backgrounded tab throttles rAF, so Lenis stops driving ScrollTrigger and
    // any scrolling done meanwhile is missed. Re-measuring on the way back in
    // settles every trigger against the real scroll position — without it, a
    // one-shot reveal can be left holding its hidden from-state.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    // LATE-LOADING PHOTOGRAPHY, AND WHY THIS IS NOW A GUARD RATHER THAN A HOOK.
    //
    // Interior pages run to ten thousand pixels of lazily-loaded images. This
    // used to call `ScrollTrigger.refresh()` 180ms after every single one of
    // them, because an image arriving pushed everything below it down and a
    // `once` reveal whose start had drifted past the viewport would never fire.
    //
    // That is no longer true. Every photograph on the site goes through
    // `Figure`, which reserves its aspect ratio before the file arrives, so a
    // loading image does not move anything. What the old listener did instead
    // was feed a loop: on a page with a pinned section, `refresh()` re-measures
    // the pin spacer, which shifts what is in the viewport, which starts more
    // lazy loads, which schedules another refresh. On a long page that ran for
    // seconds and could lock the renderer outright.
    //
    // So the listener stays, because a stray unsized image in future content
    // should not silently strand a section - but it only refreshes when the
    // document height has ACTUALLY changed, and never more than once every
    // 400ms. In the normal case it now costs one height comparison per image
    // and does nothing.
    let imageTimer = 0;
    let lastHeight = document.documentElement.scrollHeight;

    const onMediaLoad = (event) => {
      const target = event.target;
      if (!target || target.tagName !== 'IMG') return;

      window.clearTimeout(imageTimer);
      imageTimer = window.setTimeout(() => {
        const height = document.documentElement.scrollHeight;
        if (height === lastHeight) return;
        lastHeight = height;
        refresh();
        // Read the height back *after* the refresh, so the pin-spacer changes
        // the refresh itself made are not mistaken for the next image moving
        // the page. This is the line that breaks the feedback loop.
        lastHeight = document.documentElement.scrollHeight;
      }, 400);
    };
    document.addEventListener('load', onMediaLoad, true);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(imageTimer);
      document.removeEventListener('load', onMediaLoad, true);
      window.removeEventListener('load', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [reduceMotion]);

  const value = useMemo(
    () => ({
      scrollTo: (target, offset = 0, options) => {
        const lenis = lenisRef.current;
        if (lenis) {
          lenis.scrollTo(target, {
            offset,
            ...(options?.immediate ? { immediate: true } : { duration: 1.6 }),
          });
          return;
        }
        const el =
          typeof target === 'string' ? document.querySelector(target) : target;
        if (typeof el === 'number') {
          window.scrollTo({ top: el + offset });
        } else if (el) {
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset });
        }
      },
      stop: () => lenisRef.current?.stop(),
      start: () => lenisRef.current?.start(),
    }),
    [],
  );

  return <SmoothScrollContext.Provider value={value}>{children}</SmoothScrollContext.Provider>;
}

export function useSmoothScroll() {
  const ctx = useContext(SmoothScrollContext);
  if (!ctx) throw new Error('useSmoothScroll must be used inside <SmoothScrollProvider>');
  return ctx;
}
