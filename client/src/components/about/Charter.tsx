import { useCallback, useRef, useState } from 'react';
import { VALUES } from '@/constants';
import { academicImages, resolve, resolveSet, sportsImages, studentImages } from '@/constants/imagery';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { lines, rise } from '@/lib/motion';
import { Sticker } from '@/components/editorial';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import { cx } from '@/utils';
import './charter.css';

/* ==========================================================================
   05 - THE CHARTER
   --------------------------------------------------------------------------
   Six things the school says it will not trade, discovered one at a time.

   WHAT THIS IS, AND WHAT IT IS DELIBERATELY NOT

   It is not an accordion. Nothing here waits to be clicked, and the six
   cards are not six equal boxes a reader picks from - they are an argument
   in an order, and the reader travels through it. On a wide screen the
   section holds the viewport while their own scroll walks down the column:
   one principle open at a time, its photograph on the left, the next one
   arriving as the last one closes. The heads are still buttons, because a
   keyboard has to be able to reach the sixth principle without six screens
   of scrolling - but a press moves the PAGE, not the card, so the pointer
   and the wheel drive the same timeline and can never disagree.

   THE THREE BUILDS

     pinned   >= 1024px, tall enough to hold it, motion allowed. The
              composition described above.
     flowing  narrow, or too short to pin, motion allowed. No pin - a phone's
              scroll belongs to the person holding it. Six full-width cards,
              each with its own photograph, each arriving as it is reached,
              and the lime state still follows whichever one holds the middle
              of the screen.
     neither  reduced motion, or before a line of JavaScript has run. The
              finished layout: six open cards, every word showing. Not a
              faster version of the run - a 1ms scrub still scrubs, and a pin
              still captures the scroll.

   The stylesheet is written so that the third of those is the resting state
   and the other two are added on top. A build that fails leaves a readable
   charter, which is the only acceptable failure for a section whose job is
   to say what the school stands for.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Content
   --------------------------------------------------------------------------
   The words are VALUES, unchanged - the charter is a record and this section
   does not get to rewrite it. Only the photography is chosen here, paired to
   the principle rather than mapped by index, because the second one down is
   about a standard being taught and the fifth is about a mark being written
   honestly, and those are not interchangeable pictures.
   -------------------------------------------------------------------------- */

const PHOTOS: Photo[] = [
  studentImages[1], // 01 known         - a child working with a teacher
  academicImages[0], // 02 rigour        - a problem worked through with seniors
  academicImages[2], // 03 curiosity     - a robot being assembled
  sportsImages[3], // 04 character       - a team, after the fixture
  academicImages[3], // 05 honesty       - the working, on the page
  studentImages[5], // 06 belonging      - Class 10, on the way out
];

const COUNT = VALUES.length;

/** Screen-heights of scroll each principle is given. */
const STEP = 0.8;
/** Extra hold after the sixth, so the last one is read rather than glimpsed. */
const TAIL = 0.5;
/** The run, in stage units. Progress × this is "which principle, and how far". */
const SPAN = COUNT + TAIL;
/** Floor per stage, so a short laptop does not turn the run into a flicker. */
const STEP_MIN = 520;

/* The card transition. One number and one curve, used by both halves of every
   swap - see the stylesheet on why they have to be identical. `inOut` rather
   than `out`: a card closing wants to start slowly, which `out` never does. */
const SWAP = 0.62;
const SWAP_EASE = 'power2.inOut';

/* 760px is measured, not chosen. The held composition - head, six heads, one
   open panel - is 685px at 1366 and a little more as the column narrows and
   the panel copy wraps further; the tightening in the stylesheet below 940px
   is what gets it there. 760 leaves the slack that keeps it honest at 1024,
   and the runtime check in `buildPinned` catches whatever measurement cannot
   be expressed as a media query. */
const PINNED =
  '(min-width: 1024px) and (min-height: 760px) and (prefers-reduced-motion: no-preference)';
/* Comma, not `or`. Two conditions joined the way media queries have always
   joined them, so this does not depend on Level 4 support in `matchMedia`. */
const FLOWING =
  '(max-width: 1023px) and (prefers-reduced-motion: no-preference), (max-height: 759px) and (prefers-reduced-motion: no-preference)';
/** Only the width matters to the markup: the plate needs a column to stand in. */
const NARROW = '(max-width: 1023px)';

