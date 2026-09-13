import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { VOICE_CATEGORIES, VOICE_SECTION } from '@/constants/voices';
import type { VoiceStory } from '@/types';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { ScrollTrigger, SplitText, gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Figure, Hand, Script } from '@/components/editorial';
import { VoiceFilm } from './VoiceFilm';
import './voices.css';

/* ==========================================================================
   07 - COMMUNITY STORIES
   --------------------------------------------------------------------------
   The one section on this site set in blue on a near-white sheet rather than
   in the school yellow on ivory. That is deliberate and it happens exactly
   once: the page turns over from the near-black journey above it into the
   brightest thing on the homepage, and the change of ink is what tells a
   reader they have arrived somewhere different rather than at another band of
   the same document.

   THE COMPOSITION

   Four columns that are not four equal columns:

     INTRO    the eyebrow, the headline with one handwritten line, the
              category's own introduction, and the way out to the films.
     QUOTE    one testimonial at display scale, its closing phrase written by
              hand, the person under it, and the position in the set.
     PORTRAIT the face, tilted a degree and a half, with the play button on
              its shoulder and a blue line thrown round it.
     INDEX    Students / Teachers / Alumni / Parents, as a numbered contents
              page rather than as a row of pills.

   Then, underneath, every voice in the category as a rail of cards that
   travels sideways as the reader scrolls past it.

   WHY THE CARDS ARE NOT A SECOND SET OF QUOTES

   On the reference board the three cards at the foot are a different set of
   testimonials from the one above them, which means the section shows four
   quotes and offers no way to read three of them properly. Here the rail is
   the category's whole cast, the card for the quote currently open is the
   active one, and pressing any card opens it above. So the rail is a table of
   contents for the thing it sits under rather than a smaller second
   testimonial section, and the section has one subject at a time.

   WHY IT DOES NOT PIN

   The brief asked for a pinned horizontal rail. This page already pins three
   times - the campus deck, the journey, the photo wall - and two of those are
   the sections immediately before and after this one. A fourth pin here would
   make three consecutive sections that each take the scroll away, which is
   the point at which a long page stops reading as a document and starts
   reading as a series of tolls. So the rail is scrubbed rather than pinned:
   it travels sideways as the reader passes it, at their speed, and they can
   leave whenever they like.

   THE MOTION, IN THREE PARTS

   1. THE ARRIVAL (once). Eyebrow, then the headline line by line, then the
      blue swash drawn under the handwritten line, then the quote, the
      portrait printing from a clip, the index, and the cards.

   2. THE SWAP (on every category or story change). Out, then in - a real
      hand-off rather than a cross-fade, so the direction of travel says
      whether the reader went forward or back. About 620ms end to end.

   3. THE RAIL (scrubbed). Horizontal travel on the track, and a few pixels of
      counter-movement per card so the row has depth rather than sliding as
      one sheet.

   With reduced motion none of the three is built. The section is simply
   already in its finished state and the swap is instantaneous, which is what
   it should be - a 1ms version of a hand-off is still a hand-off.
   ========================================================================== */

/** The category / story pair the section is currently showing. */
interface View {
  cat: number;
  story: number;
}

/** What the entrance timeline needs to know about the swap that caused it. */
interface Swap {
  /** 1 forward, -1 back. Decides which side the new content arrives from. */
  dir: number;
  /** A category change moves more of the section than a story change does. */
  category: boolean;
}

/* The outgoing half, in seconds. The incoming half runs about 0.7, so a swap
   is a little under a second door to door - long enough to read as a
   deliberate hand-off, short enough that a reader pressing through four
   categories is never waiting for the section to catch up. */
const OUT = 0.24;

/* The pieces a swap moves. Queried rather than held in refs because most of
   them are replaced by React on every swap, and a ref to a node that has been
   unmounted is a tween writing to nothing.

   `cards` is the button inside each card rather than the card itself: the
   card carries the rail's scrubbed parallax, and two timelines writing `y` to
   one element is a fight neither of them wins. */
