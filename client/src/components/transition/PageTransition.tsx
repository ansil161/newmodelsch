import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { closeStage, openStage } from '@/lib/stage';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import { BrandMark } from './BrandMark';
import './transition.css';

/* ==========================================================================
   PAGE TRANSITION - one gesture, used twice
   --------------------------------------------------------------------------
   THE GESTURE

   The school's lockup - mark and name, one object - fades up in the centre of
   an ivory field, holds, then travels to the exact position it occupies in
   the masthead while the page fades in behind it. It lands on the real brand
   and the two are swapped in a single frame, so the thing the visitor was
   looking at in the middle of the screen turns out to be the navigation they
   are now using.

   That is the whole vocabulary. There is no second element with an entrance
   of its own, no direction, no per-letter or per-word stagger. The lockup is
   never animated apart, because the moment its two halves move independently
   it stops being a brand arriving and becomes a title sequence.

   USED TWICE, AT TWO LENGTHS

     FIRST VISIT (~2.1s, once per session)
       Empty ivory; the lockup fades up and grows into the centre, holds for
       about a second, then travels. The navigation's links arrive with the
       page.

     EVERY NAVIGATION AFTER IT (~1.0s)
       The same gesture with the hold taken out and a cover in front of it:
       the outgoing page dims under an ivory sheet, the lockup signs the
       centre, and travels to the masthead as the next page fades in. Smaller,
       quicker, and unmistakably the same movement - which is the point.

   WHY THE CLICK IS INTERCEPTED RATHER THAN THE ROUTE WATCHED

   A router swaps the tree the instant it is told to. Watching `location` and
   animating afterwards means the cover arrives over the page it was supposed
   to be hiding. So an internal link is caught in the capture phase, the cover
   is played, and the navigation happens once the viewport is covered. React
   Router's `Link` stands down as soon as it sees `defaultPrevented`, so
   nothing is duplicated and the routing table is untouched.

   Navigations this cannot catch - the back button, a redirect, anything
   programmatic - get the same gesture starting from a cover instead of
   ending in one.

   WHAT HOLDS THE PAGE UNDERNEATH

   `lib/stage.ts`. Entrances mount and build themselves while the sheet is
   down, then wait, and are released as the lockup begins its travel - so the
   page arrives *with* the brand rather than after it.
   ========================================================================== */

/** One key, one session. The name the brief specified. */
const SEEN_KEY = 'nms_intro_seen';

/** Longest the intro will wait for the webfont before starting without it. */
const PREROLL_CEILING = 700;

/** Longest an internal transition holds its cover for a lazy page chunk. */
const CHUNK_CEILING = 2000;

/** Frames the reveal always waits, so React has committed and layout has run. */
const SETTLE_FRAMES = 3;

/* How large the centred lockup is: a share of the viewport, floored so it is
   still legible on a phone and capped so it never becomes a billboard. */
const CENTRE_MIN = 210;
const CENTRE_MAX = 430;
const CENTRE_SHARE = 0.33;

/** Bounds on the multiple of masthead size the lockup is laid out at. */
const K_MIN = 1.6;
const K_MAX = 3.6;

/* --------------------------------------------------------------------------
   THE DECISION IS MADE AT IMPORT TIME, NOT IN AN EFFECT.
   --------------------------------------------------------------------------
   The homepage hero starts building its entrance during the same commit this
   component first renders in, and `useGsapScope` runs it synchronously when
   the webfont is already cached. An effect - even a layout effect - is not
   reliably early enough to close the stage before that happens, and a hero
   that has already played is a hero the visitor never sees arrive.

   Module scope is. This file is imported by the Shell, which is imported by
   the router, all of it long before React renders anything.
   -------------------------------------------------------------------------- */
const WILL_INTRO = (() => {
  if (typeof window === 'undefined') return false;
  // Reduced motion gets no intro at all. A 300ms fade of a logo is not an
  // accessible version of a brand sequence, it is a delay with a logo in it.
  if (reduced()) return false;
  try {
    return sessionStorage.getItem(SEEN_KEY) !== '1';
  } catch {
    // Private browsing throws on access rather than returning null. An intro
    // that cannot record itself would run on every navigation, which is the
    // one behaviour the brief rules out - so it does not run at all.
    return false;
  }
})();

/* Closed here rather than in an effect - see the note above. The scroll lock
   is NOT set here: it is set in the effect that owns the timeline, so a module
   that loads and then fails to mount cannot leave the document unscrollable. */