/* ==========================================================================
   Motion
   --------------------------------------------------------------------------
   Kept out of the component body so the markup below reads as markup. Both
   builds are created inside a `gsap.matchMedia` owned by the section's
   `gsap.context`, so every trigger dies with the component and a resize
   across a breakpoint swaps one build for the other cleanly.
   ========================================================================== */

interface Wiring {
  /** The pinned run, so a head press can convert a stage into a scroll. */
  trigger: ScrollTrigger | null;
  /** Which principle is current. */
  onStep: (index: number) => void;
  /** Whether anything is driving the section at all - see `live` below. */
  onLive: (live: boolean) => void;
}

/* --------------------------------------------------------------------------
   The plate
   --------------------------------------------------------------------------
   Six photographs in one box and six numerals in one corner, of which one of
   each is visible. Shared by both builds, because the photograph should
   answer the principle whether the section is holding the viewport or simply
   being scrolled past - a plate frozen on the first frame while the reader
   is reading the fifth is worse than no plate at all.

   Returns null when there is no plate in the DOM, which is the narrow
   layout: there the cards carry their own frames.
   -------------------------------------------------------------------------- */
function buildPlate(root: HTMLElement) {
  const shots = gsap.utils.toArray<HTMLElement>('.charter__shot', root);
  const numerals = gsap.utils.toArray<HTMLElement>('.charter__numeral', root);
  if (shots.length !== COUNT) return null;

  /** `settle` is the crossfade's own arrival; the first paint has neither. */
  const show = (index: number, immediate: boolean, settle: boolean) => {
    shots.forEach((shot, i) => {
      gsap.to(shot, {
        opacity: i === index ? 1 : 0,
        duration: immediate ? 0 : 0.85,
        ease: 'power2.inOut',
        overwrite: 'auto',
      });
    });

    /* The incoming frame settles the last four per cent of a scale. It is
       what stops six photographs in the same box reading as a slideshow -
       and `.charter__shot` owns scale and opacity and nothing else, so it can
       never collide with the deck's slow travel or the parallax inside the
       picture. */
    if (settle) {
      gsap.fromTo(
        shots[index],
        { scale: 1.045 },
        { scale: 1, duration: 1.5, ease: 'power3.out', overwrite: 'auto' },
      );
    }

    /* The numeral turns over: the one leaving goes the way the reader came
       from, the one arriving comes from the way they are going. Both
       directions are read off the step, so scrolling back up reverses it
       rather than replaying it. */
    numerals.forEach((numeral, i) => {
      const on = i === index;
      gsap.to(numeral, {
        opacity: on ? 1 : 0,
        yPercent: on ? 0 : i < index ? -30 : 30,
        duration: immediate ? 0 : 0.5,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    });
  };

  const clear = () => gsap.set([...shots, ...numerals], { clearProps: 'all' });

  return { show, clear };
}

/* --------------------------------------------------------------------------
   The pinned run
   -------------------------------------------------------------------------- */
function buildPinned(root: HTMLElement, wiring: Wiring) {
  const pin = root.querySelector<HTMLElement>('.charter__pin');
  const list = root.querySelector<HTMLElement>('.charter__list');
  const runner = root.querySelector<HTMLElement>('.charter__runner');
  const panels = gsap.utils.toArray<HTMLElement>('.ch-card__panel', root);
  const inners = gsap.utils.toArray<HTMLElement>('.ch-card__inner', root);
  const fills = gsap.utils.toArray<HTMLElement>('.ch-card__fill', root);
  const plate = buildPlate(root);

  if (!pin || !list || !plate || panels.length !== COUNT) return;

  /* The class is what turns the stacked cards into the held composition. It
     is added here rather than in the stylesheet so the collapsed layout can
     only ever exist once the thing that opens it does. */
  root.classList.add('charter--pinned');
  wiring.onLive(true);

  let painted = -1;

  /* ------------------------------------------------------------------------
     Measurement
     ------------------------------------------------------------------------
     Two numbers, and the whole stillness of the column rests on them.

     `panelH` is the tallest of the six panels, and every panel opens to it -
     so a short principle and a long one leave the column exactly as tall.
     `.ch-card__inner` keeps its natural height whatever its panel is doing,
     which is what makes all six measurable while five of them are shut.

     The list is then given that steady-state height outright. It costs
     nothing (it is the height the column already has) and it means a burst
     of fast scrolling, where two panels are briefly mid-move, cannot ripple
     into the photograph beside them.
     ------------------------------------------------------------------------ */
  let panelH = 0;

  const measure = () => {
    panelH = Math.max(...inners.map((inner) => inner.offsetHeight));

    list.style.height = '';
    panels.forEach((panel) => {
      panel.style.height = '0px';
    });
    // Six heads and five gaps, with nothing open: the constant the column is
    // built on. One panel is open in every steady state, so add one.
    list.style.height = `${list.offsetHeight + panelH}px`;

    panels.forEach((panel, i) => {
      panel.style.height = i === painted ? `${panelH}px` : '0px';
    });
  };

  /* ------------------------------------------------------------------------
     A principle takes over
     ------------------------------------------------------------------------
     Called only when the step actually changes, and it is the only place
     that knows which one is current.
     ------------------------------------------------------------------------ */
  const paint = (index: number) => {
    if (index === painted) return;
    const first = painted === -1;
    const previous = painted;
    painted = index;

    /* THE EXPANSION.
       Same duration, same ease, opposite directions. GSAP renders a tween as
       `start + (end - start) * ease(t)`, so the closing panel is exactly
       `panelH - opening` at every frame and the two always sum to one panel.
       That identity is why this can be a real height animation without the
       column moving - and it is the reason both halves must never be given
       different curves. */
    panels.forEach((panel, i) => {
      if (!first && i !== index && i !== previous) return;
      gsap.to(panel, {
        height: i === index ? panelH : 0,
        duration: first ? 0 : SWAP,
        ease: SWAP_EASE,
        overwrite: 'auto',
      });
    });

    /* THE WORDS.
       `opacity`, deliberately not `autoAlpha`. `autoAlpha` would add
       `visibility: hidden` and take five of the six principles out of the
       accessibility tree - and a charter a screen reader can only hear one
       sixth of is not a charter. The clip is a visual device; the text is
       always there.

       Out fast and up; in after the panel has started opening, so the lines
       arrive into space that already exists rather than being uncovered by
       the clip. */
    if (previous >= 0) {
      gsap.to(inners[previous].querySelectorAll<HTMLElement>('[data-in]'), {
        opacity: 0,
        y: -8,
        duration: 0.26,
        ease: 'power2.in',
        overwrite: 'auto',
      });
    }

    gsap.fromTo(
      inners[index].querySelectorAll<HTMLElement>('[data-in]'),
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: first ? 0 : 0.55,
        stagger: first ? 0 : 0.07,
        delay: first ? 0 : 0.14,
        ease: 'power3.out',
        overwrite: 'auto',
      },
    );

    // The photograph. A crossfade slow enough that it is not an edit.
    plate.show(index, first, !first);

    wiring.onStep(index);
  };

  /* ------------------------------------------------------------------------
     The scrubbed layer
     ------------------------------------------------------------------------
     One timeline carries the pin and everything continuous; the step and the
     two progress marks are rendered from the trigger's own progress. Reading
     the trigger rather than the timeline's playhead is what keeps the card
     change in step with the wheel - with a scrub the two are otherwise half
     a second apart, and a card that opens after the scroll that opened it is
     the exact feeling this section is trying not to have.
     ------------------------------------------------------------------------ */
  const setFill = fills.map((fill) => gsap.quickSetter(fill, 'scaleX'));
  const setRunner = runner ? gsap.quickSetter(runner, 'scaleX') : null;

  const render = (progress: number) => {
    const travelled = progress * SPAN;
    // Principles already passed stay filled: the column reads as a ledger of
    // what has been covered, not as six identical boxes.
    setFill.forEach((set, i) => set(gsap.utils.clamp(0, 1, travelled - i)));
    setRunner?.(progress);
    paint(gsap.utils.clamp(0, COUNT - 1, Math.floor(travelled)));
  };

  measure();

  /* ------------------------------------------------------------------------
     Does it actually fit?
     ------------------------------------------------------------------------
     A held composition has one constraint an ordinary section does not: all
     of it must be on the screen at once, because the reader cannot scroll to
     the part that does not fit - scrolling is the thing driving it. A pinned
     column whose sixth principle is below the fold is worse than no pin at
     all.

     The media query above gates on the viewport, which is most of the
     answer. It cannot see the rest of it: how the panel copy wraps depends
     on the column's width, and a browser two hundred pixels narrower can
     turn a three-line practice into four. So the composition is measured -
     `.charter__pin` is still in ordinary flow at this point, so its height
     is its real one - and if it does not fit, this build stands down and
     hands the section to the flowing one, which reads perfectly well on a
     wide screen and asks nothing of the viewport's height.
     ------------------------------------------------------------------------ */
  if (pin.getBoundingClientRect().height > window.innerHeight) {
    root.classList.remove('charter--pinned');
    list.style.height = '';
    gsap.set(panels, { clearProps: 'height' });
    return buildFlow(root, wiring);
  }

  /* Re-measured before every refresh rather than after one: at `refreshInit`
     the pin has been reverted to ordinary flow and the column is its real
     self, and writing a height afterwards would invalidate the positions the
     refresh had just finished calculating. */
  ScrollTrigger.addEventListener('refreshInit', measure);

  const scrubbed = gsap.timeline({
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => `+=${Math.max(STEP_MIN, window.innerHeight * STEP) * SPAN}`,
      pin,
      pinSpacing: true,
      anticipatePin: 1,
      /* Smoothing for the continuous layer only - the step below is read
         unsmoothed. Past about 0.6 this stops feeling like easing. */
      scrub: 0.5,
      invalidateOnRefresh: true,
      onUpdate: (self) => render(self.progress),
      // A resize can land the reader on a different principle than the one
      // they were reading. Repaint against the new measurement rather than
      // leaving the stale one on screen.
      onRefresh: (self) => render(self.progress),
    },
  });

  wiring.trigger = scrubbed.scrollTrigger ?? null;

  /* The whole of the continuous motion, and it is deliberately less than it
     wants to be. The deck creeps four per cent larger across the entire run,
     the photograph inside travels against it, and the head drifts up at its
     own rate. Two speeds is what reads as depth; one speed is a section
     sliding. Nobody should be able to say what moved. */
  scrubbed
    .fromTo('.charter__shots', { scale: 1 }, { scale: 1.045, ease: 'none', duration: 1 }, 0)
    .fromTo('.charter__image', { yPercent: -3.4 }, { yPercent: 3.4, ease: 'none', duration: 1 }, 0)
    .fromTo('.charter__head', { y: 0 }, { y: -20, ease: 'none', duration: 1 }, 0);

  // The first principle, before a pixel of scroll.
  render(0);

  return () => {
    ScrollTrigger.removeEventListener('refreshInit', measure);
    root.classList.remove('charter--pinned');
    wiring.trigger = null;
    wiring.onLive(false);

    /* Everything this branch wrote is cleared, so the stacked layout it hands
       back to is not carrying a zero height or a parked numeral from the
       composition it just left. */
    list.style.height = '';
    gsap.set(panels, { clearProps: 'height' });
    gsap.set(fills, { clearProps: 'all' });
    plate.clear();
    inners.forEach((inner) =>
      gsap.set(inner.querySelectorAll('[data-in]'), { clearProps: 'all' }),
    );
    gsap.set(['.charter__shots', '.charter__image', '.charter__head', '.charter__runner'], {
      clearProps: 'transform',
    });
  };
}