const parts = (el: HTMLElement) => ({
  lead: el.querySelector<HTMLElement>('[data-swap="lead"]'),
  head: el.querySelector<HTMLElement>('[data-swap="head"]'),
  accent: el.querySelector<HTMLElement>('[data-swap="accent"]'),
  by: el.querySelector<HTMLElement>('[data-swap="by"]'),
  portrait: el.querySelector<HTMLElement>('[data-swap="portrait"]'),
  meter: el.querySelector<HTMLElement>('[data-swap="meter"]'),
  cards: el.querySelectorAll<HTMLElement>('.vx__card-btn'),
});

export function HomeVoices() {
  const [view, setView] = useState<View>({ cat: 0, story: 0 });
  /** The story whose film is open. `null` is the whole closed state. */
  const [film, setFilm] = useState<VoiceStory | null>(null);

  const navRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  /** Where focus returns to when the film closes, and whether it has to. */
  const playRef = useRef<HTMLButtonElement>(null);
  const wasPlaying = useRef(false);

  /** The cards currently in the rail, for the scrubbed depth. Refreshed on
   *  every category change, because the cast behind them changes with it. */
  const cardsRef = useRef<HTMLElement[]>([]);
  const railRef = useRef<ScrollTrigger | null>(null);

  /** Every SplitText currently holding a piece of this section open.
   *
   *  A split replaces the element's own text node with a stack of <div>s, and
   *  React does not know that: if the quote is re-rendered while a split is
   *  live, React writes the new sentence into a text node that is no longer
   *  in the document and the reader keeps looking at the old one. So every
   *  split is tracked, and reverted before anything is allowed to re-render -
   *  which is also what puts the quote back to being real text for a screen
   *  reader and for find-in-page. */
  const splits = useRef<SplitText[]>([]);

  /** Non-null only between the two halves of a swap. */
  const swap = useRef<Swap | null>(null);
  const busy = useRef(false);
  /** The press that arrived while a swap was still running. A reader stepping
   *  quickly through the four categories should end on the one they last
   *  pressed, not on whichever one happened to be mid-flight. */
  const queued = useRef<View | null>(null);
  const goRef = useRef<((cat: number, story: number) => void) | null>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const mounted = useRef(false);

  const category = VOICE_CATEGORIES[view.cat];
  const stories = category.stories;
  const current = stories[Math.min(view.story, stories.length - 1)];

  const unsplit = useCallback(() => {
    splits.current.forEach((split) => split.revert());
    splits.current = [];
  }, []);

  /* ------------------------------------------------------------------------
     Entrance, and the second half of every swap.

     `full` is the once-per-page arrival, which also brings in the furniture
     that never changes afterwards - the eyebrow, the headline, the index and
     the decoration.
     ------------------------------------------------------------------------ */
  const enter = useCallback((el: HTMLElement, info: Swap, full: boolean) => {
    // Anything left split by an interrupted timeline goes back to being text
    // before this one measures a line box against it.
    unsplit();

    const p = parts(el);
    const dir = info.dir;

    /* EVERY TWEEN BELOW IS A `from`, AND A `from` READS THE ELEMENT'S CURRENT
       STATE AS ITS DESTINATION.

       React reuses these nodes across a swap - only their text changes - so
       what they are currently holding is whatever the outgoing half left on
       them, which is `opacity: 0`. Without this line the incoming content
       animates from hidden to hidden and the section arrives blank, which is
       exactly what it did. The inline state has to be cleared before the
       destination is read, not after. */
    gsap.set(
      [p.lead, p.head, p.accent, p.by, p.meter, p.portrait, ...Array.from(p.cards)].filter(Boolean),
      { clearProps: 'all' },
    );

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    if (p.portrait) {
      tl.fromTo(
        p.portrait,
        { autoAlpha: 0, scale: 1.045, clipPath: 'inset(0% 0% 12% 0%)' },
        {
          autoAlpha: 1,
          scale: 1,
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: full ? 0.85 : 0.58,
          ease: 'power3.inOut',
        },
        0,
      );
    }

    /* The quote arrives line by line. Split without a mask and reverted the
       moment it lands: the handwritten line underneath hangs below its own
       baseline, and a line mask would clip its tail. Reverting also puts the
       quote back to being real text - a sentence left as a stack of <div>s is
       a sentence a screen reader reads as a stack of fragments. */
    if (p.head) {
      const split = new SplitText(p.head, { type: 'lines', linesClass: 'vx__line' });
      splits.current.push(split);
      tl.from(
        split.lines,
        {
          yPercent: 60,
          autoAlpha: 0,
          duration: full ? 0.72 : 0.48,
          stagger: full ? 0.075 : 0.05,
          onComplete: unsplit,
        },
        0.06,
      );
    }

    /* The handwriting is written on left to right rather than faded up, which
       is the gesture the invitation spreads use for their annotations. */
    if (p.accent) {
      tl.fromTo(
        p.accent,
        { clipPath: 'inset(-45% 100% -50% -6%)' },
        { clipPath: 'inset(-45% -6% -50% -6%)', duration: full ? 0.62 : 0.42, ease: 'power2.inOut' },
        full ? 0.32 : 0.2,
      );
    }

    if (p.by) tl.from(p.by, { y: 18, autoAlpha: 0, duration: full ? 0.6 : 0.38 }, full ? 0.42 : 0.26);
    if (p.meter) tl.from(p.meter, { autoAlpha: 0, duration: full ? 0.5 : 0.32 }, full ? 0.5 : 0.3);
    if (info.category && p.lead) {
      tl.from(p.lead, { x: 24 * dir, autoAlpha: 0, duration: 0.44 }, 0.04);
    }

    // The cards only re-enter when the cast behind them has actually changed.
    if ((info.category || full) && p.cards.length) {
      tl.from(
        p.cards,
        { y: 34, autoAlpha: 0, duration: full ? 0.8 : 0.46, stagger: full ? 0.08 : 0.05 },
        full ? 0.55 : 0.1,
      );
    }

    if (!full) return tl;

    const eyebrow = el.querySelector<HTMLElement>('.vx__eyebrow');
    const title = el.querySelector<HTMLElement>('.vx__title');
    const cta = el.querySelector<HTMLElement>('.vx__cta');
    const tabs = el.querySelectorAll<HTMLElement>('.vx__tab');

    if (eyebrow) tl.from(eyebrow, { y: 14, autoAlpha: 0, duration: 0.6 }, 0);
    if (title) {
      const split = new SplitText(title, { type: 'lines', linesClass: 'vx__line' });
      splits.current.push(split);
      tl.from(
        split.lines,
        {
          yPercent: 55,
          autoAlpha: 0,
          duration: 1.05,
          ease: 'expo.out',
          stagger: 0.1,
          onComplete: unsplit,
        },
        0.1,
      );
      drawStrokes(tl, title.querySelectorAll('[data-stroke]'), 0.85);
    }
    if (cta) tl.from(cta, { y: 16, autoAlpha: 0, duration: 0.7 }, 0.62);
    if (tabs.length) tl.from(tabs, { x: 18, autoAlpha: 0, duration: 0.6, stagger: 0.07 }, 0.4);

    // The decoration drifts in behind everything rather than with it.
    tl.from(
      el.querySelectorAll<HTMLElement>('.vx__blob'),
      { scale: 0.82, autoAlpha: 0, duration: 1.5, ease: 'power2.out', stagger: 0.14 },
      0,
    );
    drawStrokes(tl, el.querySelectorAll('.vx__media [data-stroke]'), 0.7);
    drawStrokes(tl, el.querySelectorAll('.vx__railnote [data-stroke]'), 1);

    return tl;
  }, [unsplit]);

  /* ------------------------------------------------------------------------
     The section's own setup: the index marker, the rail, and the arrival.
     ------------------------------------------------------------------------ */
  const scope = useGsapScope<HTMLElement>((_, el) => {
    /* ---- the block behind the active category.
       Measured off the button rather than computed from an index, so the same
       few lines serve the vertical index on a desktop and the horizontal
       strip on a phone. */
    const marker = el.querySelector<HTMLElement>('.vx__marker');
    const place = () => {
      const nav = navRef.current;
      const active = nav?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!nav || !marker || !active) return;
      const box = nav.getBoundingClientRect();
      const hit = active.getBoundingClientRect();
      gsap.set(marker, {
        x: hit.left - box.left + nav.scrollLeft,
        y: hit.top - box.top,
        width: hit.width,
        height: hit.height,
        autoAlpha: 1,
      });
    };

    place();
    const onResize = () => place();
    window.addEventListener('resize', onResize);

    /* ---- the rail.
       The travel is read on every frame rather than captured once, so a
       category with a different number of voices needs no re-measure. */
    const track = trackRef.current;
    const rail = el.querySelector<HTMLElement>('.vx__rail');

    if (track && rail && !reduced() && !window.matchMedia('(max-width: 899px)').matches) {
      const span = () => Math.max(0, track.scrollWidth - rail.clientWidth);

      railRef.current = ScrollTrigger.create({
        trigger: rail,
        /* The rail rests at nought while it is being read and travels as the
           reader leaves it. Starting the scrub at the point the rail enters
           the viewport would mean it had already moved a third of its span by
           the time anybody looked at it, with the open story's own card half
           off the left edge - which is the one card that has to be whole. */
        start: 'top 40%',
        end: 'bottom top',
        scrub: 0.7,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress;
          gsap.set(track, { x: -span() * p });
          /* A few pixels of counter-movement per card, alternating down the
             row, so the rail has depth instead of sliding as one sheet. Small
             enough to be felt before it is seen, which is the test for every
             parallax on this site. */
          cardsRef.current.forEach((card, i) => {
            gsap.set(card, { y: (i % 2 ? 10 : 17) * (1 - p * 2) });
          });
        },
      });
    }

    /* ---- the arrival, on its own one-shot trigger so the section animates
       when it is reached rather than when the page loads. */
    if (!reduced()) {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 72%',
        once: true,
        onEnter: () => {
          timeline.current = enter(el, { dir: 1, category: true }, true);
        },
      });
    }

    return () => {
      window.removeEventListener('resize', onResize);
      railRef.current?.kill();
      railRef.current = null;
      timeline.current?.kill();
      unsplit();
    };
  }, []);

  /* ------------------------------------------------------------------------
     The swap. Out on the press, in once React has replaced the content - so
     the two halves genuinely hand over rather than cross-fading, and the
     direction of travel tells the reader which way they moved.
     ------------------------------------------------------------------------ */
  const go = useCallback(
    (cat: number, story: number) => {
      if (cat === view.cat && story === view.story) return;
      const next = { cat, story };
      const changed = cat !== view.cat;
      const dir = changed ? Math.sign(cat - view.cat) || 1 : Math.sign(story - view.story) || 1;

      const el = scope.current;
      if (!el || reduced()) {
        setView(next);
        return;
      }
      // One swap at a time. A second press mid-transition would leave the
      // outgoing half animating against content that had already been
      // replaced underneath it - so it is remembered and run on the way out.
      if (busy.current) {
        queued.current = next;
        return;
      }

      busy.current = true;
      swap.current = { dir, category: changed };
      // Killing the arrival mid-flight would otherwise strand its split, and
      // the outgoing half has to animate the real paragraph rather than the
      // stack of line boxes standing in for it.
      timeline.current?.kill();
      unsplit();

      const p = parts(el);
      const out = gsap.timeline({
        defaults: { ease: 'power2.in', duration: OUT },
        onComplete: () => setView(next),
      });

      const leaving = [p.head, p.accent, p.by].filter(Boolean) as HTMLElement[];
      if (leaving.length) out.to(leaving, { x: -26 * dir, autoAlpha: 0, stagger: 0.04 }, 0);
      if (p.portrait) out.to(p.portrait, { scale: 0.97, autoAlpha: 0, duration: OUT + 0.04 }, 0);
      if (p.meter) out.to(p.meter, { autoAlpha: 0, duration: 0.24 }, 0);
      if (changed) {
        if (p.lead) out.to(p.lead, { x: -18 * dir, autoAlpha: 0 }, 0);
        if (p.cards.length) {
          out.to(p.cards, { y: 18, autoAlpha: 0, duration: 0.28, stagger: 0.03 }, 0);
        }
      }
      // A swap with nothing to move still has to land, or `busy` never clears.
      out.to({}, { duration: 0.01 }, OUT + 0.04);

      timeline.current = out;
    },
    [enter, scope, unsplit, view.cat, view.story],
  );

  useIsomorphicLayoutEffect(() => {
    goRef.current = go;
  }, [go]);

  /* The second half of the swap, and the housekeeping a new cast needs.

     A layout effect rather than an effect: the incoming content has to be put
     into its from-state in the same frame React painted it, or the swap
     flashes the finished state before animating it in. */
  useIsomorphicLayoutEffect(() => {
    const el = scope.current;
    if (!el) return;

    cardsRef.current = Array.from(el.querySelectorAll<HTMLElement>('.vx__card'));
    // A different number of cards is a different travel distance.
    railRef.current?.refresh();

    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    const info = swap.current;
    swap.current = null;
    if (!info) return;

    const tl = enter(el, info, false);
    tl.eventCallback('onComplete', () => {
      busy.current = false;
      const next = queued.current;
      queued.current = null;
      if (next) goRef.current?.(next.cat, next.story);
    });
    timeline.current = tl;

    if (!info.category) return;

    // The marker only has to move when the category did.
    const marker = el.querySelector<HTMLElement>('.vx__marker');
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!marker || !nav || !active) return;

    const box = nav.getBoundingClientRect();
    const hit = active.getBoundingClientRect();
    gsap.to(marker, {
      x: hit.left - box.left + nav.scrollLeft,
      y: hit.top - box.top,
      width: hit.width,
      height: hit.height,
      duration: 0.55,
      ease: 'power3.out',
    });

    // On a phone the index is a scrolling strip. Scroll the strip, never the
    // page - Lenis owns the page, and a native scroll into view fights it.
    if (nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({
        left: active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2,
        behavior: reduced() ? 'auto' : 'smooth',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  /* Focus comes back to the play button once the film has gone, not while it
     is closing: a <dialog> holds focus inside itself until it is out of the
     document, so focusing from the close handler is a call the browser
     quietly drops and the reader lands back on <body>. */
  useIsomorphicLayoutEffect(() => {
    if (film) {
      wasPlaying.current = true;
      return;
    }
    if (!wasPlaying.current) return;
    wasPlaying.current = false;
    playRef.current?.focus();
  }, [film]);

  /* The progress line under the quote. Driven here rather than by a class so
     it moves with the swap instead of ahead of it. */
  useIsomorphicLayoutEffect(() => {
    const fill = scope.current?.querySelector<HTMLElement>('.vx__meter-fill');
    if (!fill) return;
    const to = (view.story + 1) / stories.length;
    if (reduced()) gsap.set(fill, { scaleX: to });
    else gsap.to(fill, { scaleX: to, duration: 0.6, ease: 'power3.out' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, stories.length]);

  /* ------------------------------------------------------------------------
     Keyboard. The index is a tablist, so the arrow keys move between
     categories in whichever direction the reader tries - the strip is
     vertical on a desktop and horizontal on a phone, and nobody should have
     to know which one they are looking at to use it.
     ------------------------------------------------------------------------ */
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    };
    let next: number | null = null;
    if (event.key in step) {
      next = (view.cat + step[event.key] + VOICE_CATEGORIES.length) % VOICE_CATEGORIES.length;
    } else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = VOICE_CATEGORIES.length - 1;
    if (next === null) return;

    event.preventDefault();
    go(next, 0);
    tabRefs.current[next]?.focus();
  };

  const nudge = (by: number) => {
    const total = stories.length;
    go(view.cat, (((view.story + by) % total) + total) % total);
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
    <section ref={scope} className="section vx" id="voices" aria-labelledby="vx-title">
      <div className="wrap vx__inner">
        <div className="vx__grid">
          {/* ---------------------------------------------------- the intro */}
          <header className="vx__intro">
            <p className="vx__eyebrow">
              <span className="vx__eyebrow-rule" aria-hidden="true" />
              <span className="meta">{category.eyebrow}</span>
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
                width={160}
                widths={[120, 160, 320]}
                sizes="66px"
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
                <b>{String(view.story + 1).padStart(2, '0')}</b>
                <i>/</i>
                <span>{String(stories.length).padStart(2, '0')}</span>
              </span>
              <span className="vx__meter-track" aria-hidden="true">
                <span className="vx__meter-fill" />
              </span>
            </p>

            {/* Announced politely, so a reader who presses Next is told what
                happened without the page shouting over what it was reading. */}
            <span className="sr-only" aria-live="polite">
              {`${category.label}, story ${view.story + 1} of ${stories.length}. ${current.name}, ${current.role}.`}
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
                width={720}
                widths={[420, 720, 1080]}
                sizes="(max-width: 699px) 74vw, (max-width: 1179px) 40vw, 27vw"
                shape="frame"
                ratio="portrait"
                className="vx__shot"
              />
            </div>

            {current.film ? (
              <>
                <button
                  ref={playRef}
                  type="button"
                  className="vx__play"
                  onClick={() => setFilm(current)}
                  data-cursor="Play"
                >
                  <span className="vx__play-ring" aria-hidden="true">
                    <Icon name="play" size={17} />
                  </span>
                  <span className="sr-only">
                    {`Play ${current.name}, ${current.role}, ${current.film.runtime}`}
                  </span>
                </button>

                <p className="vx__filmnote" aria-hidden="true">
                  <span className="vx__filmnote-ink">{VOICE_SECTION.filmNote}</span>
                  <Hand kind="arrow" tone="blue" className="vx__filmnote-arrow" />
                </p>

                <Hand kind="sparks" tone="blue" className="vx__sparks" />
              </>
            ) : null}

            <div className="vx__arrows">
              <button
                type="button"
                className="vx__arrow"
                onClick={() => nudge(-1)}
                aria-label={`Previous story from ${category.label.toLowerCase()}`}
                aria-controls="vx-panel"
              >
                <Icon name="arrowLeft" size={17} />
              </button>
              <button
                type="button"
                className="vx__arrow vx__arrow--solid"
                onClick={() => nudge(1)}
                aria-label={`Next story from ${category.label.toLowerCase()}`}
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
              const on = i === view.cat;
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
                  onClick={() => go(i, 0)}
                >
                  <span className="vx__tab-index">{item.index}</span>
                  <span className="vx__tab-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ------------------------------------------------------- the rail */}
        <div className="vx__rail">
          <ul className="vx__track" ref={trackRef}>
            {stories.map((story, i) => (
              <li key={`${category.id}-${story.id}`} className="vx__card">
                <button
                  type="button"
                  className={`vx__card-btn${i === view.story ? ' is-on' : ''}`}
                  aria-pressed={i === view.story}
                  aria-controls="vx-panel"
                  onClick={() => go(view.cat, i)}
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
                </button>
              </li>
            ))}
          </ul>
        </div>

        <p className="vx__railnote" aria-hidden="true">
          <span className="vx__railnote-ink">{VOICE_SECTION.railNote}</span>
          <Hand kind="arrow" tone="blue" className="vx__railnote-arrow" />
        </p>
      </div>

      {film?.film ? (
        <VoiceFilm
          name={film.name}
          role={film.role}
          poster={film.photo}
          film={film.film}
          onClose={() => setFilm(null)}
        />
      ) : null}
    </section>
  );
}

/** Runs a set of `pathLength="1"` strokes from undrawn to drawn - the same
 *  helper the invitation spreads use, because it is the same gesture. */
function drawStrokes(tl: gsap.core.Timeline, strokes: NodeListOf<Element>, at: number) {
  if (!strokes.length) return;
  tl.fromTo(
    strokes,
    { strokeDasharray: 1, strokeDashoffset: 1 },
    { strokeDashoffset: 0, duration: 0.85, ease: 'power2.inOut', stagger: 0.12 },
    at,
  );
}
