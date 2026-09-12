import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { LEADERSHIP } from '@/constants';
import { facultyImages, resolve, resolveSet } from '@/constants/imagery';
import type { Photo } from '@/constants/imagery';
import type { Person } from '@/types';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { reduced, rise, unmask } from '@/lib/motion';
import { Mark, Sticker } from '@/components/editorial';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import './leadership.css';

/* ==========================================================================
   08 - LEADERSHIP
   --------------------------------------------------------------------------
   Four people, one at a time. The portrait stands on the left, the names
   stack on the right, and a black strip travels down the names as the reader
   scrolls the section. Whoever the strip is on is the person in the frame,
   the person in the caption, and the person whose sentence is on the card.

   ONE INDEX, ONE FUNCTION

   Everything visible here is a projection of a single number. `changeLeader`
   is the only thing that reads it and the only thing that moves anything:
   the strip, the portrait, the caption, the quote and the supporting line
   are five stacks driven from one call, which is what makes the change read
   as one interface responding rather than as five animations that happen to
   start together. There is no per-leader animation code anywhere below.

   WHAT DRIVES THE INDEX

     scroll   the default. The section holds the viewport and the reader's
              own scroll walks the strip down the column, one leader per
              stage, releasing after the last.
     a press  a row is a real button. While the run is pinned a press does
              not set the index - it converts that leader's stage into a
              scroll offset and asks for it, so the pointer and the wheel are
              driving the same timeline and can never disagree.
     a key    the column is a tablist. Up and down move the selection, Home
              and End jump to the ends, and each goes through the same press
              path.

   REDUCED MOTION IS NOT A SLOWER VERSION OF THIS

   There is no pin and no scrub under it - a 1ms scrub still ties the page's
   appearance to the wheel. The stage is still built, because this section is
   a selector and a selector that cannot select is broken, not calm: the
   strip, the portrait and the card all still change, they just change at
   once, when the reader asks. Which is what reduced motion means.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Content
   --------------------------------------------------------------------------
   The four are the school's own leadership, unchanged - names, roles, the
   line about each of them, and the thing each of them actually said. The
   reference's five names are a different organisation's staff; the
   interaction is what was being asked for, not the people in it.

   Photography comes from `imagery.ts` rather than from `Person.portrait`,
   because those entries carry a `focus` placing the face in the upper third
   and this frame crops hard on every viewport.
   -------------------------------------------------------------------------- */

interface Leader extends Person {
  photo: Photo;
}

const LEADERS: Leader[] = LEADERSHIP.map((person, i) => ({
  ...person,
  photo: facultyImages[i] ?? facultyImages[0],
}));

const COUNT = LEADERS.length;

/* --------------------------------------------------------------------------
   Timing
   --------------------------------------------------------------------------
   `ease-out-quint` is registered in `lib/gsap.ts` from the same four numbers
   as the `--ld-ease` cubic-bezier in the stylesheet, so the scripted travel
   and the CSS state changes underneath it are one curve rather than two that
   look nearly the same.
   -------------------------------------------------------------------------- */
const EASE = 'ease-out-quint';

/** The strip's journey. Fast enough to feel precise, long enough to be seen. */
const BAR = 0.58;
/** The crossfade under it. Shorter, so the picture is settled when it lands. */
const FADE = 0.44;

/** Screen-heights of scroll each leader is given, while the section is held. */
const STEP = 0.72;
/** Extra hold after the last, so the fourth is read rather than glimpsed. */
const TAIL = 0.5;
/** The run, in stage units. Progress × this is "who, and how far through". */
const SPAN = COUNT + TAIL;
/** Floor per stage, so a short laptop does not turn the run into a flicker. */
const STEP_MIN = 460;

const MOTION = '(prefers-reduced-motion: no-preference)';
const WIDE = '(min-width: 1024px)';

/* ==========================================================================
   The stage
   --------------------------------------------------------------------------
   Built once, whatever is driving it. Returns the one transition function
   and the measurement it depends on.
   ========================================================================== */

interface Stage {
  changeLeader: (index: number, immediate?: boolean) => void;
  measure: () => void;
  clear: () => void;
}

