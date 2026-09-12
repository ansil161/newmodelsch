import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Photo } from '@/constants/imagery';
import { resolve } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { gsap } from '@/lib/gsap';
import { drift, lines, reduced, rise } from '@/lib/motion';
import { Mark, Sticker } from '@/components/editorial';
import './curriculum.css';

/* ==========================================================================
   THE CURRICULUM, AS A SCHOOL ANNUAL
   --------------------------------------------------------------------------
   Four chapters of a printed publication rather than four tabs of a component.
   A spread: photographs pasted up on the left page, the chapter's curriculum
   set on the right, a folio number bleeding off the outer edge, and somebody's
   handwriting in the margin.

   WHY THE COMPOSITIONS ARE DATA AND NOT FOUR STYLESHEETS

   The brief for this section is that every chapter looks materially different -
   different photographs, different overlaps, different rhythm. Writing that as
   four bespoke layouts is four times the CSS and, worse, four things that drift
   apart the first time anyone edits one of them.

   So a chapter's composition is a list of frames, and each frame carries where
   it sits, how big it is, how far it is rotated, whether it is in colour or has
   been photocopied, what depth it moves at, and whether it is taped down. The
   renderer is one loop. Re-art-directing a chapter is moving numbers, which is
   what art direction should cost.

   THE THREE ROLES A FRAME CAN HAVE

     lead    the photograph the chapter is about. In colour, on top, taped.
             One per chapter, and it is the emotional anchor of the spread.
     behind  a classroom or a corridor, photocopied to grey, sitting under the
             lead and cropped by it.
     scrap   a fragment. Small, hard-cropped, sometimes torn along one edge.

   NOTHING HERE IS A CARD. Frames have paper borders and contact shadows, not
   radii and elevation; the marks between things are registration crosses,
   ticks and tape rather than rules; and the one long horizontal line on the
   whole spread is the one the reader's own scroll draws under the folio.
   ========================================================================== */

type FrameRole = 'lead' | 'behind' | 'scrap';

interface Frame {
  photo: Photo;
  role: FrameRole;
  /** Position and width as a percentage of the plate. */
  x: number;
  y: number;
  w: number;
  /** Degrees. Kept under about 7 - past that it reads as broken, not pasted. */
  rotate: number;
  /** `mono` is the photocopy: grey, a touch contrastier, slightly faded. */
  tone: 'colour' | 'mono';
  /** Total parallax travel in px. The lead moves least, so it reads as nearest. */
  depth: number;
  /** Torn along one edge rather than cut. Scraps only. */
  torn?: boolean;
  tape?: Array<{ at: 'tl' | 'tr' | 'bl' | 'br' | 't'; rotate: number }>;
}

interface Annotation {
  text: string;
  /** Percentages of the plate. */
  x: number;
  y: number;
  rotate: number;
  /** Which way the drawn arrow leaves the handwriting, if it has one. */
  arrow?: 'left' | 'right' | 'down' | 'none';
}

export interface Chapter {
  id: string;
  index: string;
  band: string;
  classes: string;
  ages: string;
  /** The claim the chapter makes, set as the display line on the sheet. */
  focus: ReactNode;
  /** What the stage is actually for, in a paragraph. */
  note: ReactNode;
  subjects: string;
  assessment: string;
  frames: Frame[];
  annotation: Annotation;
}

interface CurriculumChaptersProps {
  chapters: Chapter[];
  /** The blueprint's curriculum disclosure, printed as a colophon. */
  colophon?: ReactNode;
  id?: string;
}

/* --------------------------------------------------------------------------
   The printed marks
   --------------------------------------------------------------------------
   Everything below is drawn rather than typed, and none of it is an icon from
   a set. A registration cross is what a printer puts in the margin to line up
   the plates; a tick is a trim mark. They are here because they are the marks
   this kind of page actually carries.
   -------------------------------------------------------------------------- */

