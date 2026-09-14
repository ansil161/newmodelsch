import { useRef, useState } from 'react';
import type { RefObject } from 'react';
import { JOURNEY_NODES } from '@/constants';
import { academicImages, resolve, resolveSet, studentImages } from '@/constants/imagery';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { rise } from '@/lib/motion';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import './journey.css';

/* ==========================================================================
   07 - THE STUDENT JOURNEY
   --------------------------------------------------------------------------
   Thirteen years as five sheets of paper, fed past a statement that does not
   move.

     LEFT   the claim. Set once, the largest thing on the screen, and still
            for the whole length of the pin. Under it, a five-step indicator.
     RIGHT  the stack. One sheet on top with its photograph, the next two
            showing as ledges beneath it, the ones already read lifted away.

   ONE STAGE AT A TIME

   The earlier version scrubbed every sheet on its own overlapping tweens, so
   mid-scroll two sheets sat in the same place half-transparent and their
   sentences printed through each other. Now the scroll does not move the
   sheets at all. It chooses a STAGE, and a change of stage plays one
   timeline, always in the same order:

     1. the old words leave            opacity 0, y -12       0.30s
     2. the sheets change places       the stack moves        0.80s
     3. the new photograph arrives
     4. the new words arrive           opacity 0 -> 1, y 12   0.45s

   Only the top sheet ever has visible words. Every other sheet is a shell -
   paper, rule and shadow - so the sheets can overlap freely while no two
   sentences can.

   THE LOCK

   While a change is playing, the scroll can keep asking for stages; the
   latest request is remembered and nothing else happens. When the timeline
   finishes it goes straight to that stage - never through the ones in
   between - so a fast scroll is one clean change rather than five flashes.

   BELOW 900px, OR UNDER REDUCED MOTION

   No pin and no stack. Five stages down the page, each its photograph with
   its sheet laid across the foot of it; on a phone the words rise in gently
   as each sheet reaches the screen.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Content
   --------------------------------------------------------------------------
   The five stages are the school's own and live in `constants`. The sentence
   on each sheet is the stage's `statement`; `label` becomes the category in
   the corner and `stage` the span of years beside it.

   The photographs are paired here rather than taken from the node's own
   `image` field, which is a bare URL from the legacy helper and carries no
   crop focus, no srcset and no reserved ratio. `imagery.ts` is where a
   photograph is named on this site.
   -------------------------------------------------------------------------- */

const PLATES: Photo[] = [
  studentImages[0], // admissions   arriving at the gate
  studentImages[2], // foundation   a young student in class
  academicImages[2], // exploration  hands, tools and a drawing
  studentImages[3], // leadership   older students together over books
  studentImages[5], // excellence   the end of Class 10
];

interface Stage {
  id: string;
  index: string;
  statement: string;
  category: string;
  span: string;
  photo: Photo;
}

const STAGES: Stage[] = JOURNEY_NODES.map((node, i) => ({
  id: node.id,
  index: String(i + 1).padStart(2, '0'),
  statement: node.statement,
  category: node.label,
  span: node.stage,
  photo: PLATES[i] ?? studentImages[0],
}));

const COUNT = STAGES.length;

/** The same questions the stylesheet asks, in the same words. */
const FEED = '(min-width: 900px) and (prefers-reduced-motion: no-preference)';
const COLUMN = '(max-width: 899px) and (prefers-reduced-motion: no-preference)';

/** Screen-heights of scroll per stage while the section is held. */
const BEAT = 0.85;

/* --------------------------------------------------------------------------
   The stack
   --------------------------------------------------------------------------
   Where a sheet rests, by its distance from the top of the stack. Percentages
   of the sheet's own height, scaled from its foot, so the sheets underneath
   show as ledges below the one on top however large the sheet is drawn.

   A sheet already read is lifted up and away and sits ABOVE the stack while
   it goes, so on the way forward the top sheet is taken off the pile, and on
   the way back it is laid down onto it.
   -------------------------------------------------------------------------- */
interface Pose {
  yPercent: number;
  scale: number;
  autoAlpha: number;
  zIndex: number;
}