/**
 * A set of elements occupying one slot, of which one is visible.
 *
 * Five things on this screen work this way - the portraits, the caption
 * thumbnails, the caption names, the quotes and the supporting lines - so it
 * is written once. `dir` is the direction of travel down the list, so a
 * leader arriving from below enters from below and scrolling back up
 * reverses the move rather than replaying it.
 */
function slot(nodes: HTMLElement[], travel: number) {
  const show = (index: number, immediate: boolean, dir: number) => {
    nodes.forEach((node, i) => {
      gsap.to(node, {
        opacity: i === index ? 1 : 0,
        duration: immediate ? 0 : FADE,
        ease: 'power2.inOut',
        overwrite: 'auto',
      });
    });

    if (immediate || !travel) {
      gsap.set(nodes, { y: 0, x: 0 });
      return;
    }

    gsap.fromTo(
      nodes[index],
      { y: travel * dir },
      { y: 0, duration: BAR, ease: EASE, overwrite: 'auto' },
    );
  };

  return { show, nodes };
}

function buildStage(root: HTMLElement): Stage | null {
  /* Under reduced motion the section still changes - it is a selector, and a
     selector that cannot select is broken rather than calm - but it changes
     at once rather than travelling. Read once, here, so every move below is
     governed by a single flag instead of four scattered checks. */
  const still = reduced();

  const list = root.querySelector<HTMLElement>('.ld-list');
  const bar = root.querySelector<HTMLElement>('.ld-bar');
  const inner = root.querySelector<HTMLElement>('.ld-bar__inner');
  const quoteStack = root.querySelector<HTMLElement>('.ld-quote__stack');
  const badgeNames = root.querySelector<HTMLElement>('.ld-badge__names');
  const detail = root.querySelector<HTMLElement>('.ld__detail');

  const rows = gsap.utils.toArray<HTMLElement>('.ld-list > button.ld-row', root);
  const shots = gsap.utils.toArray<HTMLElement>('.ld-shot', root);

  if (!list || !bar || !inner || !quoteStack || !badgeNames || !detail) return null;
  if (rows.length !== COUNT || shots.length !== COUNT) return null;

  const portraits = slot(shots, 0);
  const thumbs = slot(gsap.utils.toArray<HTMLElement>('.ld-badge__av img', root), 0);
  const names = slot(gsap.utils.toArray<HTMLElement>('.ld-badge__name', root), 8);
  const quotes = slot(gsap.utils.toArray<HTMLElement>('.ld-quote__line', root), 14);
  const lines = slot(gsap.utils.toArray<HTMLElement>('.ld__detail p', root), 12);

  /* ------------------------------------------------------------------------
     The strip, and the copy of the list inside it
     ------------------------------------------------------------------------
     Two translations from one number. Written through `quickSetter`, which
     reuses one interpolator rather than building a tween per frame, and
     driven from a single proxy so the window and its contents cannot come
     apart even for a frame - which is the entire trick, because the moment
     they do the white text slides off the black.
     ------------------------------------------------------------------------ */
  const at = { y: 0 };
  const setBar = gsap.quickSetter(bar, 'y', 'px');
  const setInner = gsap.quickSetter(inner, 'y', 'px');

  const paintBar = () => {
    setBar(at.y);
    setInner(-at.y);
  };

  /* ------------------------------------------------------------------------
     Measurement
     ------------------------------------------------------------------------
     Four boxes hold a stack of things of different sizes, and a box that
     resizes as the stack changes is a box that makes the whole composition
     twitch once per leader. Each is held at the largest of what it has to
     hold - and "largest" is a different leader at different widths, so this
     runs again on every refresh rather than once.
     ------------------------------------------------------------------------ */
  const widest = (nodes: HTMLElement[]) => Math.max(...nodes.map((n) => n.offsetWidth));
  const tallest = (nodes: HTMLElement[]) => Math.max(...nodes.map((n) => n.offsetHeight));

  let index = 0;

  const measure = () => {
    // The strip is one row tall and stays that shape for the whole run.
    bar.style.height = `${rows[0].offsetHeight}px`;

    quoteStack.style.minHeight = '';
    quoteStack.style.minHeight = `${tallest(quotes.nodes)}px`;

    detail.style.minHeight = '';
    detail.style.minHeight = `${tallest(lines.nodes)}px`;

    badgeNames.style.width = '';
    badgeNames.style.width = `${widest(names.nodes)}px`;

    // Re-seat the strip against the row positions the refresh just produced.
    at.y = rows[index]?.offsetTop ?? 0;
    paintBar();
  };

  /* ------------------------------------------------------------------------
     changeLeader - the only thing that moves anything
     ------------------------------------------------------------------------ */
  let painted = -1;

  const changeLeader = (next: number, immediate = false) => {
    if (next === painted) return;
    const first = painted === -1;
    const dir = first ? 1 : Math.sign(next - painted);
    const now = immediate || first || still;
    painted = next;
    index = next;

    /* 1. THE STRIP. One tween on one number; the window and its white copy
       are written from it every frame. `overwrite: true` because a reader
       scrolling fast is asking for the newest target and nothing else. */
    gsap.to(at, {
      y: rows[next].offsetTop,
      duration: now ? 0 : BAR,
      ease: EASE,
      overwrite: true,
      onUpdate: paintBar,
      onComplete: paintBar,
    });

    /* 2. THE PORTRAIT. A crossfade slow enough not to be an edit, with the
       incoming frame settling the last few per cent of a move. `.ld-shot`
       owns x, y, scale and opacity and nothing else, so this can never
       collide with the deck's slow travel or the crop inside the picture. */
    portraits.show(next, now, dir);

    if (now) {
      gsap.set(shots, { xPercent: 0, yPercent: 0, scale: 1 });
    } else {
      gsap.fromTo(
        shots[next],
        { xPercent: -1.6 * dir, yPercent: 2.4 * dir, scale: 1.035 },
        {
          xPercent: 0,
          yPercent: 0,
          scale: 1,
          duration: 1.05,
          ease: EASE,
          overwrite: 'auto',
        },
      );
    }

    /* 3. THE CAPTION, THE QUOTE, THE LINE. Same slot, same direction, three
       different travels - the bigger the type, the further it moves. */
    thumbs.show(next, now, dir);
    names.show(next, now, dir);
    quotes.show(next, now, dir);
    lines.show(next, now, dir);
  };

  measure();
  changeLeader(0, true);

  const clear = () => {
    gsap.killTweensOf(at);
    gsap.set([...shots, ...thumbs.nodes, ...names.nodes, ...quotes.nodes, ...lines.nodes], {
      clearProps: 'all',
    });
    gsap.set([bar, inner], { clearProps: 'transform' });
    bar.style.height = '';
    quoteStack.style.minHeight = '';
    detail.style.minHeight = '';
    badgeNames.style.width = '';
  };

  return { changeLeader, measure, clear };
}