/* --------------------------------------------------------------------------
   The flowing run - narrow screens, and any screen too short to hold a pin
   --------------------------------------------------------------------------
   Not the pinned one, shrunk. A phone's scroll belongs to the person holding
   it, and a section that captures it to play a composition is a section they
   cannot get past. The six cards are already stacked and already open in the
   base layout, so each one only needs its own arrival - and the lime state
   still travels, because a ScrollTrigger that toggles a class costs nothing
   and the charter should feel like the same argument on both screens.
   -------------------------------------------------------------------------- */
function buildFlow(root: HTMLElement, wiring: Wiring) {
  wiring.onLive(true);

  const cards = gsap.utils.toArray<HTMLElement>('.ch-card', root);
  /* Present on a wide screen that could not hold the pin, absent on a narrow
     one. When it is there it still follows the reader - a sticky photograph
     stuck on the first principle while the fifth is being read is a picture
     of the wrong thing. */
  const plate = buildPlate(root);

  cards.forEach((card, i) => {
    rise(card.querySelectorAll<HTMLElement>('[data-lift], [data-in]'), {
      trigger: card,
      y: 18,
      stagger: 0.055,
      start: 'top 80%',
    });

    // Inside the frame only. The image is 110% tall and hung above its box,
    // so three per cent of its own height never exposes an edge.
    const image = card.querySelector<HTMLElement>('.ch-card__fig img');
    if (image) {
      gsap.fromTo(
        image,
        { yPercent: -3 },
        {
          yPercent: 3,
          ease: 'none',
          scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: 0.7 },
        },
      );
    }

    // Whichever card holds the middle of the screen is the current one. No
    // pin, no scrub, no scroll captured - one boolean per card.
    ScrollTrigger.create({
      trigger: card,
      start: 'top 64%',
      end: 'bottom 42%',
      onToggle: (self) => {
        if (!self.isActive) return;
        wiring.onStep(i);
        plate?.show(i, false, true);
      },
    });
  });

  return () => {
    wiring.onLive(false);
    plate?.clear();
  };
}

