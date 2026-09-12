import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { ScrollTrigger } from '@/lib/gsap';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';

/**
 * Route housekeeping for a Lenis + ScrollTrigger site.
 *
 * Three things have to happen on every navigation, in this order:
 *  1. the viewport goes back to the top — a router does not do this for you,
 *     and Lenis will happily keep its old scroll position across a page swap;
 *  2. ScrollTrigger re-measures, because the outgoing page's pinned sections
 *     have just been removed and every remaining trigger's start/end is stale;
 *  3. focus moves to `<main>`, so a keyboard or screen-reader user is not left
 *     halfway down a page that no longer exists.
 *
 * A hash in the URL is honoured instead of the jump to top — see `anchorTo`.
 */

/** Clearance left above an anchored section, so the masthead does not cover it. */
const HEADROOM = 96;

/** ~4s at 60fps: long enough for a code-split page chunk on a slow connection. */
const MAX_FRAMES = 240;

/**
 * When the anchor re-checks itself, in ms after the first scroll. These are
 * the moments the page is still capable of changing height: the webfont swap,
 * the smooth-scroll provider's settle timer, and the route's own late refresh.
 */
const CORRECTIONS = [400, 1000, 2200];

export function RouteTransition() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const { scrollTo } = useSmoothScroll();
  const firstRender = useRef(true);

  useEffect(() => {
    // THE FIRST RENDER IS THE PRELOADER'S JOB — EXCEPT WHEN THERE IS A HASH.
    //
    // This used to return unconditionally on the first render, which meant a
    // link straight to `/admissions#enquiry` — the exact link the site's own
    // chrome puts on every "Enquire" button, and the one a parent is most
    // likely to have bookmarked — landed at the top of the page and left them
    // to find the form themselves. The browser's own anchor jump does not help:
    // the target is inside a lazily-loaded route chunk that has not rendered
    // when the browser looks for it, and Lenis owns the scroll position anyway.
    if (firstRender.current) {
      firstRender.current = false;
      if (!hash) return;
    }

    // A browser back/forward should keep the position the browser restored.
    const restoring = navigationType === 'POP';

    let raf = 0;
    let disposeAnchor: (() => void) | undefined;

    const settle = () => {
      // Re-measure first. `refresh()` records and restores the scroll position
      // as part of its work, so running it after a scroll would undo the
      // scroll — an anchor jump would land wherever the page happened to be.
      ScrollTrigger.refresh();

      if (hash) {
        disposeAnchor = anchorTo(hash, scrollTo);
      } else if (!restoring) {
        // Through Lenis, not `window.scrollTo`: a native jump would leave
        // Lenis on the old page's offset and every ScrollTrigger measuring
        // against a scroll position that no longer exists.
        scrollTo(0, 0, { immediate: true });
      }
    };

    // Two frames: one for React to commit the new tree, one for layout.
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(settle);
    });

    const main = document.getElementById('main');
    main?.setAttribute('tabindex', '-1');
    main?.focus({ preventScroll: true });

    // Late-loading images change document height long after the swap.
    const timer = window.setTimeout(() => ScrollTrigger.refresh(), 800);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      disposeAnchor?.();
    };
  }, [pathname, hash, navigationType, scrollTo]);

  return null;
}

/* ==========================================================================
   ANCHORING TO A SECTION ON A PAGE THAT IS STILL CHANGING HEIGHT
   --------------------------------------------------------------------------
   This is harder than it looks, and every simpler version of it was tried
   first and observably missed.

   THE PROBLEM. Two pages carry a pinned section, and a ScrollTrigger pin
   inserts a spacer worth thousands of pixels. That spacer does not exist until
   ScrollTrigger has measured the page, it is rebuilt on every subsequent
   refresh, and the refreshes keep coming — on font load, on the provider's
   settle timer, on window load. So an anchor several sections below a pin is a
   moving target: scroll to where it is, and it is somewhere else a second
   later. Polling for a "stable" offset does not fix it either, because the
   offset is perfectly stable in between refreshes and then moves again.

   THE FIX. Scroll once, then re-align a fixed handful of times over the next
   couple of seconds:

     1. Poll frames until the target exists and the preloader has released its
        scroll lock, then scroll to it and let the reader see the travel.
     2. Re-align, without animation, at 400ms, 1s and 2.2s. If nothing moved,
        each correction is a no-op.
     3. Stop the instant the visitor scrolls, taps or presses a key. Their
        scroll wins; a page that keeps yanking itself back is worse than a page
        that landed slightly wrong.

   THE CORRECTIONS ARE ON A TIMER RATHER THAN ON ScrollTrigger'S `refresh`
   EVENT, WHICH IS THE OBVIOUS HOOK AND IS A TRAP. Re-aligning from inside a
   refresh handler moves the scroll position, which changes which pinned
   sections are engaged, which makes ScrollTrigger re-measure, which fires
   `refresh` again. It locks the renderer. A fixed schedule cannot feed back
   into itself, and three samples is plenty: the refreshes that move things are
   the font load and the provider's own settle timers, and all of them land
   inside two seconds.

   `scrollTo` is Lenis's, never `window.scrollTo`: a native jump leaves Lenis
   and ScrollTrigger holding a stale position.
   ========================================================================== */

type ScrollFn = (
  target: string | number | HTMLElement,
  offset?: number,
  options?: { immediate?: boolean },
) => void;

function anchorTo(hash: string, scrollTo: ScrollFn) {
  let frames = 0;
  let raf = 0;
  let done = false;
  const timers: number[] = [];

  const stop = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    timers.forEach(window.clearTimeout);
    window.removeEventListener('wheel', stop);
    window.removeEventListener('touchstart', stop);
    window.removeEventListener('keydown', stop);
  };

  const realign = () => {
    const target = document.querySelector<HTMLElement>(hash);
    if (!target || done) return;
    const wanted = target.getBoundingClientRect().top + window.scrollY - HEADROOM;
    // A no-op when nothing moved. The threshold is generous because a couple
    // of pixels of drift is not worth a jump.
    if (Math.abs(wanted - window.scrollY) > 24) {
      scrollTo(target, -HEADROOM, { immediate: true });
    }
  };

  const find = () => {
    const target = document.querySelector<HTMLElement>(hash);
    const locked = document.documentElement.classList.contains('is-loading');

    if (target && !locked) {
      scrollTo(target, -HEADROOM);

      window.addEventListener('wheel', stop, { passive: true, once: true });
      window.addEventListener('touchstart', stop, { passive: true, once: true });
      window.addEventListener('keydown', stop, { once: true });

      CORRECTIONS.forEach((delay) => timers.push(window.setTimeout(realign, delay)));
      timers.push(window.setTimeout(stop, CORRECTIONS[CORRECTIONS.length - 1] + 200));
      return;
    }

    if (frames++ < MAX_FRAMES) raf = requestAnimationFrame(find);
  };

  raf = requestAnimationFrame(find);

  return stop;
}
