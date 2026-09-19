import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { VOICE_CATEGORIES, VOICE_SECTION } from '@/constants/voices';
import { resolve, resolveSet } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { useMediaQuery, useReducedMotion } from '@/hooks/useMediaQuery';
import { ScrollTrigger, SplitText, gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Figure, Hand, Script } from '@/components/editorial';
import './voices.css';

/* Every voice in reading order. Categories are contiguous, so a category's
   cards are `FIRST_OF[cat] + pos`. */
const VOICES = VOICE_CATEGORIES.flatMap((category, cat) =>
  category.stories.map((story, pos) => ({ story, cat, pos })),
);
const FIRST_OF = VOICE_CATEGORIES.map((_, cat) =>
  Math.max(
    0,
    VOICES.findIndex((voice) => voice.cat === cat),
  ),
);
const wrap = (i) => ((i % VOICES.length) + VOICES.length) % VOICES.length;

/* The outgoing half, in seconds. The incoming half runs about 0.6, so a
   hand-off is a little under a second door to door. */
const OUT = 0.3;

/* How long a voice holds once it has fully landed. The hand-off on top of it
   takes about a second, so the cards slide and the voice changes every three
   seconds. */
const DWELL = 2;

/* The rail follows the scroll natively below this width, and is moved by a
   transform above it. The stylesheet switches at the same point. */
const NATIVE_RAIL = '(max-width: 899px)';
const LOOP_RAIL = '(min-width: 900px)';

/* THE RAIL IS A LOOP ON A WIDE SCREEN.

   The cast is rendered several times over, end to end, and the track slides
   one card per voice: forward is right to left, back is left to right. When
   the slide runs past the end of one copy it lands on the identical card in
   the next and is quietly re-based onto the first, so it can keep travelling
   in the same direction for ever rather than rewinding across the row.

   Enough copies that there are always cards beyond the right-hand edge, even
   for a two-voice category mid-way through a wrap: at least twelve cards. */
const copiesFor = (count) => Math.max(3, Math.ceil(12 / Math.max(1, count)));

/* The properties a hand-off writes inline, and so the ones it hands back. */
const MOVED = 'opacity,visibility,transform,clipPath';

/* The portrait's slot. Shared by the <Figure> and by the preloader, so the
   file the preloader decodes is the file the browser then picks. */
const PORTRAIT = {
  width: 720,
  widths: [420, 720, 1080],
  sizes: '(max-width: 699px) 74vw, (max-width: 1279px) min(44vw, 400px), 23vw',
};

/* --------------------------------------------------------------------------
   The portrait preloader.

   Each portrait is a fresh <img> (it is keyed by voice), and a fresh lazy,
   async-decoded image is empty for the frames it takes to arrive. Revealing
   it in that state prints a blank frame - which is what the old arrival did
   whenever the reader got there before the photograph did. So the hand-off
   waits for the incoming file to decode, and never for longer than `limit`.
   -------------------------------------------------------------------------- */
/* The small face beside the name. Fetched alongside the portrait but never
   waited for - it is 66px, and a hand-off should not be held up by it. */
const FACE = { width: 160, widths: [120, 160, 320], sizes: '66px' };

const warmed = new Set();

function load(photo, slot) {
  const img = new Image();
  // `sizes` before `srcset`, so the candidate is chosen against the real slot.
  img.sizes = slot.sizes;
  const set = resolveSet(photo, slot.widths);
  if (set) img.srcset = set;
  img.src = resolve(photo, slot.width);
  return img;
}

function warm(photo, limit = 700) {
  if (warmed.has(photo.id) || typeof Image === 'undefined') return Promise.resolve();
  load(photo, FACE);
  const img = load(photo, PORTRAIT);
  const decoded = img.decode().then(
    () => {
      warmed.add(photo.id);
    },
    () => undefined,
  );
  return Promise.race([decoded, new Promise((done) => window.setTimeout(done, limit))]);
}

/* The pieces a hand-off moves. Queried rather than held in refs because
   several of them are replaced by React on every change, and a ref to a node
   that has been unmounted is a tween writing to nothing.

   `cards` is the button inside each card rather than the card itself: the
   card carries the rail's scrubbed depth, and two timelines writing `y` to
   one element is a fight neither of them wins. */
const parts = (root) => ({
  eyebrow: root.querySelector('[data-swap="eyebrow"]'),
  lead: root.querySelector('[data-swap="lead"]'),
  head: root.querySelector('[data-swap="head"]'),
  accent: root.querySelector('[data-swap="accent"]'),
  by: root.querySelector('[data-swap="by"]'),
  portrait: root.querySelector('[data-swap="portrait"]'),
  meter: root.querySelector('[data-swap="meter"]'),
  cards: Array.from(root.querySelectorAll('.vx__card-btn')),
});

const present = (...nodes) =>
  nodes.filter((node) => Boolean(node));

function revert(list) {
  list.current.forEach((split) => split.revert());
  list.current = [];
}