/* ==========================================================================
   The section
   ========================================================================== */

export function AboutCharter() {
  /** Which principle is current. Zero is a real answer, not "none". */
  const [active, setActive] = useState(0);

  /**
   * Whether a build is actually driving the section.
   *
   * It gates the lime state, and it has to: `active` is 0 from the first
   * render, so without this the first card would wear the accent on a page
   * where nothing can ever move it - six open cards, one of them inexplicably
   * marked. Under reduced motion the six are equal, and they look it.
   */
  const [live, setLive] = useState(false);

  /**
   * How far ahead of the reader the plate has been loaded.
   *
   * In the held composition all six photographs sit in one box inside the
   * viewport, so `loading="lazy"` buys nothing - the browser can see every
   * one of them and fetches the lot. Mounting one principle ahead turns that
   * back into real lazy loading, and a parent who leaves after the second
   * never pays for the other four.
   */
  const [reach, setReach] = useState(1);

  const narrow = useMediaQuery(NARROW);
  const { scrollTo } = useSmoothScroll();

  /* Mutable, and deliberately not state: the build writes its trigger here
     and the head handlers read it on press. Putting it in state would
     re-render the section every time the motion build swapped. */
  const wiring = useRef<Wiring>({ trigger: null, onStep: () => {}, onLive: () => {} });

  const scope = useGsapScope<HTMLElement>(
    (_ctx, root) => {
      /* Set on every build rather than once, because the ref outlives the
         context and a reverted build must not keep the old setters alive. */
      wiring.current.onStep = (index) => {
        setActive((current) => (current === index ? current : index));
        setReach((seen) => Math.max(seen, index + 1));
      };
      wiring.current.onLive = setLive;

      const title = root.querySelector<HTMLElement>('.charter__title');
      if (title) lines(title, { trigger: root });
      rise(root.querySelectorAll<HTMLElement>('[data-intro]'), {
        trigger: root,
        y: 18,
        delay: 0.28,
      });

      const mm = gsap.matchMedia(root);

      mm.add({ pinned: PINNED, flowing: FLOWING }, (context) => {
        const { pinned, flowing } = context.conditions as Record<string, boolean>;
        if (pinned) return buildPinned(root, wiring.current);
        if (flowing) return buildFlow(root, wiring.current);
      });

      return () => {
        mm.revert();
        wiring.current.trigger = null;
        /* A reader who reverts mid-run - a resize across the breakpoint, or
           motion switched off - should be handed the finished charter, not
           whichever half-open card the scroll happened to be on. */
        setLive(false);
        setActive(0);
      };
    },
    /* The markup itself changes across this breakpoint - the plate on one
       side of it, six card frames on the other - so the context has to be
       rebuilt against the DOM that is actually there. */
    [narrow],
  );

  /**
   * A head press moves the page, not the card.
   *
   * Inside the held run a principle's position is a scroll offset, so the
   * button converts its stage into one and asks Lenis for it - which means
   * the press and the wheel are doing the same thing to the same timeline.
   * Outside it there is no run to seek and every card is already open, so it
   * simply takes the reader to the one they asked for.
   */
  const seek = useCallback(
    (index: number) => () => {
      const trigger = wiring.current.trigger;
      if (trigger) {
        // Four tenths in: past the point the stage takes over, short of the
        // point it hands on.
        const at = trigger.start + (trigger.end - trigger.start) * ((index + 0.4) / SPAN);
        scrollTo(at);
        return;
      }
      const card = document.getElementById(`charter-${VALUES[index].id}`);
      if (card) scrollTo(card, -110);
    },
    [scrollTo],
  );

  return (
    <section ref={scope} className="section section--navy charter" id="values">
      <div className="charter__pin">
        <div className="wrap charter__inner">
          <header className="charter__head">
            <div className="charter__head-left">
              {/* A div, not a span: `rise` moves it, and a transform on an
                  inline box does nothing at all. */}
              <div data-intro>
                <Sticker tone="paper" tilt={-2}>
                  The charter
                </Sticker>
              </div>
              <h2 className="charter__title ed-h1">
                Six things we will <span className="ed-em">not trade.</span>
              </h2>
            </div>

            <p className="charter__lead" data-intro>
              Written in 1962 and never amended. Keep scrolling and they open one at a time -
              each with the two practices that hold it up, and the figure behind it.
            </p>
          </header>

          <div className="charter__body">
            {/* ------------------------------------------------------------
                Left - the plate
                ------------------------------------------------------------
                Hidden from assistive technology in one piece: six frames of
                which five are invisible would be six photo descriptions read
                out ahead of the charter, each illustrating a principle
                written in full beside it. On a narrow screen it is not
                rendered at all - the cards carry their own frames there,
                with their own real alt text.
                ------------------------------------------------------------ */}
            {!narrow && (
              <figure className="charter__plate" aria-hidden="true">
                <div className="charter__frame">
                  <div className="charter__shots">
                    {VALUES.map((value, i) => (
                      <span className="charter__shot" key={value.id}>
                        {i <= reach && (
                          <img
                            className="charter__image"
                            src={resolve(PHOTOS[i], 1100)}
                            srcSet={resolveSet(PHOTOS[i], [700, 1100, 1500])}
                            sizes="(max-width: 1023px) 92vw, 42vw"
                            alt=""
                            loading={i === 0 ? 'eager' : 'lazy'}
                            decoding="async"
                            style={PHOTOS[i].focus ? { objectPosition: PHOTOS[i].focus } : undefined}
                          />
                        )}
                      </span>
                    ))}
                  </div>

                  <span className="charter__veil" />

                  <span className="charter__stamp">
                    {VALUES.map((value) => (
                      <span className="charter__numeral" key={value.id}>
                        {value.index}
                      </span>
                    ))}
                  </span>
                </div>

                <figcaption className="charter__foot">
                  <span className="charter__count meta">
                    {VALUES[active].index} / {VALUES[COUNT - 1].index}
                  </span>
                  <span className="charter__track">
                    <i className="charter__runner" />
                  </span>
                </figcaption>
              </figure>
            )}

            {/* ------------------------------------------------------------
                Right - the six
                ------------------------------------------------------------ */}
            <ol className="charter__list">
              {VALUES.map((value, i) => {
                const on = live && i === active;
                const panelId = `charter-panel-${value.id}`;

                return (
                  <li
                    className={cx('ch-card', on && 'is-active')}
                    id={`charter-${value.id}`}
                    key={value.id}
                  >
                    <span className="ch-card__edge" aria-hidden="true" />

                    {narrow && (
                      <figure className="ch-card__fig" data-lift>
                        <img
                          src={resolve(PHOTOS[i], 900)}
                          srcSet={resolveSet(PHOTOS[i], [560, 900, 1200])}
                          sizes="92vw"
                          alt={PHOTOS[i].alt}
                          loading="lazy"
                          decoding="async"
                          style={PHOTOS[i].focus ? { objectPosition: PHOTOS[i].focus } : undefined}
                        />
                      </figure>
                    )}

                    <button
                      type="button"
                      className="ch-card__head"
                      data-cursor="link"
                      data-lift
                      aria-expanded={live ? on : true}
                      aria-controls={panelId}
                      onClick={seek(i)}
                    >
                      <span className="ch-card__index meta">{value.index}</span>
                      <span className="ch-card__title">{value.title}</span>
                      <span className="ch-card__dot" aria-hidden="true" />
                    </button>

                    <div className="ch-card__panel" id={panelId}>
                      <div className="ch-card__inner">
                        <p className="ch-card__body" data-in>
                          {value.description}
                        </p>

                        <ul className="ch-card__proof">
                          {value.proof.map((point) => (
                            <li key={point.slice(0, 24)} data-in>
                              {point}
                            </li>
                          ))}
                        </ul>

                        <p className="ch-card__mark" data-in>
                          <b>{value.mark.value}</b>
                          <span className="meta">{value.mark.label}</span>
                        </p>
                      </div>
                    </div>

                    <span className="ch-card__track" aria-hidden="true">
                      <i className="ch-card__fill" />
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