if (WILL_INTRO) closeStage();

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* Unreachable: the guard above means we are not in this branch. */
  }
}

/** The masthead's own brand - the thing the lockup is a copy of. */
const brandEl = () => document.querySelector<HTMLElement>('.nav__brand');

/** Where the lockup starts and where it is going, in viewport coordinates. */
interface Flight {
  /** The lockup's laid-out size, which is `k` times the masthead brand's. */
  w: number;
  h: number;
  /** Top-left and scale that land it exactly on `.nav__brand`. */
  nx: number;
  ny: number;
  ns: number;
}

/**
 * The lockup's laid-out size, with any transform it is currently carrying
 * divided back out. Reading the box rather than trusting `--k` is what keeps
 * the arithmetic honest when the type rounds.
 */
function dims(lockup: HTMLElement) {
  const scale = (gsap.getProperty(lockup, 'scaleX') as number) || 1;
  const box = lockup.getBoundingClientRect();
  return { w: box.width / scale, h: box.height / scale };
}

/**
 * Where the lockup has to end up, measured against the real masthead brand.
 *
 * THIS IS DELIBERATELY RE-READ IMMEDIATELY BEFORE THE TRAVEL RATHER THAN
 * COMPUTED ONCE, and both reasons for that are real bugs it fixes:
 *
 *   THE WEBFONT. On a first visit the lockup is laid out before Fraunces has
 *   arrived, so "New Model" is measured in Georgia and the scale that lands it
 *   on the masthead is wrong by about seven per cent - enough that the
 *   handover pops.
 *
 *   THE MASTHEAD'S OWN HEIGHT. It is 76px at the top of a page and 62px once
 *   scrolled, and an internal navigation resets the scroll while the sheet is
 *   down. Measured at click time, the lockup lands where the compact bar used
 *   to be.
 *
 * `ns` comes from the two measured widths rather than from `1 / k`, so any
 * sub-pixel rounding in the scaled-up layout corrects itself at the landing.
 */
function landing(lockup: HTMLElement) {
  const brand = brandEl();
  if (!brand) return null;
  const nav = brand.getBoundingClientRect();
  if (!nav.width || !nav.height) return null;
  const { w, h } = dims(lockup);
  if (!w || !h) return null;
  return { w, h, nx: nav.left, ny: nav.top, ns: nav.width / w };
}

/**
 * The centred position for a given scale.
 *
 * The lockup is positioned by its top-left corner, so growing it has to be
 * paid for in x and y or the centre drifts as it scales. Both are linear in
 * `s`, so a tween between two of these keeps the centre pinned exactly.
 */
function centred(f: Flight, s: number) {
  return {
    x: (window.innerWidth - f.w * s) / 2,
    y: (window.innerHeight - f.h * s) / 2,
    scale: s,
  };
}

