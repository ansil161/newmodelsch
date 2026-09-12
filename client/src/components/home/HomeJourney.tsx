import { JOURNEY_NODES } from '@/constants';
import { academicImages, resolve, resolveSet, studentImages } from '@/constants/imagery';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import './journey.css';

/* ==========================================================================
   07 - THE STUDENT JOURNEY
   --------------------------------------------------------------------------
   Thirteen years as five sheets of paper, fed past a statement that does not
   move.

   THE COMPOSITION IS TWO THINGS THAT BEHAVE DIFFERENTLY

     LEFT   the claim. It is set once, it is the largest thing on the screen,
            and for the whole length of the pin it does not move at all. It
            is the fixed point the sequence is measured against.
     RIGHT  the sheets. Each one rises from below the frame, comes to rest in
            the middle of the right column, and is pushed up out of the top
            by the one behind it.

   WHY THE STACKING ORDER IS FORWARDS HERE, AND BACKWARDS ON THE CAMPUS DECK

   Two sections on this site move cards and they stack in opposite
   directions, which looks like an inconsistency and is not.

   The campus section is a DECK: cards are taken off the top, so the one
   leaving has to pass in FRONT of the one it uncovers, and `z-index` runs
   backwards.

   This is a FEED: sheets are pushed through from behind, so the one arriving
   has to pass in FRONT of the one it displaces, and `z-index` runs forwards.
   The outgoing sheet slips behind its successor and out of the top, which is
   what "one thing replacing another" looks like when it is paper rather than
   pixels.

   THE FOUR THINGS THE SCROLL DRIVES

     1. the sheet   yPercent from below the frame, to rest, to above it
     2. the weight  scale 0.96 into rest and 0.94 out of it, and a partial
                    fade on the way out only
     3. the plate   the photograph behind each sheet, travelling at a
                    slightly different rate, which is the whole of the depth
                    in this section
     4. the left    nothing. It is the fixed point.
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

/* --------------------------------------------------------------------------
   Travel
   --------------------------------------------------------------------------
   Percentages of the sheet's own height, so the composition survives any
   change to the card size without a number in here moving.

   `IN` is far enough below the frame that a sheet is genuinely off-screen
   before it starts, and `OUT` far enough above it that it is genuinely gone
   after - the sheet is about three-quarters of the viewport, so a hundred
   and ten percent of its own height clears the frame in both directions.
   -------------------------------------------------------------------------- */
const IN = 112;
const OUT = -118;

/** Beats of pin left after the last sheet lands. */
const TAIL = 0.6;

/** Scroll per beat, as a fraction of the viewport. One screen per stage. */
const BEAT = 1;

/* ==========================================================================
   Motion
   ========================================================================== */