/* ==========================================================================
   The scroll run
   ========================================================================== */

interface Wiring {
  /** The pinned run, so a press can convert a stage into a scroll. */
  trigger: ScrollTrigger | null;
  /** Set the leader directly. Used when nothing is driving the section. */
  change: ((index: number) => void) | null;
  onStep: (index: number) => void;
}

/**
 * Hold the section and walk the strip down it.
 *
 * The step is read off the trigger's own progress rather than off a scrubbed
 * timeline's playhead: with a scrub the two are half a second apart, and a
 * strip that starts moving after the scroll that asked for it is exactly the
 * lag this interaction cannot have.
 */
function buildPinned(root: HTMLElement, stage: Stage, wiring: Wiring) {
  const pin = root.querySelector<HTMLElement>('.ld__pin');
  if (!pin) return;

  root.classList.add('ld--pinned');

  /* Does it fit?
     ----------------------------------------------------------------------
     A held composition has one constraint an ordinary section does not: all
     of it has to be on screen at once, because the reader cannot scroll to
     the part that is not - scrolling is the thing driving it. `.ld__pin` is
     still in ordinary flow here, so its height is its real one. If it does
     not fit, this build stands down and the flowing one takes over. */
  if (pin.getBoundingClientRect().height > window.innerHeight) {
    root.classList.remove('ld--pinned');
    return;
  }

  const render = (progress: number) => {
    const index = gsap.utils.clamp(0, COUNT - 1, Math.floor(progress * SPAN));
    stage.changeLeader(index);
    /* And tell React, which owns everything the animation cannot express:
       which tab is selected, which tab the keyboard lands on, and which of
       the four sets of panel content assistive technology is allowed to see.
       Both calls no-op when the index has not moved. */
    wiring.onStep(index);
  };

  /* Re-measured before every refresh rather than after one: at `refreshInit`
     the pin is back in ordinary flow and the column is its real self, and
     writing sizes afterwards would invalidate the positions the refresh had
     just finished calculating. */
  ScrollTrigger.addEventListener('refreshInit', stage.measure);

  const scrubbed = gsap.timeline({
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => `+=${Math.max(STEP_MIN, window.innerHeight * STEP) * SPAN}`,
      pin,
      pinSpacing: true,
      anticipatePin: 1,
      // Smoothing for the continuous layer only; the step above is read raw.
      scrub: 0.45,
      invalidateOnRefresh: true,
      onUpdate: (self) => render(self.progress),
      // A resize can land the reader on a different leader than the one they
      // were reading. Repaint against the new measurement.
      onRefresh: (self) => render(self.progress),
    },
  });

  wiring.trigger = scrubbed.scrollTrigger ?? null;

  /* The whole of the continuous motion, and it is deliberately less than it
     wants to be: the deck of portraits creeps across the frame for the
     length of the pin while the names travel the other way by a third as
     much. Two speeds is what reads as depth. Nobody should be able to say
     what moved. */
  scrubbed
    .fromTo('.ld-shots', { yPercent: -1.6 }, { yPercent: 1.6, ease: 'none', duration: 1 }, 0)
    .fromTo('.ld__side', { y: 14 }, { y: -14, ease: 'none', duration: 1 }, 0);

  render(0);

  return () => {
    ScrollTrigger.removeEventListener('refreshInit', stage.measure);
    root.classList.remove('ld--pinned');
    wiring.trigger = null;
    gsap.set(['.ld-shots', '.ld__side'], { clearProps: 'transform' });
  };
}

