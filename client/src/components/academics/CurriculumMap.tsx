import { useCallback, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import type { Photo } from '@/constants/imagery';
import { resolve, resolveSet } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { lines, reduced, rise } from '@/lib/motion';
import { Mark } from '@/components/editorial';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import './curriculum-map.css';

/* ==========================================================================
   02 - THE CURRICULUM MAP
   --------------------------------------------------------------------------
   An editorial chapter that holds the viewport while the reader scrolls
   through four stages. The head scrolls normally; everything from the stage
   navigation down is pinned, and the run is divided into four equal
   segments. The segment the scroll is in IS the active stage.

   ONE NUMBER, TWO WRITERS, ONE DIRECTION

   The active index lives in React state, because React owns what cannot be
   animated: which tab is selected, which panel is inert, what the live
   region announces. It is written from exactly two places:

     scroll   while pinned, the trigger's raw progress picks the segment
     a press  when nothing is pinned, the press sets it directly

   While pinned, a press never sets the index. It converts the stage into a
   scroll offset and asks for that, so the wheel and the pointer drive the
   same run and cannot disagree about where the reader is.

   Every visible change - photographs, copy, counter - is one layout effect
   keyed on that index. There is no per-stage animation code.

   WHEN IT DOES NOT PIN

     reduced motion   never. The section is a working tablist: a press
                      changes the stage at once, and nothing moves.
     does not fit     the pinned composition must be entirely on screen,
                      because scrolling is what drives it. If it is taller
                      than the viewport the section flows instead, with the
                      same presses and the same transitions.

   Only the current stage is visible, and the stylesheet says so rather than
   the animation: which stage is showing is state, not an entrance. The
   transitions write inline styles that outrank those rules while they run,
   then clear them.
   ========================================================================== */

export interface Placement {
  /** Position and size as percentages of the image plate, on a wide screen. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees. Kept under about 4 - past that a print reads as dropped. */
  rotate: number;
}

export interface CurriculumStage {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  /** The class range, e.g. "Classes 1-5". */
  range: string;
  ages: string;
  board: string;
  subjects: string;
  assessment: string;
  /** The closing line: what the stage is meant to produce. */
  detail: string;
  image: Photo;
  secondaryImage: Photo;
  layout: {
    image: Placement;
    secondary: Placement;
    /** Which edge of the lead photograph its caption hangs from. */
    caption?: 'start' | 'end';
  };
}

interface CurriculumMapProps {
  stages: CurriculumStage[];
  /** The curriculum disclosure, printed under the section. */
  colophon?: ReactNode;
  id?: string;
}

const MOTION = '(prefers-reduced-motion: no-preference)';
const WIDE = '(min-width: 1024px)';

/** Screen-heights of scroll per stage while the section is held. */
const STEP_WIDE = 0.9;
const STEP_NARROW = 0.72;

const pad = (n: number) => String(n).padStart(2, '0');

const place = (p: Placement) =>
  ({
    '--x': `${p.x}%`,
    '--y': `${p.y}%`,
    '--w': `${p.w}%`,
    '--h': `${p.h}%`,
    '--r': `${p.rotate}deg`,
  }) as CSSProperties;

export function CurriculumMap({ stages, colophon, id }: CurriculumMapProps) {
  const count = stages.length;
  const [active, setActive] = useState(0);
  const previous = useRef(0);
  const run = useRef<ScrollTrigger | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const list = useRef<HTMLDivElement>(null);
  const { scrollTo } = useSmoothScroll();

  /* ------------------------------------------------------------------------
     The run
     ------------------------------------------------------------------------ */
  const scope = useGsapScope<HTMLElement>(
    (_ctx, root) => {
      const title = root.querySelector<HTMLElement>('.cm__title');
      if (title) lines(title, { trigger: root });
      rise(root.querySelectorAll<HTMLElement>('[data-intro]'), {
        trigger: root,
        delay: 0.2,
        stagger: 0.07,
      });

      const pin = root.querySelector<HTMLElement>('.cm__pin');
      const fill = root.querySelector<SVGPathElement>('.cm-nav__fill');
      if (!pin || !fill) return;

      rise(pin.querySelectorAll<HTMLElement>('[data-enter]'), {
        trigger: pin,
        y: 22,
        stagger: 0.08,
      });

      const mm = gsap.matchMedia(root);

      mm.add({ motion: MOTION, wide: WIDE }, (context) => {
        const { motion, wide } = context.conditions as Record<string, boolean>;
        if (!motion) return;

        /* Does it fit? Measured with the pinned styles applied, since they
           are what decide the composition's real height. */
        root.classList.add('cm--pinned');
        if (pin.getBoundingClientRect().height > window.innerHeight + 1) {
          root.classList.remove('cm--pinned');
          return;
        }

        const render = (progress: number) => {
          // Read raw, not off the scrubbed timeline: the stage must change on
          // the scroll that asked for it, not half a second later.
          const index = gsap.utils.clamp(0, count - 1, Math.floor(progress * count));
          setActive((current) => (current === index ? current : index));
          root.classList.toggle('cm--started', progress > 0.015);
        };

        const step = wide ? STEP_WIDE : STEP_NARROW;

        const scrubbed = gsap.timeline({
          scrollTrigger: {
            trigger: pin,
            start: 'top top',
            end: () => `+=${Math.round(window.innerHeight * step * count)}`,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            scrub: 0.5,
            invalidateOnRefresh: true,
            onUpdate: (self) => render(self.progress),
            onRefresh: (self) => render(self.progress),
          },
        });

        /* The continuous layer: the progress hairline draws along the sweep
           behind the programme selector, and the photographs drift a few per
           cent against the copy, so the held frame is never quite still. */
        scrubbed
          .fromTo(
            fill,
            { strokeDashoffset: 1 },
            { strokeDashoffset: 0, ease: 'none', duration: 1 },
            0,
          )
          .fromTo(
            root.querySelector('.cm__plates'),
            { yPercent: 1.4 },
            { yPercent: -1.4, ease: 'none', duration: 1 },
            0,
          );

        run.current = scrubbed.scrollTrigger ?? null;

        return () => {
          run.current = null;
          root.classList.remove('cm--pinned', 'cm--started');
        };
      });

      return () => mm.revert();
    },
    [stages],
  );

  /* ------------------------------------------------------------------------
     The transition - the only thing that moves when the stage changes
     ------------------------------------------------------------------------ */
  useIsomorphicLayoutEffect(() => {
    const root = scope.current;
    const from = previous.current;
    previous.current = active;
    if (!root || from === active || reduced()) return;

    const plates = root.querySelectorAll<HTMLElement>('.cm-plate');
    const panels = root.querySelectorAll<HTMLElement>('.cm-panel');
    const outPlate = plates[from];
    const inPlate = plates[active];
    const outPanel = panels[from];
    const inPanel = panels[active];
    if (!outPlate || !inPlate || !outPanel || !inPanel) return;

    const dir = active > from ? 1 : -1;
    const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

    /* Outgoing. `fromTo` rather than `to`: React has already moved
       `.is-current`, so the stylesheet has hidden these - starting at
       `autoAlpha: 1` is what lets them leave on screen. */
    tl.fromTo(
      outPlate,
      { autoAlpha: 1 },
      { autoAlpha: 0, duration: 0.55, ease: 'power2.inOut', clearProps: 'opacity,visibility' },
      0,
    ).fromTo(
      outPlate.querySelectorAll('.cm-shot'),
      { y: 0 },
      { y: -26 * dir, duration: 0.55, ease: 'power2.in', clearProps: 'transform' },
      0,
    );

    tl.fromTo(
      outPanel,
      { autoAlpha: 1, y: 0 },
      {
        autoAlpha: 0,
        y: -14 * dir,
        duration: 0.32,
        ease: 'power2.in',
        clearProps: 'opacity,visibility,transform',
      },
      0,
    );

    /* Incoming photographs. The lead is printed from the edge the reader is
       travelling toward while the picture inside settles; the inset runs
       past the frame at rest so the print's own shadow is never clipped. */
    const main = inPlate.querySelector<HTMLElement>('.cm-shot--main');
    const second = inPlate.querySelector<HTMLElement>('.cm-shot--second');
    const edge = dir > 0 ? 'inset(100% -14% -14% -14%)' : 'inset(-14% -14% 100% -14%)';

    if (main) {
      tl.fromTo(
        main,
        { clipPath: edge },
        {
          clipPath: 'inset(-14% -14% -14% -14%)',
          duration: 1.05,
          ease: 'power4.inOut',
          clearProps: 'clipPath',
        },
        0.08,
      );
      const picture = main.querySelector('img');
      if (picture) {
        tl.fromTo(
          picture,
          { scale: 1.14 },
          { scale: 1, duration: 1.5, ease: 'power3.out', clearProps: 'transform' },
          0.08,
        );
      }
    }

    // The smaller print is laid on top a beat later, turning into its angle.
    if (second) {
      tl.fromTo(
        second,
        { autoAlpha: 0, y: 44 * dir, rotation: 4 * dir },
        {
          autoAlpha: 1,
          y: 0,
          rotation: 0,
          duration: 1,
          ease: 'power3.out',
          clearProps: 'opacity,visibility,transform',
        },
        0.34,
      );
    }

    const caption = inPlate.querySelector('.cm-shot__cap');
    if (caption) {
      tl.fromTo(
        caption,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.5, clearProps: 'opacity,visibility' },
        0.72,
      );
    }

    // Incoming copy, line by line, from the direction of travel.
    tl.fromTo(
      inPanel.querySelectorAll('[data-reveal]'),
      { autoAlpha: 0, y: 20 * dir },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.72,
        ease: 'power3.out',
        stagger: 0.055,
        clearProps: 'opacity,visibility,transform',
      },
      0.24,
    );

    const now = root.querySelector('.cm-count__now');
    if (now) {
      tl.fromTo(
        now,
        { yPercent: 80 * dir, autoAlpha: 0 },
        {
          yPercent: 0,
          autoAlpha: 1,
          duration: 0.6,
          ease: 'power3.out',
          clearProps: 'transform,opacity,visibility',
        },
        0.12,
      );
    }

    /* A reader scrolling fast asks for the next stage before this one lands.
       Finishing it rather than killing it runs every `clearProps`, so no
       half-faded inline style is left outranking the stylesheet. */
    return () => {
      tl.progress(1).kill();
    };
  }, [active]);

  /* On a screen where the programme row scrolls sideways, keep the selected
     programme in view. Only the row moves - never the page. */
  useIsomorphicLayoutEffect(() => {
    const row = list.current;
    const tab = tabs.current[active];
    if (!row || !tab || row.scrollWidth <= row.clientWidth + 1) return;
    const left = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;
    row.scrollTo({ left, behavior: reduced() ? 'auto' : 'smooth' });
  }, [active]);

  /* ------------------------------------------------------------------------
     Presses and keys
     ------------------------------------------------------------------------ */
  const select = useCallback(
    (index: number) => {
      const trigger = run.current;
      if (trigger) {
        // The middle of the stage's segment: well inside it on both sides.
        scrollTo(trigger.start + (trigger.end - trigger.start) * ((index + 0.5) / count));
        return;
      }
      setActive(index);
    },
    [count, scrollTo],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const keys: Record<string, number> = {
        ArrowRight: active + 1,
        ArrowLeft: active - 1,
        Home: 0,
        End: count - 1,
      };
      const next = keys[event.key];
      if (next === undefined) return;

      event.preventDefault();
      const target = gsap.utils.clamp(0, count - 1, next);
      tabs.current[target]?.focus();
      select(target);
    },
    [active, count, select],
  );

  const current = stages[active];

  return (
    <section ref={scope} id={id} className="cm" aria-labelledby="cm-title">
      <div className="wrap">
        <header className="cm__head">
          <p className="cm__label" data-intro>
            <span className="cm__label-mark" aria-hidden="true" />
            02 · Curriculum map
            <span className="cm__label-sep" aria-hidden="true">
              /
            </span>
            Academic journey
          </p>

          <h2 className="cm__title" id="cm-title">
            Thirteen years,
            <br />
            drawn to <Mark kind="underline">scale.</Mark>
          </h2>

          <div className="cm__intro" data-intro>
            <p>
              The curriculum runs in four progressive stages: three foundation years in
              Pre-Primary, then Primary and Middle School, and the two CBSE board years of
              Secondary. Each stage builds on the one before it.
            </p>
            <p className="cm__intro-meta">Nursery to Class 10 · CBSE from Class 1</p>
          </div>
        </header>
      </div>

      <div className="cm__pin">
        <div className="wrap cm__frame">
          {/* --------------------------------------------------------------
              The stages, as a contents line
              -------------------------------------------------------------- */}
          <nav
            className="cm-nav"
            aria-label="Curriculum stages"
            data-enter
            style={{ '--i': active, '--fill': (active + 1) / count } as CSSProperties}
          >
            {/* The field: a white ribbon with one pale architectural sweep
                running behind all four programmes. Its hairline is the
                reader's progress through the run. */}
            <span className="cm-nav__field" aria-hidden="true">
              <svg viewBox="0 0 1440 240" preserveAspectRatio="none" focusable="false">
                <defs>
                  <linearGradient id="cm-nav-sweep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopOpacity="0.95" />
                    <stop offset="0.55" stopOpacity="0.5" />
                    <stop offset="1" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  className="cm-nav__ribbon"
                  d="M0 40C380 8 1060 4 1440 34V206C1060 238 380 236 0 212Z"
                />
                <g className="cm-nav__sweep">
                  <path
                    className="cm-nav__wave"
                    fill="url(#cm-nav-sweep)"
                    d="M-120 150C200 92 520 84 780 116S1240 170 1560 98V206C1240 226 1000 204 780 196S200 196 -120 212Z"
                  />
                  <path
                    className="cm-nav__track"
                    d="M-120 150C200 92 520 84 780 116S1240 170 1560 98"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    className="cm-nav__fill"
                    d="M-120 150C200 92 520 84 780 116S1240 170 1560 98"
                    pathLength={1}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              </svg>
            </span>

            <div
              ref={list}
              className="cm-nav__list"
              role="tablist"
              aria-label="The four curriculum stages"
              onKeyDown={onKeyDown}
            >
              {stages.map((stage, i) => (
                <button
                  key={stage.id}
                  ref={(node) => {
                    tabs.current[i] = node;
                  }}
                  id={`cm-tab-${stage.id}`}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-controls={`cm-panel-${stage.id}`}
                  tabIndex={i === active ? 0 : -1}
                  className={`cm-tab${i === active ? ' is-active' : ''}${i < active ? ' is-past' : ''}`}
                  data-cursor="link"
                  onClick={() => select(i)}
                >
                  <span className="cm-tab__badge">
                    <span className="cm-tab__num">{stage.number}</span>
                  </span>
                  <span className="cm-tab__text">
                    <span className="cm-tab__title">{stage.title}</span>
                    <span className="cm-tab__range">{stage.range.replace(/\s*-\s*/, ' – ')}</span>
                  </span>
                  <span className="cm-tab__arrow" aria-hidden="true">
                    <svg viewBox="0 0 16 16" focusable="false">
                      <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" />
                    </svg>
                  </span>
                  <span className="cm-tab__arc" aria-hidden="true" />
                </button>
              ))}
            </div>
          </nav>

          <div className="cm__stage">
            {/* --------------------------------------------------------------
                The photographs - one plate per stage, stacked
                -------------------------------------------------------------- */}
            <div className="cm__plates" data-enter>
              {stages.map((stage, i) => (
                <div
                  key={stage.id}
                  className={`cm-plate${i === active ? ' is-current' : ''}`}
                  aria-hidden={i !== active}
                >
                  <figure className="cm-shot cm-shot--main" style={place(stage.layout.image)}>
                    <span className="cm-shot__crop">
                      <img
                        src={resolve(stage.image, 900)}
                        srcSet={resolveSet(stage.image, [600, 900, 1300])}
                        sizes="(max-width: 1023px) 76vw, 36vw"
                        alt={stage.image.alt}
                        loading={i === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        style={stage.image.focus ? { objectPosition: stage.image.focus } : undefined}
                      />
                    </span>
                    <figcaption
                      className={`cm-shot__cap${stage.layout.caption === 'end' ? ' cm-shot__cap--end' : ''}`}
                    >
                      <span className="cm-shot__cap-num">{stage.number}</span>
                      {stage.title} · {stage.range}
                    </figcaption>
                  </figure>

                  <figure
                    className="cm-shot cm-shot--second"
                    style={place(stage.layout.secondary)}
                  >
                    <span className="cm-shot__crop">
                      <img
                        src={resolve(stage.secondaryImage, 600)}
                        srcSet={resolveSet(stage.secondaryImage, [400, 600, 900])}
                        sizes="(max-width: 1023px) 40vw, 20vw"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={
                          stage.secondaryImage.focus
                            ? { objectPosition: stage.secondaryImage.focus }
                            : undefined
                        }
                      />
                    </span>
                  </figure>
                </div>
              ))}
            </div>

            {/* --------------------------------------------------------------
                The copy - one panel per stage, stacked in one grid cell
                -------------------------------------------------------------- */}
            <div className="cm__panels" data-enter>
              <div className="cm__panel-stack">
                {stages.map((stage, i) => (
                  <div
                    key={stage.id}
                    id={`cm-panel-${stage.id}`}
                    role="tabpanel"
                    aria-labelledby={`cm-tab-${stage.id}`}
                    tabIndex={i === active ? 0 : -1}
                    inert={i !== active}
                    className={`cm-panel${i === active ? ' is-current' : ''}`}
                  >
                    <p className="cm-panel__kicker" data-reveal>
                      <span className="cm-panel__num">{stage.number}</span>
                      <span>{stage.range}</span>
                      <span>{stage.ages}</span>
                      <span>{stage.board}</span>
                    </p>

                    <h3 className="cm-panel__title" data-reveal>
                      <span className="cm-panel__stage">{stage.title}</span>
                      {stage.subtitle}
                    </h3>

                    <p className="cm-panel__desc" data-reveal>
                      {stage.description}
                    </p>

                    <dl className="cm-panel__facts" data-reveal>
                      <div>
                        <dt>Subjects</dt>
                        <dd>{stage.subjects}</dd>
                      </div>
                      <div>
                        <dt>Assessment</dt>
                        <dd>{stage.assessment}</dd>
                      </div>
                    </dl>

                    <blockquote className="cm-panel__detail" data-reveal>
                      <p>{stage.detail}</p>
                      <footer>The outcome we look for</footer>
                    </blockquote>
                  </div>
                ))}
              </div>

              <div className="cm__foot">
                <p className="cm-hint" aria-hidden="true">
                  <span className="cm-hint__line" />
                  Scroll to explore
                </p>
                <p className="cm-count" aria-hidden="true">
                  <span className="cm-count__roll">
                    <span className="cm-count__now">{current.number}</span>
                  </span>
                  <span className="cm-count__of">/ {pad(count)}</span>
                </p>
              </div>
            </div>
          </div>

          <p className="sr-only" aria-live="polite">
            Stage {active + 1} of {count}: {current.title}, {current.range}.
          </p>
        </div>
      </div>

      {colophon ? (
        <div className="wrap">
          <p className="cm__colophon">{colophon}</p>
        </div>
      ) : null}
    </section>
  );
}