export function PageTransition() {
  const navigate = useNavigate();
  const location = useLocation();
  const { start, stop } = useSmoothScroll();

  const root = useRef<HTMLDivElement>(null);
  const master = useRef<gsap.core.Timeline | null>(null);
  /** True from the moment a transition is committed to until it has finished. */
  const busy = useRef(false);
  /** Guards the location watcher against reacting to our own navigations. */
  const known = useRef(location.pathname);

  /* --------------------------------------------------------------------------
     Shared plumbing
     -------------------------------------------------------------------------- */

  const parts = useCallback(() => {
    const el = root.current;
    if (!el) return null;
    const sheet = el.querySelector<HTMLElement>('.pt__sheet');
    const stage = el.querySelector<HTMLElement>('.pt__stage');
    const lockup = el.querySelector<HTMLElement>('.pt__lockup');
    if (!sheet || !stage || !lockup) return null;
    return { el, sheet, stage, lockup };
  }, []);

  /**
   * Lay the lockup out at the right multiple of the masthead's size, and
   * return the flight it is about to make.
   *
   * `share` pitches the whole gesture: 1 for the first visit, less for a
   * navigation, which is the only difference between the two sizes. The
   * landing half of the result is provisional - see `landing`, which is
   * called again the instant before the travel begins.
   */
  const plot = useCallback((lockup: HTMLElement, share: number): Flight | null => {
    const brand = brandEl();
    if (!brand) return null;

    const nav = brand.getBoundingClientRect();
    if (!nav.width) return null;

    const wanted =
      gsap.utils.clamp(CENTRE_MIN, CENTRE_MAX, window.innerWidth * CENTRE_SHARE) * share;
    const k = gsap.utils.clamp(K_MIN, K_MAX, wanted / nav.width);
    lockup.style.setProperty('--k', String(k));

    return landing(lockup);
  }, []);

  /** Back to invisible, and back to being unable to swallow a click. */
  const rest = useCallback(() => {
    busy.current = false;
    document.documentElement.classList.remove('is-swapping');
    gsap.set('#main', { clearProps: 'opacity' });
    const brand = brandEl();
    if (brand) gsap.set(brand, { clearProps: 'opacity,visibility' });
    const p = parts();
    if (!p) return;
    p.el.classList.remove('is-busy');
    gsap.set([p.sheet, p.stage], { autoAlpha: 0 });
  }, [parts]);

  /* --------------------------------------------------------------------------
     FIRST VISIT
     -------------------------------------------------------------------------- */

  useIsomorphicLayoutEffect(() => {
    const p = parts();
    if (!p) return;

    if (!WILL_INTRO) {
      // The resting state, set before the first paint so the sheet never
      // shows on an ordinary load.
      gsap.set([p.sheet, p.stage], { autoAlpha: 0 });
      return;
    }

    markSeen();
    busy.current = true;
    p.el.classList.add('is-busy');
    document.documentElement.classList.add('is-loading', 'is-swapping');
    stop();

    const brand = brandEl();

    /* THE MASTHEAD'S BRAND IS HIDDEN FOR THE LENGTH OF THE TRANSITION.

       Without this there are two lockups on screen the moment the sheet
       starts to fade: the one travelling and the real one it is travelling
       towards. It comes back in the same frame the travelling copy goes out,
       and since they are the same object at the same size the swap cannot be
       seen.

       Set explicitly rather than with `from()`. These elements belong to the
       navigation, not to this component, so nothing reverts them on teardown -
       and under StrictMode a `from()` would record the hidden state the first
       run left behind and animate them from invisible to invisible. */
    gsap.set([p.sheet, p.stage], { autoAlpha: 1 });
    gsap.set('.nav__links, .nav__end', { y: -10, autoAlpha: 0 });
    if (brand) gsap.set(brand, { autoAlpha: 0 });
    gsap.set(p.lockup, { autoAlpha: 0 });

    const release = () => {
      document.documentElement.classList.remove('is-loading');
      start();
    };

    /** The masthead takes over from the travelling copy, in one frame. */
    const handover = () => {
      if (brand) gsap.set(brand, { autoAlpha: 1 });
      gsap.set(p.lockup, { autoAlpha: 0 });
    };

    /* THE TIMELINE IS BUILT AFTER THE PRE-ROLL, NOT BEFORE IT.

       Its first frame needs the lockup's real laid-out width, and until the
       webfont lands that width is Georgia's rather than Fraunces's. Building
       here would centre the composition against the wrong measurement and
       then correct it in front of the visitor. */
    let tl: gsap.core.Timeline | null = null;

    const build = () => {
      const flight = plot(p.lockup, 1);

      tl = gsap.timeline({
        onComplete: () => {
          release();
          rest();
        },
      });
      master.current = tl;

      if (flight) {
        // Re-read the landing immediately before the travel; see `landing`.
        const target = { ...flight };
        const remeasure = () => Object.assign(target, landing(p.lockup) ?? target);

        gsap.set(p.lockup, { ...centred(flight, 0.8), autoAlpha: 0 });

        /* ---- the lockup arrives: one object, fading up and growing ---- */
        tl.to(p.lockup, {
          ...centred(flight, 1),
          autoAlpha: 1,
          duration: 0.62,
          ease: 'power2.out',
        });

        /* ---- it holds, and then it becomes the masthead ---- */
        tl.addLabel('travel', 1.3)
          .call(remeasure, undefined, 'travel-=0.02')
          .to(
            p.lockup,
            {
              x: () => target.nx,
              y: () => target.ny,
              scale: () => target.ns,
              duration: 0.55,
              ease: 'power2.inOut',
            },
            'travel',
          );
      } else {
        // No masthead to fly to - a measurement that failed, or a route that
        // renders without one. The brand still arrives and still holds; it
        // simply fades where it stands.
        tl.to(p.lockup, { autoAlpha: 1, duration: 0.62, ease: 'power2.out' }).addLabel(
          'travel',
          1.3,
        );
      }

      // The page is not uncovered, it arrives: the sheet and the ground
      // beneath it are the same ivory, so this fade reads as content resolving
      // rather than as a curtain being pulled off something already finished.
      tl.to(p.sheet, { autoAlpha: 0, duration: 0.5, ease: 'power1.inOut' }, 'travel+=0.06')
        .to(
          '.nav__links, .nav__end',
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.5,
            ease: 'power2.out',
            clearProps: 'transform,opacity,visibility',
          },
          'travel+=0.12',
        )
        // The page's own entrance, played into a viewport that is still
        // filling.
        .call(openStage, undefined, 'travel+=0.12')
        .call(release, undefined, 'travel+=0.4')
        .call(handover, undefined, 'travel+=0.55');
    };

    /* ---- the pre-roll ---- */
    let started = false;
    const begin = () => {
      if (started) return;
      started = true;
      build();
    };

    const fonts = document.fonts?.ready ?? Promise.resolve();
    const hero = new Promise<void>((resolve) => {
      const img = document.querySelector<HTMLImageElement>('.hero__frame img, .cover__media img');
      if (!img || img.complete) return resolve();
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    });

    Promise.all([fonts, hero]).then(begin).catch(begin);
    const ceiling = window.setTimeout(begin, PREROLL_CEILING);

    return () => {
      window.clearTimeout(ceiling);
      tl?.kill();
      master.current = null;
      // Whatever happened, the site is not left under a sheet it cannot lift,
      // and the navigation is not left holding a from-state it never animated
      // out of.
      document.documentElement.classList.remove('is-swapping');
      gsap.set('.nav__links, .nav__end', { clearProps: 'all' });
      if (brand) gsap.set(brand, { clearProps: 'opacity,visibility' });
      // `busy` is normally cleared by the timeline's own completion. A killed
      // timeline never completes, and a controller stuck on `busy` swallows
      // every link on the site.
      busy.current = false;
      release();
      openStage();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------------------------------------------------------
     INTERNAL NAVIGATION - the same gesture, without the hold
     --------------------------------------------------------------------------
     `to` is the destination for a navigation this controller started, and
     null for one it only found out about after the fact.
     -------------------------------------------------------------------------- */

  const run = useCallback(
    (to: string | null) => {
      const p = parts();
      if (!p) {
        if (to) navigate(to);
        return;
      }

      busy.current = true;
      p.el.classList.add('is-busy');
      document.documentElement.classList.add('is-swapping');
      closeStage();
      master.current?.kill();

      const go = () => {
        if (!to) return;
        known.current = new URL(to, window.location.href).pathname;
        navigate(to);
      };

      /* REDUCED MOTION: a cross-fade of the sheet and nothing else. No travel,
         no growth, no lockup - just enough to mark that the page changed. */
      if (reduced()) {
        gsap.set([p.sheet, p.stage], { autoAlpha: 0 });

        const quiet = gsap.timeline({ onComplete: rest });
        master.current = quiet;
        quiet
          .to(p.sheet, { autoAlpha: 1, duration: 0.16 })
          .call(() => {
            go();
            openStage();
          })
          .to(p.sheet, { autoAlpha: 0, duration: 0.22 }, '+=0.06');
        return;
      }

      const brand = brandEl();
      // Three quarters of the intro's size: the same movement pitched one step
      // quieter, so a navigation reads as an echo of the arrival rather than
      // as the arrival happening again.
      const flight = plot(p.lockup, 0.75);

      // A navigation we did not start has already swapped the page underneath,
      // so the cover has nothing left to hide and only has to arrive fast.
      const caught = to !== null;
      const coverIn = caught ? 0.34 : 0.18;

      gsap.set([p.sheet, p.stage], { autoAlpha: 1 });
      gsap.set(p.sheet, { opacity: 0 });
      if (flight) gsap.set(p.lockup, { ...centred(flight, 0.9), autoAlpha: 0 });
      else gsap.set(p.lockup, { autoAlpha: 0 });

      const handover = () => {
        if (brand) gsap.set(brand, { autoAlpha: 1 });
        gsap.set(p.lockup, { autoAlpha: 0 });
      };

      const tl = gsap.timeline({ onComplete: rest });
      master.current = tl;

      // The outgoing page steps back rather than leaving. Opacity only: a
      // transform on `#main` would become the containing block for every
      // pinned section inside it and drag the pins off the screen.
      if (caught) {
        tl.to('#main', { opacity: 0.4, duration: coverIn, ease: 'power2.in' }, 0);
      }

      tl.to(p.sheet, { opacity: 1, duration: coverIn, ease: 'power2.inOut' }, 0)
        // Once the sheet is opaque the masthead's brand is handed over to the
        // travelling copy, so only one of them is ever on screen.
        .call(
          () => {
            if (brand) gsap.set(brand, { autoAlpha: 0 });
          },
          undefined,
          coverIn * 0.9,
        );

      if (flight) {
        tl.to(
          p.lockup,
          { ...centred(flight, 1), autoAlpha: 1, duration: 0.34, ease: 'power2.out' },
          coverIn * 0.5,
        );
      } else {
        tl.to(p.lockup, { autoAlpha: 1, duration: 0.34, ease: 'power2.out' }, coverIn * 0.5);
      }

      /* The timeline stops here until the next page is genuinely on screen. A
         lazily-loaded route chunk can outlast the cover, and travelling on
         schedule would uncover the Suspense fallback instead of the page. */
      tl.addPause(coverIn + 0.16, () => {
        go();
        gsap.set('#main', { clearProps: 'opacity' });

        let frames = 0;
        let raf = 0;
        let ceiling = 0;

        const resume = () => {
          cancelAnimationFrame(raf);
          window.clearTimeout(ceiling);
          tl.play();
        };

        const poll = () => {
          // The Suspense fallback is the honest signal: while it is in the DOM
          // the route's chunk has not arrived and there is nothing to reveal
          // but a loading bar.
          if (!document.querySelector('.page-fallback') && frames >= SETTLE_FRAMES) return resume();
          frames += 1;
          raf = requestAnimationFrame(poll);
        };

        raf = requestAnimationFrame(poll);
        // A slow chunk gets the sheet lifted anyway: waiting behind a brand
        // mark indefinitely is worse than showing the loading bar for a beat.
        ceiling = window.setTimeout(resume, CHUNK_CEILING);
      });

      /* ---- and the same travel, a little quicker ---- */
      tl.addLabel('travel');

      if (flight) {
        // Re-read the landing here rather than reusing the click-time
        // measurement: the scroll has been reset under the sheet, so the
        // masthead is back at its full height and its brand has moved.
        const target = { ...flight };
        tl.call(() => Object.assign(target, landing(p.lockup) ?? target), undefined, 'travel-=0.02')
          .to(
            p.lockup,
            {
              x: () => target.nx,
              y: () => target.ny,
              scale: () => target.ns,
              duration: 0.48,
              ease: 'power2.inOut',
            },
            'travel',
          );
      } else {
        tl.to(p.lockup, { autoAlpha: 0, duration: 0.3 }, 'travel');
      }

      tl.to(p.sheet, { autoAlpha: 0, duration: 0.42, ease: 'power1.inOut' }, 'travel+=0.05')
        .call(openStage, undefined, 'travel+=0.1')
        .call(handover, undefined, 'travel+=0.48');
    },
    [navigate, parts, plot, rest],
  );

  /* --------------------------------------------------------------------------
     Catching the link
     -------------------------------------------------------------------------- */

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const target = anchor.getAttribute('target');
      if (anchor.hasAttribute('download') || (target && target !== '_self')) return;
      if ((anchor.getAttribute('rel') ?? '').includes('external')) return;

      // A bare hash is an in-page anchor - the skip link included, which has
      // to keep working exactly as it does today.
      const raw = anchor.getAttribute('href') ?? '';
      if (!raw || raw.startsWith('#')) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      // Covers mailto:, tel:, and anything else that is not this site.
      if (url.origin !== window.location.origin) return;
      // Same page: let the router handle its own hash.
      if (url.pathname === window.location.pathname) return;

      event.preventDefault();
      // A second click mid-transition is a visitor who thinks nothing
      // happened. Swallowing it beats queueing two navigations.
      if (busy.current) return;

      run(url.pathname + url.search + url.hash);
    };

    // Capture, so this runs before React's delegated handler and React
    // Router's `Link` sees a prevented event and stands down.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [run]);

  /* Navigations nothing could catch: the back button, a redirect, a `navigate`
     from inside a component. The tree has already swapped, so this is the
     cover-first version of the same gesture. */
  useEffect(() => {
    if (location.pathname === known.current) return;
    known.current = location.pathname;
    if (busy.current) return;
    run(null);
  }, [location.pathname, run]);

  useEffect(
    () => () => {
      master.current?.kill();
      master.current = null;
      openStage();
    },
    [],
  );

  return (
    <div className="pt" ref={root} aria-hidden="true" inert>
      <div className="pt__sheet" />
      <div className="pt__stage">
        <BrandMark />
      </div>
    </div>
  );
}