/* --------------------------------------------------------------------------
   The flowing run - a phone, and any screen too short to hold the pin
   --------------------------------------------------------------------------
   Not the held composition, shrunk.

   The full composition is a portrait, a quote, four rows and a supporting
   line, and on a phone that is taller than the screen. Holding it would mean
   cutting content out of it to make it fit, which is the wrong trade: the
   photograph and the sentence are the section.

   So nothing is held. The section is ordinary document flow at its natural
   height, and the four leaders are mapped onto its passage through the
   viewport instead - the reader scrolls past and the strip walks down, the
   portrait changes, the quote changes, exactly as it does on a desktop. It
   captures no scroll, adds no spacer, and a reader who does not care about
   the fourth can simply keep going.
   -------------------------------------------------------------------------- */
function buildFlow(root: HTMLElement, stage: Stage, wiring: Wiring) {
  const stageEl = root.querySelector<HTMLElement>('.ld__stage') ?? root;

  const trigger = ScrollTrigger.create({
    trigger: stageEl,
    /* From the moment the composition is properly on screen to the moment it
       is properly off it. Deliberately inside both edges: mapping the four
       across the full passage would spend the first leader while the section
       was still arriving. */
    start: 'top 72%',
    end: 'bottom 36%',
    onUpdate: (self) => {
      const index = gsap.utils.clamp(0, COUNT - 1, Math.floor(self.progress * COUNT));
      stage.changeLeader(index);
      wiring.onStep(index);
    },
  });

  ScrollTrigger.addEventListener('refreshInit', stage.measure);

  return () => {
    ScrollTrigger.removeEventListener('refreshInit', stage.measure);
    trigger.kill();
  };
}

/* ==========================================================================
   The section
   ========================================================================== */