/* --------------------------------------------------------------------------
   D. The category hand-off - the half of a change that only happens when the
   index crosses from one category into another.
   -------------------------------------------------------------------------- */
function categoryOut(tl, p, dir) {
  const furniture = present(p.eyebrow, p.lead);
  if (furniture.length) tl.to(furniture, { x: -18 * dir, autoAlpha: 0 }, 0);
  if (p.cards.length) tl.to(p.cards, { y: 18, autoAlpha: 0, duration: 0.28, stagger: 0.03 }, 0);
}

function categoryIn(tl, p, dir) {
  const furniture = present(p.eyebrow, p.lead);
  if (furniture.length) {
    tl.fromTo(
      furniture,
      { x: 24 * dir, autoAlpha: 0 },
      { x: 0, autoAlpha: 1, duration: 0.44, stagger: 0.04 },
      0.04,
    );
  }
  if (p.cards.length) {
    tl.fromTo(
      p.cards,
      { y: 34, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.05 },
      0.12,
    );
  }
}

export function HomeVoices() {
  const [activeTestimonialIndex, setActiveTestimonialIndex] = useState(0);

  const active = VOICES[activeTestimonialIndex];
  const category = VOICE_CATEGORIES[active.cat];
  const stories = category.stories;
  const current = active.story;

  const wide = useMediaQuery(LOOP_RAIL);
  const still = useReducedMotion();
  const loop = wide && !still;
  const copies = loop ? copiesFor(stories.length) : 1;

  const navRef = useRef(null);
  const railRef = useRef(null);
  const trackRef = useRef(null);
  const tabRefs = useRef([]);
  const liveRef = useRef(null);

  /* The index as the running animation sees it. `activeRef` is what the DOM
     is showing; `targetRef` is what was last asked for. They differ only
     while a hand-off is travelling between them. Everything below reads
     these rather than state, so no callback can act on a stale index. */
  const activeRef = useRef(0);
  const targetRef = useRef(0);
  const dirRef = useRef(1);

  const phase = useRef('idle');
  const transition = useRef(null);
  const pendingIn = useRef(null);
  /** Whether the outgoing half took the category furniture with it. */
  const hidCategory = useRef(false);

  /** Every SplitText a timeline is holding open, per timeline.
   *
   *  A split replaces an element's text with a stack of <div>s, so each one is
   *  reverted before React is allowed to write into that element again - and
   *  only by the timeline that made it. The old version shared one list and
   *  reverted all of it from whichever tween finished first, which un-split
   *  the headline while its own lines were still travelling. */
  const entrySplits = useRef([]);
  const transitionSplits = useRef([]);

  const entry = useRef(null);
  const entryTargets = useRef([]);
  const entered = useRef(false);

  const dwell = useRef(null);
  const dwellBar = useRef([]);

  /** Whether the rail is currently rendered as a loop, for the functions that
   *  run outside a render. */
  const loopRef = useRef(loop);
  loopRef.current = loop;
  /** The card position the track is travelling to, so a second request for
   *  the same place does not restart a slide that is already under way. */
  const trackGoal = useRef(-1);
  const inView = useRef(false);
  const hold = useRef({ hover: false, focus: false, hidden: false });

  /** The GSAP setup has run (it waits for webfonts). Before that, changes
   *  are applied without animation. */
  const ready = useRef(false);
  const alive = useRef(true);
  const shownCat = useRef(-1);
  const depthCards = useRef([]);

  /* ------------------------------------------------------------------------
     Furniture that follows the index without being part of the hand-off:
     the marker behind the category, the phone's category strip, the rail's
     position and the progress line under the quote.
     ------------------------------------------------------------------------ */
  const placeMarker = (animate) => {
    const nav = navRef.current;
    const marker = nav?.querySelector('.vx__marker');
    const on = nav?.querySelector('[aria-selected="true"]');
    if (!nav || !marker || !on) return;
    const box = nav.getBoundingClientRect();
    const hit = on.getBoundingClientRect();
    const to = {
      x: hit.left - box.left + nav.scrollLeft,
      y: hit.top - box.top,
      width: hit.width,
      height: hit.height,
      autoAlpha: 1,
    };
    gsap.killTweensOf(marker);
    if (animate) gsap.to(marker, { ...to, duration: 0.55, ease: 'power3.out' });
    else gsap.set(marker, to);
  };

  /* Moves the rail to the active card.

     WIDE, WITH MOTION   the loop: the active card slides to the left-hand edge
                         of the rail in the direction of travel - see
                         `copiesFor` above.
     WIDE, REDUCED       one copy, and the track is placed rather than slid.
     NARROW              the rail is its own scroller, so the rail - never the
                         page, which Lenis owns - is scrolled to the card. */
  const positionTrack = (pos, animate, dir = 1) => {
    const rail = railRef.current;
    const track = trackRef.current;
    const first = track?.children[0];
    if (!rail || !track || !first) return;

    if (window.matchMedia(NATIVE_RAIL).matches) {
      const card = track.children[pos];
      gsap.killTweensOf(track, 'x');
      gsap.set(track, { x: 0 });
      trackGoal.current = -1;
      if (!card || rail.scrollWidth <= rail.clientWidth) return;
      rail.scrollTo({
        left: Math.max(0, card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2),
        behavior: animate && !reduced() ? 'smooth' : 'auto',
      });
      return;
    }

    if (rail.scrollLeft) rail.scrollLeft = 0;
    const second = track.children[1];
    const slot = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth;
    if (!slot) return;

    if (!loopRef.current) {
      const style = getComputedStyle(rail);
      const inner =
        rail.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const span = Math.max(0, track.scrollWidth - inner);
      gsap.killTweensOf(track, 'x');
      gsap.set(track, { x: -gsap.utils.clamp(0, span, pos * slot) });
      trackGoal.current = -1;
      return;
    }

    // Already sliding there: let the slide finish on its own curve.
    if (animate && trackGoal.current === pos && gsap.isTweening(track)) return;

    const count = VOICE_CATEGORIES[VOICES[activeRef.current].cat].stories.length;
    gsap.killTweensOf(track, 'x');

    /* Where the rail is now, in cards, re-based into the first copy - it may
       be caught mid-slide, or parked past the end of a copy. */
    let from = -(Number(gsap.getProperty(track, 'x')) || 0) / slot;
    from = ((from % count) + count) % count;
    let to = pos;
    // Forward past the end: carry on into the next copy rather than rewind.
    if (dir > 0 && to < from - 0.01) to += count;
    // Back past the start: begin from the same card one copy along.
    if (dir < 0 && to > from + 0.01) from += count;

    trackGoal.current = pos;
    gsap.set(track, { x: -from * slot });
    if (!animate || reduced() || Math.abs(to - from) < 0.01) {
      gsap.set(track, { x: -pos * slot });
      return;
    }

    gsap.to(track, {
      x: -to * slot,
      duration: Math.min(1.3, 0.8 + 0.15 * Math.abs(to - from)),
      ease: 'power3.inOut',
      // The card it landed on is identical to the one in the first copy.
      onComplete: () => {
        gsap.set(track, { x: -pos * slot });
      },
    });
  };

  const syncFurniture = (index, animate) => {
    const root = scope.current;
    if (!root) return;
    const { cat, pos } = VOICES[index];
    const motion = animate && !reduced();
    const crossed = shownCat.current !== cat;
    shownCat.current = cat;

    if (crossed) {
      depthCards.current = Array.from(root.querySelectorAll('.vx__card'));
      placeMarker(motion);

      // On a phone the index is a scrolling strip. Scroll the strip, never
      // the page.
      const nav = navRef.current;
      const on = nav?.querySelector('[aria-selected="true"]');
      if (nav && on && nav.scrollWidth > nav.clientWidth) {
        nav.scrollTo({
          left: on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2,
          behavior: motion ? 'smooth' : 'auto',
        });
      }
    }

    // A new cast arrives hidden, so its rail is placed rather than travelled.
    positionTrack(pos, motion && !crossed, dirRef.current);

    const fill = root.querySelector('.vx__meter-fill');
    if (fill) {
      const to = (pos + 1) / VOICE_CATEGORIES[cat].stories.length;
      gsap.killTweensOf(fill);
      if (motion) gsap.to(fill, { scaleX: to, duration: 0.6, ease: 'power3.out' });
      else gsap.set(fill, { scaleX: to });
    }
  };

  /* ------------------------------------------------------------------------
     C. Autoplay
     ------------------------------------------------------------------------ */
  const stopDwell = () => {
    dwell.current?.kill();
    dwell.current = null;
    if (dwellBar.current.length) gsap.set(dwellBar.current, { clearProps: 'transform' });
    dwellBar.current = [];
  };

  /* The one place that decides whether the clock runs. Called whenever any of
     its inputs change; it creates, pauses or resumes the single tween and
     never makes a second one. */
  const syncAutoplay = () => {
    const root = scope.current;
    if (!root) return;
    const allowed =
      ready.current &&
      entered.current &&
      inView.current &&
      !reduced() &&
      !hold.current.hover &&
      !hold.current.focus &&
      !hold.current.hidden;

    if (!allowed) {
      dwell.current?.pause();
      return;
    }
    if (phase.current !== 'idle') return;
    if (dwell.current) {
      dwell.current.resume();
      return;
    }

    // Every copy of the active card in the loop counts down together.
    const bars = Array.from(
      root.querySelectorAll('.vx__card-btn.is-on .vx__card-dwell'),
    );
    dwellBar.current = bars;
    dwell.current = gsap.fromTo(
      bars.length ? bars : {},
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: DWELL,
        ease: 'none',
        onComplete: () => {
          dwell.current = null;
          request(activeRef.current + 1, { dir: 1 });
        },
      },
    );
  };

  /** A reader handling the rail directly - a swipe, a wheel, a press - gets a
   *  full dwell before the rail is moved out from under them. */
  const restartClock = () => {
    if (!dwell.current) return;
    stopDwell();
    syncAutoplay();
  };

  /* ------------------------------------------------------------------------
     A. The arrival
     ------------------------------------------------------------------------ */

  /* Completes the arrival from wherever it is and hands every element it
     touched back to the stylesheet. Safe to call at any moment, any number of
     times: it is what makes an interrupted arrival impossible to strand. */
  const finishEntry = (resume = true) => {
    if (entered.current) return;
    entered.current = true;

    const tl = entry.current;
    entry.current = null;
    if (tl) {
      tl.scrollTrigger?.kill();
      tl.progress(1, true);
      tl.kill();
    }
    revert(entrySplits);
    if (entryTargets.current.length) {
      gsap.set(entryTargets.current, {
        clearProps: `${MOVED},strokeDasharray,strokeDashoffset`,
      });
    }
    entryTargets.current = [];
    if (resume) syncAutoplay();
  };

  const buildEntry = (root) => {
    const p = parts(root);
    const eyebrow = root.querySelector('.vx__eyebrow');
    const title = root.querySelector('.vx__title');
    const cta = root.querySelector('.vx__cta');
    const tabs = Array.from(root.querySelectorAll('.vx__tab'));
    const blobs = Array.from(root.querySelectorAll('.vx__blob'));

    /* Every tween is a `fromTo` with its destination written out, except the
       blobs, whose resting opacity belongs to the stylesheet. A `from` reads
       whatever the element is holding as its destination, and an element
       left mid-tween by an earlier timeline is holding the wrong thing. */
    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => finishEntry(),
      scrollTrigger: { trigger: root, start: 'top 80%', once: true },
    });

    // The testimonial first: it is what the reader came down the page for.
    if (p.portrait) {
      tl.fromTo(
        p.portrait,
        { autoAlpha: 0, scale: 1.045, clipPath: 'inset(0% 0% 12% 0%)' },
        {
          autoAlpha: 1,
          scale: 1,
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 0.85,
          ease: 'power3.inOut',
        },
        0,
      );
    }
    if (p.head) {
      const split = new SplitText(p.head, {
        type: 'lines',
        linesClass: 'vx__line',
      });
      entrySplits.current.push(split);
      tl.fromTo(
        split.lines,
        { yPercent: 60, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 0.72, stagger: 0.07 },
        0.08,
      );
    }
    if (p.accent) {
      tl.fromTo(
        p.accent,
        { clipPath: 'inset(-45% 100% -50% -6%)' },
        {
          clipPath: 'inset(-45% -6% -50% -6%)',
          duration: 0.6,
          ease: 'power2.inOut',
        },
        0.34,
      );
    }
    if (p.by) tl.fromTo(p.by, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 }, 0.4);
    if (p.meter) tl.fromTo(p.meter, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.48);

    // Then the furniture around it.
    if (eyebrow)
      tl.fromTo(eyebrow, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 }, 0);
    if (title) {
      const split = new SplitText(title, {
        type: 'lines',
        linesClass: 'vx__line',
      });
      entrySplits.current.push(split);
      tl.fromTo(
        split.lines,
        { yPercent: 55, autoAlpha: 0 },
        {
          yPercent: 0,
          autoAlpha: 1,
          duration: 1.05,
          ease: 'expo.out',
          stagger: 0.1,
        },
        0.1,
      );
    }
    if (p.lead)
      tl.fromTo(p.lead, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7 }, 0.3);
    if (cta) tl.fromTo(cta, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7 }, 0.5);
    if (tabs.length) {
      tl.fromTo(
        tabs,
        { x: 18, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.6, stagger: 0.07 },
        0.3,
      );
    }
    if (p.cards.length) {
      tl.fromTo(
        p.cards,
        { y: 34, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.75, stagger: 0.07 },
        0.45,
      );
    }
    if (blobs.length) {
      tl.from(
        blobs,
        {
          scale: 0.82,
          autoAlpha: 0,
          duration: 1.4,
          ease: 'power2.out',
          stagger: 0.14,
        },
        0,
      );
    }

    const strokes = [];
    const draw = (selector, at) => {
      const found = Array.from(root.querySelectorAll(selector));
      if (!found.length) return;
      strokes.push(...found);
      tl.fromTo(
        found,
        { strokeDasharray: 1, strokeDashoffset: 1 },
        {
          strokeDashoffset: 0,
          duration: 0.85,
          ease: 'power2.inOut',
          stagger: 0.12,
        },
        at,
      );
    };
    draw('.vx__title [data-stroke]', 0.85);
    draw('.vx__media [data-stroke]', 0.7);
    draw('.vx__railnote [data-stroke]', 1);

    entryTargets.current = [
      ...present(p.portrait, p.accent, p.by, p.meter, p.lead, eyebrow, cta),
      ...tabs,
      ...p.cards,
      ...blobs,
      ...strokes,
    ];
    return tl;
  };

  /* ------------------------------------------------------------------------
     B. The hand-off
     ------------------------------------------------------------------------ */

  /** Asks for a voice. The only way the index ever changes. */
  const request = (index, how = {}) => {
    const next = wrap(index);
    // A reader who pressed something is told what happened; a section that
    // advanced on its own does not talk over whatever they are reading.
    liveRef.current?.setAttribute('aria-live', how.user ? 'polite' : 'off');

    stopDwell();
    finishEntry(false);
    targetRef.current = next;
    dirRef.current = how.dir ?? (Math.sign(next - activeRef.current) || 1);

    if (!ready.current || reduced()) {
      commitInstant(next);
      return;
    }
    // The outgoing half commits whatever is latest when it lands.
    if (phase.current === 'out') return;
    // Finish landing now; `settleIn` leaves again for the new target.
    if (phase.current === 'in') {
      settleIn();
      return;
    }
    if (next === activeRef.current) {
      syncAutoplay();
      return;
    }
    leave();
  };

  const commitInstant = (next) => {
    const tl = transition.current;
    transition.current = null;
    if (tl) {
      tl.progress(1, true);
      tl.kill();
    }
    revert(transitionSplits);
    const root = scope.current;
    if (root) {
      const p = parts(root);
      gsap.set(
        present(p.eyebrow, p.lead, p.head, p.accent, p.by, p.meter, p.portrait, ...p.cards),
        {
          clearProps: MOVED,
        },
      );
    }
    phase.current = 'idle';
    pendingIn.current = null;

    if (next === activeRef.current) {
      syncAutoplay();
      return;
    }
    activeRef.current = next;
    setActiveTestimonialIndex(next);
  };

  const leave = () => {
    const root = scope.current;
    if (!root) return;
    const from = activeRef.current;
    const dir = dirRef.current;
    const crossing = VOICES[targetRef.current].cat !== VOICES[from].cat;
    const p = parts(root);

    phase.current = 'out';
    hidCategory.current = crossing;
    // Start fetching the incoming portrait while the outgoing one leaves.
    void warm(VOICES[targetRef.current].story.photo);

    const tl = gsap.timeline({
      defaults: { ease: 'power2.in', duration: OUT },
      onComplete: () => commit(from),
    });

    const voice = present(p.head, p.accent, p.by);
    if (voice.length) tl.to(voice, { x: -26 * dir, autoAlpha: 0, stagger: 0.04 }, 0);
    if (p.portrait) tl.to(p.portrait, { scale: 0.97, autoAlpha: 0, duration: OUT + 0.04 }, 0);
    if (p.meter) tl.to(p.meter, { autoAlpha: 0, duration: 0.24 }, 0);
    if (crossing) categoryOut(tl, p, dir);
    // The rail starts sliding as the quote leaves, so the card and the voice
    // arrive together rather than one after the other.
    else positionTrack(VOICES[targetRef.current].pos, true, dir);
    // A change with nothing to move still has to land.
    tl.to({}, { duration: 0.01 }, OUT + 0.04);

    transition.current = tl;
  };

  /* Swaps the content once the outgoing half is off screen and the incoming
     portrait is ready. If the reader asked for something else while this was
     waiting, it waits for that one instead - bounded by `warm`'s limit, so a
     slow connection costs a moment, not a stuck section. */
  const commit = (from) => {
    const decoded = (asked) =>
      warm(VOICES[asked].story.photo).then(() =>
        targetRef.current === asked ? asked : decoded(targetRef.current),
      );

    void decoded(targetRef.current).then((to) => {
      if (!alive.current || phase.current !== 'out') return;
      transition.current = null;
      const info = {
        dir: dirRef.current,
        category: hidCategory.current || VOICES[to].cat !== VOICES[from].cat,
      };
      // Back where it started: nothing for React to re-render, so bring the
      // same voice straight back in.
      if (to === from) {
        arrive(info);
        return;
      }
      pendingIn.current = info;
      activeRef.current = to;
      setActiveTestimonialIndex(to);
    });
  };

  const arrive = (info) => {
    const root = scope.current;
    if (!root) return;
    const p = parts(root);

    /* THE INCOMING STATE IS SET, NOT READ.

       React reuses most of these nodes across a change - only their text is
       new - so they are still holding what the outgoing half left on them.
       They are cleared first, and every tween below names both ends, so the
       destination is always "visible" whatever state the node arrived in. */
    const every = present(
      p.eyebrow,
      p.lead,
      p.head,
      p.accent,
      p.by,
      p.meter,
      p.portrait,
      ...p.cards,
    );
    gsap.killTweensOf(every);
    gsap.set(every, { clearProps: MOVED });
    phase.current = 'in';

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: settleIn,
    });

    if (p.portrait) {
      tl.fromTo(
        p.portrait,
        { autoAlpha: 0, scale: 1.045, clipPath: 'inset(0% 0% 12% 0%)' },
        {
          autoAlpha: 1,
          scale: 1,
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 0.58,
          ease: 'power3.inOut',
        },
        0,
      );
    }
    if (p.head) {
      const split = new SplitText(p.head, {
        type: 'lines',
        linesClass: 'vx__line',
      });
      transitionSplits.current.push(split);
      tl.fromTo(
        split.lines,
        { yPercent: 60, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 0.48, stagger: 0.05 },
        0.06,
      );
    }
    if (p.accent) {
      tl.fromTo(
        p.accent,
        { clipPath: 'inset(-45% 100% -50% -6%)' },
        {
          clipPath: 'inset(-45% -6% -50% -6%)',
          duration: 0.42,
          ease: 'power2.inOut',
        },
        0.2,
      );
    }
    if (p.by)
      tl.fromTo(p.by, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.38 }, 0.26);
    if (p.meter) tl.fromTo(p.meter, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.32 }, 0.3);
    if (info.category) categoryIn(tl, p, info.dir);

    transition.current = tl;
  };

  /* The incoming half has landed - or has been told to land now. Either way
     the section ends in its finished state with nothing left inline, and then
     either leaves again for a newer request or starts the clock. */
  const settleIn = () => {
    if (phase.current !== 'in') return;
    const tl = transition.current;
    transition.current = null;
    if (tl) {
      tl.progress(1, true);
      tl.kill();
    }
    revert(transitionSplits);
    const root = scope.current;
    if (root) {
      const p = parts(root);
      gsap.set(
        present(p.eyebrow, p.lead, p.head, p.accent, p.by, p.meter, p.portrait, ...p.cards),
        {
          clearProps: MOVED,
        },
      );
    }
    phase.current = 'idle';

    if (targetRef.current !== activeRef.current) {
      leave();
      return;
    }
    void warm(VOICES[wrap(activeRef.current + 1)].story.photo);
    syncAutoplay();
  };

  /* ------------------------------------------------------------------------
     The section's own setup. Everything it creates is inside the GSAP
     context and dies with it; the timelines created later, from presses and
     from the clock, are killed by hand in the teardown.

     The functions it calls read only refs, so capturing the first render's
     copies of them is safe.
     ------------------------------------------------------------------------ */
  const scope = useGsapScope((_, root) => {
    alive.current = true;
    ready.current = true;
    placeMarker(false);
    void warm(VOICES[activeRef.current].story.photo, 1500);
    void warm(VOICES[wrap(activeRef.current + 1)].story.photo);

    if (reduced()) entered.current = true;
    else if (!entered.current) entry.current = buildEntry(root);

    /* ---- the rail's depth: a few pixels of counter-movement per card,
       alternating down the row, so it has depth rather than sliding as one
       sheet. The rail's horizontal position belongs to the index, not to the
       scroll, so the active card is always the whole one. */
    const rail = railRef.current;
    const depth = gsap.matchMedia();
    if (rail) {
      /* The swipe rail on a phone gets the same lean at under half the
         travel: the cards are nearer the reader's thumb there, and a large
         vertical wobble under a horizontal swipe reads as the row slipping.
         Re-asked live, so turning a tablet rebuilds it at the other size. */
      depth.add(
        { wide: LOOP_RAIL, motion: '(prefers-reduced-motion: no-preference)' },
        ({ conditions }) => {
          if (!conditions.motion) return undefined;
          const amp = conditions.wide ? 1 : 0.45;
          ScrollTrigger.create({
            trigger: rail,
            start: 'top 40%',
            end: 'bottom top',
            scrub: 0.7,
            onUpdate: (self) => {
              depthCards.current.forEach((card, i) => {
                gsap.set(card, { y: (i % 2 ? 10 : 17) * amp * (1 - self.progress * 2) });
              });
            },
          });
          // Set from a callback, outside the context's record.
          return () =>
            depthCards.current.forEach((card) => card && gsap.set(card, { clearProps: 'y' }));
        },
      );
    }

    /* ---- whether the section is on screen, for the clock. */
    const presence = ScrollTrigger.create({
      trigger: root,
      start: 'top 65%',
      end: 'bottom 35%',
      onToggle: (self) => {
        inView.current = self.isActive;
        syncAutoplay();
      },
    });
    inView.current = presence.isActive;

    const onResize = () => {
      placeMarker(false);
      positionTrack(VOICES[activeRef.current].pos, false);
    };
    const onVisibility = () => {
      hold.current.hidden = document.visibilityState === 'hidden';
      syncAutoplay();
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    syncAutoplay();

    return () => {
      depth.revert();
      alive.current = false;
      ready.current = false;
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      stopDwell();
      transition.current?.kill();
      transition.current = null;
      revert(transitionSplits);
      revert(entrySplits);
      entry.current = null;
      entryTargets.current = [];
      entered.current = false;
      phase.current = 'idle';
      pendingIn.current = null;
      if (trackRef.current) gsap.killTweensOf(trackRef.current);
    };
  }, []);

  /* The incoming half, and the furniture a new index needs.

     A layout effect rather than an effect: the incoming content has to be put
     into its from-state in the same frame React painted it, or the change
     flashes the finished state before animating it in. */
  useIsomorphicLayoutEffect(() => {
    const info = pendingIn.current;
    pendingIn.current = null;
    syncFurniture(activeTestimonialIndex, Boolean(info));
    if (info && phase.current === 'out') arrive(info);
    else syncAutoplay();
    // Everything this reads besides the index is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTestimonialIndex]);

  /* Crossing the loop breakpoint changes how many cards are rendered, so the
     rail is re-placed on its new cast without a slide. */
  useIsomorphicLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;
    depthCards.current = Array.from(root.querySelectorAll('.vx__card'));
    trackGoal.current = -1;
    positionTrack(VOICES[activeRef.current].pos, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop]);

  /* ------------------------------------------------------------------------
     Input
     ------------------------------------------------------------------------ */

  /* The index is a tablist, so the arrow keys move between categories in
     whichever direction the reader tries - the strip is vertical on a desktop
     and horizontal on a phone, and nobody should have to know which one they
     are looking at to use it. */
  const onTabKey = (event) => {
    const step = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    };
    const from = VOICES[targetRef.current].cat;
    const total = VOICE_CATEGORIES.length;
    let next = null;
    if (event.key in step) next = (from + step[event.key] + total) % total;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = total - 1;
    if (next === null) return;

    event.preventDefault();
    request(FIRST_OF[next], { user: true, dir: Math.sign(next - from) || 1 });
    tabRefs.current[next]?.focus();
  };

  const nudge = (by) => request(targetRef.current + by, { user: true, dir: by });

  /* Keyboard focus inside the section holds the clock: a reader tabbing
     through the cards is reading them. A mouse press also focuses a button,
     but not visibly, and must not stop autoplay for good. */
  const onFocus = (event) => {
    if (!event.target.matches(':focus-visible')) return;
    hold.current.focus = true;
    syncAutoplay();
  };

  const onBlur = (event) => {
    const next = event.relatedTarget;
    if (next && event.currentTarget.contains(next)) return;
    hold.current.focus = false;
    syncAutoplay();
  };

  const onRailHover = (on) => (event) => {
    if (event.pointerType !== 'mouse') return;
    hold.current.hover = on;
    syncAutoplay();
  };

  /* The handwritten tail. It has to be a suffix of the quote, so the sentence
     is never held in two places at once; anything else falls back to setting
     the whole quote plainly rather than printing it twice. */
  const accent =
    current.accent && current.quote.endsWith(current.accent) ? current.accent : undefined;
  const head = accent
    ? current.quote.slice(0, current.quote.length - accent.length).trimEnd()
    : current.quote;

  return (
    <section
      ref={scope}
      className="section vx ground-paper"
      id="voices"
      aria-labelledby="vx-title"
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div className="wrap vx__inner">
        <div className="vx__grid">
          {/* ---------------------------------------------------- the intro */}
          <header className="vx__intro">
            <p className="vx__eyebrow">
              <span className="vx__eyebrow-rule" aria-hidden="true" />
              <span className="meta" data-swap="eyebrow">
                {category.eyebrow}
              </span>
            </p>

            <h2 className="vx__title ed-h1" id="vx-title">
              {VOICE_SECTION.title[0]}
              <br />
              <Script tone="blue">{VOICE_SECTION.title[1]}</Script>
            </h2>

            <p className="vx__lead" data-swap="lead">
              {category.lead}
            </p>

            <p className="vx__cta">
              <Hand kind="arrow" tone="blue" flip className="vx__cta-arrow" />
              <Link className="link vx__link" to={VOICE_SECTION.cta.to}>
                {VOICE_SECTION.cta.label}
                <Icon name="arrowRight" size={15} />
              </Link>
              <span className="meta vx__cta-note">{VOICE_SECTION.ctaNote}</span>
            </p>
          </header>

          {/* ---------------------------------------------------- the quote */}
          <div
            className="vx__quote"
            id="vx-panel"
            role="tabpanel"
            aria-labelledby={`vx-tab-${category.id}`}
            tabIndex={-1}
          >
            <span className="vx__quotemark" aria-hidden="true">
              &ldquo;
            </span>

            <blockquote className="vx__said">
              <p className="vx__head ed-h2" data-swap="head">
                {head}
              </p>
              {accent ? (
                <p className="vx__accent" data-swap="accent">
                  {accent}
                </p>
              ) : null}
            </blockquote>

            <figure className="vx__by" data-swap="by">
              <Figure
                photo={current.photo}
                width={FACE.width}
                widths={FACE.widths}
                sizes={FACE.sizes}
                shape="round"
                ratio="square-ar"
                className="vx__face"
                decorative
              />
              <figcaption className="vx__who">
                <b className="vx__name">{current.name}</b>
                <span className="meta">{current.role}</span>
              </figcaption>
            </figure>

            <p className="vx__meter" data-swap="meter">
              <span className="vx__meter-count" aria-hidden="true">
                <b>{String(active.pos + 1).padStart(2, '0')}</b>
                <i>/</i>
                <span>{String(stories.length).padStart(2, '0')}</span>
              </span>
              <span className="vx__meter-track" aria-hidden="true">
                <span className="vx__meter-fill" />
              </span>
            </p>

            {/* Polite for a press, silent for autoplay - see `request`. */}
            <span ref={liveRef} className="sr-only" aria-live="off">
              {`${category.label}, story ${active.pos + 1} of ${stories.length}. ${current.name}, ${current.role}.`}
            </span>
          </div>

          {/* -------------------------------------------------- the portrait */}
          <div className="vx__media">
            <span className="vx__blob vx__blob--a" aria-hidden="true" />
            <span className="vx__blob vx__blob--b" aria-hidden="true" />
            <Hand kind="loop" tone="blue" className="vx__loop" />

            <div className="vx__portrait" data-swap="portrait">
              <Figure
                key={current.id}
                photo={current.photo}
                width={PORTRAIT.width}
                widths={PORTRAIT.widths}
                sizes={PORTRAIT.sizes}
                shape="frame"
                ratio="portrait"
                className="vx__shot"
              />
            </div>

            <div className="vx__arrows">
              <button
                type="button"
                className="vx__arrow"
                onClick={() => nudge(-1)}
                aria-label="Previous story"
                aria-controls="vx-panel"
              >
                <Icon name="arrowLeft" size={17} />
              </button>
              <button
                type="button"
                className="vx__arrow vx__arrow--solid"
                onClick={() => nudge(1)}
                aria-label="Next story"
                aria-controls="vx-panel"
              >
                <Icon name="arrowRight" size={17} />
              </button>
            </div>
          </div>

          {/* ---------------------------------------------------- the index */}
          <div
            ref={navRef}
            className="vx__cats"
            role="tablist"
            aria-label="Whose stories to show"
            onKeyDown={onTabKey}
          >
            <span className="vx__marker" aria-hidden="true" />
            {VOICE_CATEGORIES.map((item, i) => {
              const on = i === active.cat;
              return (
                <button
                  key={item.id}
                  ref={(node) => {
                    tabRefs.current[i] = node;
                  }}
                  id={`vx-tab-${item.id}`}
                  type="button"
                  role="tab"
                  className={`vx__tab${on ? ' is-on' : ''}`}
                  aria-selected={on}
                  aria-controls="vx-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() =>
                    request(FIRST_OF[i], {
                      user: true,
                      dir: Math.sign(i - active.cat) || 1,
                    })
                  }
                >
                  <span className="vx__tab-index">{item.index}</span>
                  <span className="vx__tab-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ------------------------------------------------------- the rail */}
        <div
          ref={railRef}
          className="vx__rail"
          onPointerEnter={onRailHover(true)}
          onPointerLeave={onRailHover(false)}
          onPointerDown={restartClock}
          onWheel={restartClock}
          onTouchStart={restartClock}
        >
          <ul className="vx__track" ref={trackRef}>
            {Array.from({ length: copies }, (_, copy) =>
              stories.map((story, i) => {
                const on = i === active.pos;
                /* Copies after the first exist only to keep the loop full. They
                 are still pressable with a pointer, but hidden from assistive
                 technology and from the tab order, which get the cast once. */
                const echo = copy > 0;
                const slot = copy * stories.length + i;
                return (
                  <li
                    key={`${category.id}-${story.id}-${copy}`}
                    className="vx__card"
                    aria-hidden={echo || undefined}
                  >
                    <button
                      type="button"
                      className={`vx__card-btn${on ? ' is-on' : ''}`}
                      aria-pressed={echo ? undefined : on}
                      aria-controls={echo ? undefined : 'vx-panel'}
                      tabIndex={echo ? -1 : undefined}
                      // A card to the right of the active one slides the rail
                      // right to left; one to its left, the other way.
                      onClick={() =>
                        request(FIRST_OF[active.cat] + i, {
                          user: true,
                          dir: slot >= active.pos ? 1 : -1,
                        })
                      }
                    >
                      <span className="vx__card-mark" aria-hidden="true">
                        &rdquo;
                      </span>
                      <Figure
                        photo={story.photo}
                        width={200}
                        widths={[140, 200, 400]}
                        sizes="84px"
                        shape="round"
                        ratio="square-ar"
                        className="vx__card-face"
                        decorative
                      />
                      <span className="vx__card-body">
                        <span className="vx__card-quote">&ldquo;{story.quote}&rdquo;</span>
                        <span className="vx__card-who">
                          <b>{story.name}</b>
                          <span className="meta">{story.role}</span>
                        </span>
                      </span>
                      {/* How long until the next voice. Drawn by the autoplay
                        clock itself, so it cannot disagree with it. */}
                      <span className="vx__card-dwell" aria-hidden="true" />
                    </button>
                  </li>
                );
              }),
            )}
          </ul>
        </div>

        <p className="vx__railnote" aria-hidden="true">
          <span className="vx__railnote-ink">{VOICE_SECTION.railNote}</span>
          <Hand kind="arrow" tone="blue" className="vx__railnote-arrow" />
        </p>
      </div>
    </section>
  );
}
