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

    // LATE LAYOUT, AND WHY THIS IS A GUARD RATHER THAN A HOOK.
    //
    // ScrollTrigger measures every start and end once, and anything that
    // changes the page's height afterwards leaves the triggers below it
    // pointing at where the content used to be: a reveal fires early or late,
    // a pin engages a few dozen pixels off. Photographs are not the only late
    // arrival. The webfonts are served with `display=swap` and land seconds
    // after first paint, re-wrapping headings; an FAQ answer opens; a route's
    // lazy sections mount. So the page itself is watched rather than one kind
    // of event: a ResizeObserver on <body>.
    //
    // It refreshes only when the document height has ACTUALLY changed, and at
    // most once per settle (250ms after the last change). A refresh can itself
    // change the height - it re-measures pin spacers - and on a page with a
    // pinned section that used to feed a loop: refresh, spacer moves, more lazy
    // loads, refresh. Reading the height back after the refresh breaks it.
    //
    // A change of window height alone is ignored: that is a phone's address
    // bar collapsing mid-scroll, and re-measuring under a moving thumb is the
    // very jump `ignoreMobileResize` exists to prevent.
    let layoutTimer = 0;
    let lastHeight = document.documentElement.scrollHeight;
    let lastView = [window.innerWidth, window.innerHeight];

    const layout = new ResizeObserver(() => {
      window.clearTimeout(layoutTimer);
      layoutTimer = window.setTimeout(() => {
        const height = document.documentElement.scrollHeight;
        const view = [window.innerWidth, window.innerHeight];
        const addressBar = view[0] === lastView[0] && view[1] !== lastView[1];
        lastView = view;
        if (height === lastHeight || addressBar) {
          lastHeight = height;
          return;
        }
        refresh();
      }, 250);
    });
    layout.observe(document.body);

    // The baseline is the height as of the LAST refresh, whoever ran it - a
    // route settling, a section re-measuring after its own split, this
    // observer. Read *after* the refresh, so the pin-spacer changes a refresh
    // makes are never mistaken for the next late change (the line that breaks
    // the feedback loop), and a component's own refresh is never repeated.
    const syncHeight = () => {
      lastHeight = document.documentElement.scrollHeight;
    };
    ScrollTrigger.addEventListener('refresh', syncHeight);

    // KEEPING THE READER'S PLACE THROUGH A ROTATION.
    //
    // A refresh scrolls the page to the top to measure, then puts it back.
    // When a resize also crosses a breakpoint that a `gsap.matchMedia` block
    // listens to - a tablet turned from portrait to landscape, a window
    // dragged past 900px - the media change and the resize each refresh, one
    // inside the other, and the inner one records the "back" position while
    // the page is still at the top. The reader lands at the top of the page.
    //
    // So the place is remembered here, as a fraction of the scrollable length
    // rather than a pixel offset, because the page is a different height in
    // the new orientation. It is taken on the first resize of a burst, before
    // any refresh has run, and put back after every refresh the burst causes.
    // Only a width change counts: a phone's address bar collapsing changes the
    // height alone, and must never move the page under a thumb.
    let lastWidth = window.innerWidth;
    let place = null;
    let placeTimer = 0;

    const maxScroll = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const onResize = () => {
      const width = window.innerWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      if (place === null) {
        const max = maxScroll();
        place = max ? window.scrollY / max : 0;
      }
      window.clearTimeout(placeTimer);
      placeTimer = window.setTimeout(() => {
        place = null;
      }, 1500);
    };

    const restorePlace = () => {
      if (place === null) return;
      const target = Math.round(place * maxScroll());
      if (Math.abs(window.scrollY - target) > 2) {
        lenis.scrollTo(target, { immediate: true, force: true });
      }
    };

    window.addEventListener('resize', onResize);
    ScrollTrigger.addEventListener('refresh', restorePlace);

    return () => {
      window.clearTimeout(placeTimer);
      window.removeEventListener('resize', onResize);
      ScrollTrigger.removeEventListener('refresh', restorePlace);
      window.clearTimeout(timer);
      window.clearTimeout(layoutTimer);
      layout.disconnect();
      ScrollTrigger.removeEventListener('refresh', syncHeight);
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