function pose(offset: number): Pose {
  if (offset < 0) return { yPercent: -14, scale: 0.97, autoAlpha: 0, zIndex: 50 };
  if (offset === 0) return { yPercent: 0, scale: 1, autoAlpha: 1, zIndex: 40 };
  if (offset === 1) return { yPercent: 6, scale: 0.94, autoAlpha: 0.8, zIndex: 30 };
  if (offset === 2) return { yPercent: 11, scale: 0.88, autoAlpha: 0.4, zIndex: 20 };
  return { yPercent: 15, scale: 0.84, autoAlpha: 0, zIndex: 10 };
}

/* ==========================================================================
   Motion
   ========================================================================== */

function buildMotion(
  scope: HTMLElement,
  onStage: (index: number) => void,
  run: RefObject<ScrollTrigger | null>,
) {
  const mm = gsap.matchMedia(scope);

  mm.add(FEED, () => {
    const cards = gsap.utils.toArray<HTMLElement>('.jr-card', scope);
    if (cards.length !== COUNT) return;

    const plates = cards.map((card) => card.querySelector<HTMLElement>('.jr-card__plate'));
    const copy = cards.map((card) => card.querySelectorAll<HTMLElement>('[data-jr-copy]'));

    /** The stage the stack is resting on, or travelling to. */
    let shown = 0;
    /** The stage the scroll is asking for. */
    let wanted = 0;
    let travelling: gsap.core.Timeline | null = null;

    /* Put the stack straight onto a stage, with nothing moving. */
    const place = (index: number) => {
      cards.forEach((card, i) => {
        const on = i === index;
        gsap.set(card, pose(i - index));
        const plate = plates[i];
        if (plate) gsap.set(plate, { autoAlpha: on ? 1 : 0, yPercent: 0 });
        gsap.set(copy[i], { autoAlpha: on ? 1 : 0, y: 0 });
      });
      shown = index;
      wanted = index;
      onStage(index);
    };

    /* One change of stage, as one timeline. */
    const travel = (to: number) => {
      const from = shown;
      if (from === to) return;

      const dir = to > from ? 1 : -1;
      shown = to;
      onStage(to);

      const tl = gsap.timeline({
        onComplete: () => {
          travelling = null;
          if (wanted !== shown) travel(wanted);
        },
      });
      travelling = tl;

      // 1. The old words leave, before anything else moves.
      tl.to(
        copy[from],
        { autoAlpha: 0, y: -12 * dir, duration: 0.3, ease: 'power2.in', stagger: 0.03 },
        0,
      );

      const oldPlate = plates[from];
      if (oldPlate) {
        tl.to(oldPlate, { autoAlpha: 0, duration: 0.4, ease: 'power2.out' }, 0.12);
      }

      // 2. The sheets change places. Stacking order changes at once, so a
      //    sheet lifted off (forward) or laid back on (backward) is in front
      //    of the one it passes for the whole of its travel.
      cards.forEach((card, i) => {
        const { zIndex, ...rest } = pose(i - to);
        tl.set(card, { zIndex }, 0);
        tl.to(card, { ...rest, duration: 0.72, ease: 'power3.inOut' }, 0.18);
      });

      // 3. The new photograph settles in behind the arriving sheet.
      const newPlate = plates[to];
      if (newPlate) {
        tl.fromTo(
          newPlate,
          { autoAlpha: 0, yPercent: 5 * dir },
          { autoAlpha: 1, yPercent: 0, duration: 0.75, ease: 'power3.out' },
          0.4,
        );
      }

      // 4. The new words arrive once their sheet has all but landed.
      tl.fromTo(
        copy[to],
        { autoAlpha: 0, y: 12 * dir },
        { autoAlpha: 1, y: 0, duration: 0.42, ease: 'power3.out', stagger: 0.05 },
        0.6,
      );
    };

    /* Every request goes through here. A running change is never interrupted
       or stacked on; the latest request waits for it to finish. */
    const request = (index: number) => {
      wanted = index;
      if (!travelling) travel(index);
    };

    const stageAt = (progress: number) =>
      gsap.utils.clamp(0, COUNT - 1, Math.floor(progress * COUNT));

    place(0);

    const trigger = ScrollTrigger.create({
      trigger: scope,
      start: 'top top',
      end: () => `+=${Math.round(window.innerHeight * BEAT * COUNT)}`,
      // The section, not a descendant. See the note at the top of `journey.css`.
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => request(stageAt(self.progress)),
    });

    run.current = trigger;

    // Arriving mid-section - a reload, a back button - lands on the right
    // stage without playing the ones before it.
    const start = stageAt(trigger.progress);
    if (start !== 0) place(start);

    return () => {
      travelling?.kill();
      travelling = null;
      run.current = null;
      // Changes of stage run outside the setup, so the context cannot revert
      // them. Hand the column layout clean elements.
      [...cards, ...plates, ...copy.flatMap((list) => [...list])].forEach((el) =>
        el?.removeAttribute('style'),
      );
      onStage(0);
    };
  });

  // A phone: nothing held, the words on each sheet rise in as it arrives.
  mm.add(COLUMN, () => {
    gsap.utils.toArray<HTMLElement>('.jr-card__sheet', scope).forEach((sheet) => {
      rise(sheet.querySelectorAll('[data-jr-copy]'), {
        trigger: sheet,
        start: 'top 88%',
        y: 12,
        stagger: 0.05,
      });
    });
  });

  return () => mm.revert();
}