function buildMotion(scope: HTMLElement) {
  const mm = gsap.matchMedia(scope);

  mm.add(
    {
      // The same question the stylesheet asks, in the same words. If the two
      // ever disagree the section composes itself and then waits for a
      // timeline that was never built.
      feed: '(min-width: 900px) and (prefers-reduced-motion: no-preference)',
    },
    (context) => {
      if (!(context.conditions as Record<string, boolean>).feed) return;

      const sheets = gsap.utils.toArray<HTMLElement>('.jr-card', scope);
      if (sheets.length !== COUNT) return;

      const beats = COUNT - 1 + TAIL;

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: scope,
          start: 'top top',
          end: `+=${Math.round(beats * BEAT * window.innerHeight)}`,
          // The section, not a descendant. Pinning a child works only while
          // nothing between it and the viewport establishes a containing
          // block for a fixed element - a condition a stylesheet can quietly
          // break later. See the note at the top of `journey.css`.
          pin: true,
          pinSpacing: true,
          scrub: 1,
        },
      });

      sheets.forEach((sheet, i) => {
        const plate = sheet.querySelector<HTMLElement>('.jr-card__plate');

        // The resting state is the finished state: the first sheet is already
        // where it belongs when the reader arrives, and the rest are waiting
        // below the frame.
        if (i === 0) {
          gsap.set(sheet, { yPercent: 0, scale: 1, opacity: 1 });
        } else {
          gsap.set(sheet, { yPercent: IN, scale: 0.96, opacity: 0 });

          /* Arriving. `power2.out` so the sheet covers most of its distance
             early and then settles, rather than sliding in at a constant
             rate - paper fed past a roller decelerates into place. */
          tl.fromTo(
            sheet,
            { yPercent: IN, scale: 0.96 },
            { yPercent: 0, scale: 1, duration: 1, ease: 'power2.out' },
            i - 1,
          );

          /* THE OPACITY IS ITS OWN TWEEN, AND IT FINISHES EARLY.

             Faded across the whole arrival, the incoming sheet is still
             translucent at the moment it crosses the one it is replacing -
             so the outgoing statement reads straight through the incoming
             one and two sentences are legible at once, which is the exact
             muddle this movement exists to avoid.

             A quarter of a beat, which is comfortably before the two sheets
             meet: the arrival eases out, so at a quarter of the way through
             the incoming sheet has only climbed to about a third of the
             frame and is barely touching its predecessor. By the time they
             genuinely overlap it is solid paper and simply covers the
             other. */
          tl.fromTo(
            sheet,
            { opacity: 0 },
            { opacity: 1, duration: 0.25, ease: 'power2.out' },
            i - 1,
          );
        }

        /* Leaving. Up, a little smaller, and only partly faded - it is
           passing behind the sheet that replaced it, not dissolving, and a
           sheet that fades to nothing while still on screen reads as a
           crossfade. The last stage never leaves; it is what the section
           comes to rest on. */
        if (i < COUNT - 1) {
          tl.to(
            sheet,
            { yPercent: OUT, scale: 0.94, opacity: 0.34, duration: 1, ease: 'power2.in' },
            i,
          );
        }

        /* The plate travels at its own rate.

           This is the only depth cue in the section and it is deliberately
           small: eight percent of the sheet's travel, which at this size is
           about thirty pixels over a whole screen of scroll. Enough that the
           photograph and the sheet are visibly two objects rather than one
           printed panel; not enough that anyone can point at it. */
        if (plate) {
          const from = Math.max(i - 1, 0);
          tl.fromTo(
            plate,
            { yPercent: 8 },
            { yPercent: -8, duration: i + 1 - from },
            from,
          );
        }
      });

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    },
  );

  return () => mm.revert();
}

/* ==========================================================================
   The section
   ========================================================================== */

export function HomeJourney() {
  const scope = useGsapScope<HTMLElement>((_, el) => buildMotion(el), []);

  return (
    <section ref={scope} className="section jr" id="journey">
      <div className="jr__stage">
        <div className="wrap jr__inner">
          {/* THE FIXED POINT. Nothing in here is animated by the timeline. */}
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
          </div>

          {/* THE FEED.
              Every stage is in the document in reading order and stays in the
              accessibility tree throughout - a stage waiting below the frame
              is transparent, never removed - so the section is readable in
              full by someone who never sees a frame of it move.

              THREE LAYERS, EACH OWNING DIFFERENT PROPERTIES, WHICH IS WHY
              NOTHING HERE NEEDS `overwrite`:
                .jr-card         the travel.   yPercent / scale / opacity
                .jr-card__plate  the parallax. yPercent
                .jr-card__sheet  nothing. It is the paper. */}
          <ol className="jr__deck">
            {STAGES.map((stage, i) => (
              <li
                className="jr-card"
                key={stage.id}
                // Forwards, so an arriving sheet passes in front of the one
                // it displaces. See the note at the top of this file.
                style={{ zIndex: i + 1 }}
              >
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
                  <p className="jr-card__no">{stage.index}</p>
                  <p className="jr-card__say">{stage.statement}</p>
                  <p className="jr-card__cat">{stage.category}</p>
                  <p className="jr-card__when">{stage.span}</p>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