function RegMark({ className = '' }: { className?: string }) {
  return (
    <svg className={`reg ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="6.4" />
      <path d="M12 0v7.2M12 16.8V24M0 12h7.2M16.8 12H24" />
    </svg>
  );
}

/** The drawn arrow that leaves an annotation and points at the photograph. */
function HandArrow({ dir }: { dir: 'left' | 'right' | 'down' }) {
  const path = {
    left: 'M62 8C44 6 24 12 8 26m0 0 12-3m-12 3 5 11',
    right: 'M4 8c18-2 38 4 54 18m0 0-12-3m12 3-5 11',
    down: 'M10 4c14 10 22 24 24 42m0 0 7-10m-7 10-9-8',
  }[dir];

  return (
    <svg
      className={`hand-arrow hand-arrow--${dir}`}
      viewBox={dir === 'down' ? '0 0 48 52' : '0 0 68 40'}
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}

/* ==========================================================================
   The component
   ========================================================================== */

export function CurriculumChapters({ chapters, colophon, id }: CurriculumChaptersProps) {
  const [active, setActive] = useState(0);
  const previous = useRef(0);
  const plates = useRef<(HTMLDivElement | null)[]>([]);
  const sheets = useRef<(HTMLDivElement | null)[]>([]);

  const scope = useGsapScope<HTMLElement>((_, el) => {
    const head = el.querySelector<HTMLElement>('.curric__title');
    if (head) lines(head, { trigger: el });
    rise(el.querySelectorAll<HTMLElement>('[data-lift]'), { trigger: el, delay: 0.3, stagger: 0.06 });

    // Every frame drifts at its own speed, so the paste-up breathes as the
    // reader passes it. The lead moves least, which is what puts it in front.
    el.querySelectorAll<HTMLElement>('.frame').forEach((frame) => {
      drift(frame, Number(frame.dataset.depth ?? 40), { trigger: el });
    });

    if (reduced()) return;
    writeIn(el.querySelector<HTMLElement>('.plate.is-current .hand'), 0.9);
  }, [chapters]);

  /* --------------------------------------------------------------------------
     Turning the page.

     Done imperatively because it is a hand-off between two elements: React
     would have to hold "which one is leaving" in state for the length of an
     animation, and the outgoing page has to keep rendering while it leaves.

     The direction follows the reader. Going forward, the old page leaves to the
     left and the new one comes in from the right; going back, the reverse. It
     is the single thing that makes this feel like paper rather than a fade.
     -------------------------------------------------------------------------- */
  useIsomorphicLayoutEffect(() => {
    const from = previous.current;
    if (from === active) return;

    if (reduced()) {
      previous.current = active;
      return;
    }

    const dir = active > from ? 1 : -1;
    const outPlate = plates.current[from];
    const inPlate = plates.current[active];
    const outSheet = sheets.current[from];
    const inSheet = sheets.current[active];

    const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

    /* The outgoing page is animated with a `fromTo`, not a `to`.
       By the time this runs, React has already moved `.is-current` and the
       stylesheet has already hidden the old plate - so a plain `to` would
       animate from invisible to invisible and the page would simply blink.
       Starting the tween explicitly at `autoAlpha: 1` writes an inline style
       that outranks the class, which is what lets the page leave on screen.
       `clearProps` at the end hands control back to the stylesheet. */
    if (outPlate) {
      tl.fromTo(
        outPlate,
        { autoAlpha: 1, xPercent: 0 },
        {
          xPercent: -7 * dir,
          autoAlpha: 0,
          duration: 0.4,
          ease: 'power2.in',
          clearProps: 'opacity,visibility,transform',
        },
        0,
      );
    }
    if (outSheet) {
      tl.fromTo(
        outSheet,
        { autoAlpha: 1, y: 0 },
        {
          y: -12,
          autoAlpha: 0,
          duration: 0.32,
          ease: 'power2.in',
          clearProps: 'opacity,visibility,transform',
        },
        0,
      );
    }

    if (inPlate) {
      tl.fromTo(
        inPlate,
        { xPercent: 9 * dir, autoAlpha: 0 },
        {
          xPercent: 0,
          autoAlpha: 1,
          duration: 0.78,
          ease: 'power3.out',
          clearProps: 'opacity,visibility,transform',
        },
        0.16,
      );
      // The frames settle a beat after the plate does, each from its own
      // offset, so the paste-up assembles rather than sliding in as one board.
      tl.fromTo(
        inPlate.querySelectorAll('.frame'),
        { yPercent: (i: number) => 4 + i * 2, rotate: (i: number) => (i % 2 ? 2 : -2) },
        {
          yPercent: 0,
          rotate: 0,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.055,
          clearProps: 'rotate,yPercent',
        },
        0.22,
      );
      writeIn(inPlate.querySelector<HTMLElement>('.hand'), 0.62);
    }

    if (inSheet) {
      tl.fromTo(
        inSheet,
        { y: 16, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.62,
          ease: 'power3.out',
          clearProps: 'opacity,visibility,transform',
        },
        0.24,
      );
      tl.fromTo(
        inSheet.querySelectorAll('[data-sheet-item]'),
        { y: 14, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.55, ease: 'power3.out', stagger: 0.06 },
        0.3,
      );
    }

    // The folio rolls over, like a page number changing.
    tl.fromTo(
      '.curric__folio-num',
      { yPercent: 26 * dir, autoAlpha: 0 },
      { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' },
      0.2,
    );

    previous.current = active;
    return () => {
      tl.kill();
    };
  }, [active]);

  const move = (next: number) => {
    const i = ((next % chapters.length) + chapters.length) % chapters.length;
    setActive(i);
    document.getElementById(`ch-tab-${chapters[i].id}`)?.focus();
  };

  const current = chapters[active];

  return (
    <section ref={scope} id={id} className="curric">
      {/* Paper tooth. Static, not animated - this is stock, not film grain. */}
      <span className="curric__tooth" aria-hidden="true" />

      <div className="wrap">
        {/* ---------------------------------------------------------------- */}
        <header className="curric__head">
          <div className="curric__head-tag" data-lift>
            <Sticker tone="sun" tilt={-2.4}>
              02 · Curriculum
            </Sticker>
          </div>

          <h2 className="curric__title ed-hero">
            Thirteen years,
            <br />
            drawn to <Mark kind="underline">scale.</Mark>
          </h2>

          <div className="curric__intro" data-lift>
            <p className="lead">
              A school career is not four equal blocks. It opens with three years that are barely a
              syllabus at all, widens through five that decide everything after them, and closes on
              two that are taught as two years rather than one long revision.
            </p>
            <p className="curric__intro-note">
              Four chapters. Turn through them.
            </p>
          </div>

          <RegMark className="curric__reg curric__reg--head" />
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* The contents line. A tablist underneath, a printed contents page on
            the surface - numerals, names, year ranges and trim ticks, with the
            current chapter marked in ink rather than filled in as a button. */}
        <nav className="curric__contents" aria-label="Curriculum chapters">
          <p className="curric__contents-label" data-lift>
            Contents
          </p>

          <ol
            className="curric__chapters"
            role="tablist"
            aria-label="The four stages"
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                move(active + 1);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                move(active - 1);
              } else if (e.key === 'Home') {
                e.preventDefault();
                move(0);
              } else if (e.key === 'End') {
                e.preventDefault();
                move(chapters.length - 1);
              }
            }}
          >
            {chapters.map((chapter, i) => (
              <li key={chapter.id} data-lift>
                <button
                  id={`ch-tab-${chapter.id}`}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-controls={`ch-panel-${chapter.id}`}
                  tabIndex={i === active ? 0 : -1}
                  className={`chapter${i === active ? ' is-current' : ''}`}
                  onClick={() => move(i)}
                >
                  <span className="chapter__tick" aria-hidden="true" />
                  <span className="chapter__index">{chapter.index}</span>
                  <span className="chapter__band">{chapter.band}</span>
                  <span className="chapter__classes">{chapter.classes}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* ---------------------------------------------------------------- */}
        <div className="curric__spread">
          {/* LEFT PAGE - the paste-up */}
          <div className="curric__plate">
            <RegMark className="curric__reg curric__reg--tl" />
            <RegMark className="curric__reg curric__reg--br" />

            {chapters.map((chapter, i) => (
              <div
                key={chapter.id}
                ref={(node) => {
                  plates.current[i] = node;
                }}
                className={`plate${i === active ? ' is-current' : ''}`}
                aria-hidden={i === active ? undefined : true}
              >
                {chapter.frames.map((frame, f) => (
                  <figure
                    key={`${chapter.id}-${f}`}
                    className={`frame frame--${frame.role}${frame.tone === 'mono' ? ' frame--mono' : ''}${frame.torn ? ' frame--torn' : ''}`}
                    data-depth={frame.depth}
                    style={{
                      left: `${frame.x}%`,
                      top: `${frame.y}%`,
                      width: `${frame.w}%`,
                      // The paste-up rotation lives on a custom property so the
                      // entrance tween can animate `rotate` without wiping it.
                      ['--paste' as string]: `${frame.rotate}deg`,
                      zIndex: frame.role === 'lead' ? 3 : frame.role === 'scrap' ? 2 : 1,
                    }}
                  >
                    <img
                      src={resolve(frame.photo, frame.role === 'lead' ? 900 : 520)}
                      srcSet={`${resolve(frame.photo, 520)} 520w, ${resolve(frame.photo, 900)} 900w, ${resolve(frame.photo, 1400)} 1400w`}
                      sizes={frame.role === 'lead' ? '(max-width: 900px) 70vw, 34vw' : '(max-width: 900px) 40vw, 20vw'}
                      alt=""
                      aria-hidden="true"
                      loading={i === 0 && frame.role === 'lead' ? 'eager' : 'lazy'}
                      decoding="async"
                      style={frame.photo.focus ? { objectPosition: frame.photo.focus } : undefined}
                    />

                    {frame.tape?.map((tape) => (
                      <span
                        key={tape.at}
                        className={`tape tape--${tape.at}`}
                        style={{ ['--tilt' as string]: `${tape.rotate}deg` }}
                        aria-hidden="true"
                      />
                    ))}
                  </figure>
                ))}

                {/* The margin note. Written, not typed. */}
                <p
                  className="hand"
                  style={{
                    left: `${chapter.annotation.x}%`,
                    top: `${chapter.annotation.y}%`,
                    ['--tilt' as string]: `${chapter.annotation.rotate}deg`,
                  }}
                  aria-hidden="true"
                >
                  <span className="hand__ink">{chapter.annotation.text}</span>
                  {chapter.annotation.arrow && chapter.annotation.arrow !== 'none' ? (
                    <HandArrow dir={chapter.annotation.arrow} />
                  ) : null}
                </p>
              </div>
            ))}

            {/* The folio, bleeding off the outer edge. */}
            <p className="curric__folio" aria-hidden="true">
              <span className="curric__folio-num">{current.index}</span>
              <span className="curric__folio-of">of {String(chapters.length).padStart(2, '0')}</span>
            </p>
          </div>

          {/* RIGHT PAGE - the chapter itself */}
          <div className="curric__sheet">
            {chapters.map((chapter, i) => (
              <div
                key={chapter.id}
                id={`ch-panel-${chapter.id}`}
                role="tabpanel"
                aria-labelledby={`ch-tab-${chapter.id}`}
                tabIndex={i === active ? 0 : -1}
                inert={i !== active}
                ref={(node) => {
                  sheets.current[i] = node;
                }}
                className={`sheet${i === active ? ' is-current' : ''}`}
              >
                <p className="sheet__kicker" data-sheet-item>
                  <span className="sheet__num">{chapter.index}</span>
                  {chapter.classes} · {chapter.ages}
                </p>

                <h3 className="sheet__focus ed-h2" data-sheet-item>
                  {chapter.focus}
                </h3>

                <p className="sheet__note" data-sheet-item>
                  {chapter.note}
                </p>

                <dl className="sheet__facts">
                  <div data-sheet-item>
                    <dt>Subjects</dt>
                    <dd>{chapter.subjects}</dd>
                  </div>
                  <div data-sheet-item>
                    <dt>Assessment</dt>
                    <dd>{chapter.assessment}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>

        {/* Announced rather than left to be discovered. */}
        <p className="sr-only" aria-live="polite">
          Chapter {active + 1} of {chapters.length}: {current.band}, {current.classes}.
        </p>

        {colophon ? <p className="curric__colophon">{colophon}</p> : null}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Writing the annotation on.

   A left-to-right clip reveal rather than a fade. It is the cheapest honest
   way to make type look written: the letters appear in the order a hand would
   make them, and the slight overshoot at the end (`-3%`) means the last stroke
   is not clipped flat against the edge of its own box.

   The drawn arrow next to it is a real stroke, so it gets the real treatment -
   its dash offset is run down to zero and it draws itself.
   -------------------------------------------------------------------------- */
function writeIn(hand: HTMLElement | null, delay: number) {
  if (!hand || reduced()) return;

  const ink = hand.querySelector<HTMLElement>('.hand__ink');
  const arrow = hand.querySelector<SVGPathElement>('.hand-arrow path');

  if (ink) {
    gsap.fromTo(
      ink,
      { clipPath: 'inset(0 100% -20% 0)' },
      { clipPath: 'inset(0 -3% -20% 0)', duration: 0.72, ease: 'power2.inOut', delay, overwrite: 'auto' },
    );
  }

  if (arrow) {
    const length = arrow.getTotalLength();
    gsap.fromTo(
      arrow,
      { strokeDasharray: length, strokeDashoffset: length },
      {
        strokeDashoffset: 0,
        duration: 0.6,
        ease: 'power2.inOut',
        delay: delay + 0.42,
        overwrite: 'auto',
      },
    );
  }
}