/* ==========================================================================
   The section
   ========================================================================== */

export function HomeJourney() {
  const [active, setActive] = useState(0);
  const run = useRef<ScrollTrigger | null>(null);
  const { scrollTo } = useSmoothScroll();

  const scope = useGsapScope<HTMLElement>((_, el) => buildMotion(el, setActive, run), []);

  /* A step asks for the middle of its stage's stretch of scroll, so the
     press and the wheel drive the same run and cannot disagree. */
  const goTo = (index: number) => {
    const trigger = run.current;
    if (!trigger) return;
    scrollTo(trigger.start + (trigger.end - trigger.start) * ((index + 0.5) / COUNT));
  };

  const current = STAGES[active];

  return (
    <section ref={scope} className="section jr" id="journey">
      <div className="jr__stage">
        <div className="wrap jr__inner">
          {/* THE FIXED POINT. Nothing in here moves with the stack. */}
          <div className="jr__say">
            <p className="jr__eyebrow">Student journey</p>

            <h2 className="jr__title">
              One child, thirteen years, and the same line drawn all the way
              through.
            </h2>

            <p className="jr__lead">
              A student does not restart at Class 6. The five stages beside this are annotations on
              one continuous education, which is the argument the whole school is built on.
            </p>

            <p className="jr__span">Nursery — Class 10</p>

            {/* Where the reader is. Only drawn while the stack is. */}
            <nav className="jr-steps" aria-label="Journey stages">
              <ol className="jr-steps__list">
                {STAGES.map((stage, i) => (
                  <li key={stage.id}>
                    <button
                      type="button"
                      className={`jr-step${i === active ? ' is-active' : ''}${i < active ? ' is-past' : ''}`}
                      aria-current={i === active ? 'step' : undefined}
                      data-cursor="link"
                      onClick={() => goTo(i)}
                    >
                      <span className="jr-step__bar" aria-hidden="true" />
                      <span className="jr-step__no">{stage.index}</span>
                      <span className="sr-only">{stage.category}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <p className="sr-only" aria-live="polite">
                Stage {active + 1} of {COUNT}: {current.category}, {current.span}.
              </p>
            </nav>
          </div>

          {/* THE STACK.
              Every stage is in the document in reading order and stays in the
              accessibility tree throughout, so the section reads in full for
              someone who never sees it move.

              THREE LAYERS, EACH OWNING DIFFERENT PROPERTIES:
                .jr-card          the stack.      yPercent / scale / opacity / z
                .jr-card__plate   the photograph. opacity / yPercent
                [data-jr-copy]    the words.      opacity / y */}
          <ol className="jr__deck">
            {STAGES.map((stage, i) => (
              <li className={`jr-card${i === active ? ' is-active' : ''}`} key={stage.id}>
                <figure className="jr-card__plate">
                  <img
                    src={resolve(stage.photo, 720)}
                    srcSet={resolveSet(stage.photo, [420, 720, 1100])}
                    sizes="(max-width: 899px) 70vw, 30vw"
                    alt={stage.photo.alt}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    style={stage.photo.focus ? { objectPosition: stage.photo.focus } : undefined}
                  />
                </figure>

                <article className="jr-card__sheet">
                  <span className="jr-card__rule" aria-hidden="true" />
                  <p className="jr-card__no" data-jr-copy>
                    {stage.index}
                  </p>
                  <p className="jr-card__say" data-jr-copy>
                    {stage.statement}
                  </p>
                  <p className="jr-card__cat" data-jr-copy>
                    {stage.category}
                  </p>
                  <p className="jr-card__when" data-jr-copy>
                    {stage.span}
                  </p>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