export function AboutLeadership() {
  const [active, setActive] = useState(0);
  const { scrollTo } = useSmoothScroll();

  /* Mutable, and deliberately not state: the builds write here and the press
     handlers read it. Putting it in state would re-render the section every
     time a build swapped. */
  const wiring = useRef<Wiring>({ trigger: null, change: null, onStep: () => {} });
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const scope = useGsapScope<HTMLElement>((_ctx, root) => {
    wiring.current.onStep = (index) =>
      setActive((current) => (current === index ? current : index));

    /* The stage is built whatever the reader's motion setting is - see the
       header. Only the scroll run below is conditional. */
    const stage = buildStage(root);
    if (!stage) return;

    wiring.current.change = (index) => {
      stage.changeLeader(index);
      wiring.current.onStep(index);
    };

    unmask(root.querySelectorAll<HTMLElement>('.ld-frame'), { trigger: root, from: 'bottom' });
    rise(root.querySelectorAll<HTMLElement>('[data-intro]'), {
      trigger: root,
      y: 18,
      stagger: 0.06,
    });

    const mm = gsap.matchMedia(root);

    mm.add({ motion: MOTION, wide: WIDE }, (context) => {
      const { motion, wide } = context.conditions as Record<string, boolean>;
      if (!motion) return;
      /* Wide screens get the held composition if it fits on them.
         `buildPinned` returns nothing when it stands down, and everything
         that is not holding the viewport flows instead. */
      if (wide) {
        const release = buildPinned(root, stage, wiring.current);
        if (release) return release;
      }
      return buildFlow(root, stage, wiring.current);
    });

    return () => {
      mm.revert();
      wiring.current.trigger = null;
      wiring.current.change = null;
      stage.clear();
      /* A reader who reverts mid-run - a resize, or motion switched off -
         should be handed the first leader and a working selector, not
         whichever half-travelled frame the scroll happened to be on. */
      setActive(0);
    };
  }, []);

  /**
   * A press picks a leader, and the scroll stays the only authority.
   *
   * Under the pinned run a leader's position IS a scroll offset, so the
   * button converts their stage into one and asks for that - it does not
   * set the index itself. That is the whole reason the strip can never end
   * up on a person the scroll disagrees with: there is one number, the
   * scroll produces it, and the press moves the scroll. Setting the index
   * here as well would look like it worked and then be undone by the next
   * refresh or the next notch of the wheel.
   *
   * With no run there is nothing to seek and no scroll position to
   * contradict, so the change is made directly.
   *
   * KNOWN: the seek goes through the site's shared smooth-scroll helper,
   * and on this page that helper does not reliably move a pinned section -
   * the chapter rail's own `#vision`, `#values` and `#leadership` anchors
   * miss for the same reason. When it fails the press is inert rather than
   * wrong, which is the right way round; the fix belongs in
   * `SmoothScrollProvider`, not here.
   */
  const select = useCallback(
    (index: number) => {
      const { trigger, change } = wiring.current;
      if (trigger) {
        // Four tenths in: past the point the stage takes over, short of the
        // point it hands on.
        scrollTo(trigger.start + (trigger.end - trigger.start) * ((index + 0.4) / SPAN));
        return;
      }
      change?.(index);
    },
    [scrollTo],
  );

  /**
   * Vertical tablist keys. Up and down move by one, Home and End go to the
   * ends, and every one of them goes through the same press path - so a
   * keyboard cannot reach a state the wheel cannot.
   */
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const keys: Record<string, number> = {
        ArrowDown: active + 1,
        ArrowRight: active + 1,
        ArrowUp: active - 1,
        ArrowLeft: active - 1,
        Home: 0,
        End: COUNT - 1,
      };
      const next = keys[event.key];
      if (next === undefined) return;

      event.preventDefault();
      const clamped = gsap.utils.clamp(0, COUNT - 1, next);
      rowRefs.current[clamped]?.focus();
      select(clamped);
    },
    [active, select],
  );

  const leader = LEADERS[active];

  return (
    <section ref={scope} className="section section--paper ld" id="leadership">
      <div className="ld__pin">
        <div className="wrap ld__inner">
          <header className="ld__head">
            <div data-intro>
              <Sticker tone="blue" tilt={-2}>
                Who runs the school
              </Sticker>
            </div>
            <h2 className="ld__title ed-h3" id="ld-title">
              Four people, and the number you <Mark kind="underline">actually call.</Mark>
            </h2>
            <p className="ld__lead" data-intro>
              Every one of them teaches or has taught. None of them is only an administrator.
            </p>
          </header>

          <div className="ld__stage">
            {/* ------------------------------------------------------------
                Left - the portrait, the caption and the sentence
                ------------------------------------------------------------
                One panel for the whole tablist rather than one per tab: it
                is a single frame whose contents change, and four panels of
                which three are permanently empty would be four things for a
                screen reader to walk past.
                ------------------------------------------------------------ */}
            <div
              className="ld__plate"
              id="ld-panel"
              role="tabpanel"
              aria-labelledby={`ld-tab-${leader.id}`}
            >
              <figure className="ld-frame">
                <span className="ld-shots">
                  {LEADERS.map((person, i) => (
                    <span className="ld-shot" key={person.id} aria-hidden={i !== active}>
                      <img
                        src={resolve(person.photo, 900)}
                        srcSet={resolveSet(person.photo, [520, 900, 1200])}
                        sizes="(max-width: 1023px) 300px, 38vw"
                        alt={`${person.name}, ${person.role}`}
                        loading={i === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        style={person.photo.focus ? { objectPosition: person.photo.focus } : undefined}
                      />
                    </span>
                  ))}
                </span>

                {/* The caption. Hidden from assistive technology: it names
                    the person whose name is already the selected tab, and
                    the portrait above it already carries their name in its
                    alt text. */}
                <figcaption className="ld-badge" aria-hidden="true">
                  <span className="ld-badge__av">
                    {LEADERS.map((person) => (
                      <img
                        src={resolve(person.photo, 120)}
                        alt=""
                        key={person.id}
                        loading="lazy"
                        decoding="async"
                        style={person.photo.focus ? { objectPosition: person.photo.focus } : undefined}
                      />
                    ))}
                  </span>
                  <span className="ld-badge__names">
                    {LEADERS.map((person) => (
                      <span className="ld-badge__name" key={person.id}>
                        {person.name}
                      </span>
                    ))}
                  </span>
                </figcaption>
              </figure>

              <div className="ld-quote">
                <div className="ld-quote__stack">
                  {LEADERS.map((person, i) => (
                    <blockquote
                      className="ld-quote__line"
                      key={person.id}
                      aria-hidden={i !== active}
                    >
                      &ldquo;{person.quote}&rdquo;
                    </blockquote>
                  ))}
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------------
                Right - the names
                ------------------------------------------------------------ */}
            <div className="ld__side">
              <div
                className="ld-list"
                role="tablist"
                aria-orientation="vertical"
                aria-labelledby="ld-title"
                onKeyDown={onKeyDown}
              >
                {LEADERS.map((person, i) => (
                  <button
                    type="button"
                    className="ld-row"
                    id={`ld-tab-${person.id}`}
                    key={person.id}
                    ref={(node) => {
                      rowRefs.current[i] = node;
                    }}
                    role="tab"
                    aria-selected={i === active}
                    aria-controls="ld-panel"
                    /* Roving tabindex: one stop for the whole column, and the
                       arrow keys move within it. Four tab stops to get past a
                       list of four names is three too many. */
                    tabIndex={i === active ? 0 : -1}
                    data-cursor="link"
                    onClick={() => select(i)}
                  >
                    <span className="ld-row__name">{person.name}</span>
                    <span className="ld-row__role">{person.role}</span>
                  </button>
                ))}

                {/* THE STRIP. A window with its own white copy of the list
                    inside it - see the stylesheet on why it is built this way
                    rather than as a background on the active row. */}
                <span className="ld-bar" aria-hidden="true">
                  <span className="ld-bar__inner">
                    {LEADERS.map((person) => (
                      <span className="ld-row" key={person.id}>
                        <span className="ld-row__name">{person.name}</span>
                        <span className="ld-row__role">{person.role}</span>
                      </span>
                    ))}
                  </span>
                </span>
              </div>

              {/* The supporting line. Four in the box, three of them behind
                  the fourth and hidden from assistive technology - selecting
                  a leader is what surfaces theirs, which is the whole point
                  of the tablist. */}
              <div className="ld__detail">
                {LEADERS.map((person, i) => (
                  <p key={person.id} aria-hidden={i !== active}>
                    {person.detail}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
