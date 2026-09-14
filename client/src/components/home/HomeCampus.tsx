import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants';
import { campusImages, sportsImages, resolve, resolveSet } from '@/constants/imagery';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { Icon } from '@/components/common/Icon';
import './campus.css';

/* ==========================================================================
   CAMPUS - one photograph that becomes three
   --------------------------------------------------------------------------
   The section opens as a single composition: one large plate of the campus,
   offset right, a heading in the space beside it, and nothing else. Under the
   reader's scroll that plate steps back, two more plates come out from behind
   its edges, and the three of them resolve into the columns the section is
   actually about - Learning, Life, Explore - with the closing statement
   arriving in the space the heading has just left.

     ONE PLATE  ->  SPLIT  ->  THREE COLUMNS  ->  THE CAMPUS

   NOTHING ABOUT THE OPENING IS AUTHORED.

   The three columns are real layout - a flex row, spaced on the site's own
   scale, staggered vertically by a couple of viewport percent. That is the
   finished state, it is what the stylesheet describes, and it is what a phone
   and a reader with motion turned off get with no timeline at all.

   The opening is derived from it. `measure()` reads the distance from each
   column to `.hc__slot` - an invisible marker in the stylesheet carrying the
   hero plate's geometry - and the timeline holds the plates there and lets
   them go. There is not one authored offset in this file, which is why the
   section survives a change to the grid, the gutter, the type scale or the
   window without a single number being retuned.

   TWO NESTED TRANSFORMS, WHICH IS WHAT MAKES THE SPLIT ONE MOVEMENT

     .hc-col     the column.  Its place in the row: the spread, and the drift.
     .hc-panel   the plate.   Its place relative to its column: the travel in
                              from the hero slot, and the scale.

   Because they are nested, the two overlap freely: the plates are still
   shrinking while they are already separating, and the eye reads one
   continuous transformation. A single element carrying both would have forced
   them into sequence - "it got smaller, then it split" - because two tweens
   cannot write `x` at the same time.

   THE SPLIT IS OCCLUSION, NOT A MASK.

   Plates one and three start exactly behind plate two, at the same size and
   in the same place, so the opening genuinely is one photograph rather than
   three pretending. They are revealed by travelling out from under it.
   Nothing is clipped and nothing fades up, because a mask opening is an
   effect and a thing coming out from behind another thing is a fact.

   `z-index` therefore matters, and it is set in the stylesheet: the middle
   column is on top. Get it wrong and there are two photographs on screen for
   the first frame.

   THE THREE COLUMNS DO NOT MOVE ALIKE.

   Column one leaves first and takes longest, on an ease that is slow at both
   ends: it reads as the heavy one, furthest away. Column three leaves last
   and arrives first, on an ease that is all deceleration: it reads as the
   light one, nearest. The middle one does not travel at all - it is the plate
   the reader was already looking at, and it stays the anchor of the
   composition. Their photographs then parallax at three different rates for
   the rest of the pin, so the finished layout keeps its depth after the
   movement has stopped.

   WHAT THIS REPLACED

   A deck: six photographs stacked on a giant word, taken off the top one at a
   time. It was a good section and it answered a different question - "what is
   on this campus", six times over. This one answers "what is this campus
   for", three times, and it spends its scroll on one transformation instead
   of six hand-offs.
   ========================================================================== */

interface Chapter {
  id: string;
  index: string;
  title: string;
  body: string;
  photo: Photo;
  /**
   * Percent of the photograph's own height that it travels inside its frame,
   * for the rest of the pin once the columns have formed. Different per
   * column on purpose: this is the depth, and it is the only thing still
   * moving after the transformation is finished.
   */
  drift: number;
}

const CHAPTERS: Chapter[] = [
  {
    id: 'learning',
    index: '01',
    title: 'Learning',
    body: 'Purpose-built spaces designed for curiosity, collaboration and focused learning.',
    photo: campusImages[0],
    drift: 5,
  },
  {
    /* The middle chapter's photograph is also the opening plate, so it has to
       work twice: as the one image the whole section opens on, and as the
       answer to "what is school life like here". A wide daylit frame of the
       school with its forecourt and lawn in it does both - it establishes the
       place, and it is somewhere people are walking through rather than a
       portrait of a facade. */
    id: 'life',
    index: '02',
    title: 'Life',
    body: 'Spaces where friendships, experiences and everyday school life come together.',
    photo: campusImages[7],
    drift: 3,
  },
  {
    id: 'explore',
    index: '03',
    title: 'Explore',
    body: 'Open environments that encourage movement, discovery and confidence.',
    /* The track, and it was chosen against two darker candidates for a reason
       that only shows up at column size. The arena is a close-up of a net in
       shadow and the field is a silhouette shot at dusk; either of them beside
       two daylit plates reads as a black rectangle, and the three stop looking
       like one campus photographed on one morning. */
    photo: sportsImages[1],
    drift: 8,
  },
];

/** The chapter the section opens on, and the one the other two hide behind. */
const ANCHOR = 1;

/** Length of the pin, in viewports. Long enough to be scrubbed rather than
 *  played; short enough that a reader who is not interested is past it. */
const PIN = 2.4;

/* ==========================================================================
   Motion
   ========================================================================== */

/** Everything the timeline needs, and all of it measured. */
interface Frame {
  /** Per column: the offset that stacks it on the anchor column. */
  stack: { x: number; y: number }[];
  /** Shared by all three plates: the travel from the anchor to the hero slot. */
  hero: { x: number; y: number; scale: number };
}

function buildMotion(scope: HTMLElement) {
  const mm = gsap.matchMedia(scope);

  /* --------------------------------------------------------------------------
     The transformation
     --------------------------------------------------------------------------
     The same query the stylesheet asks, in the same words. If the two ever
     disagree the section composes itself for a timeline that was never built,
     and waits.
     -------------------------------------------------------------------------- */
  mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    const slot = scope.querySelector<HTMLElement>('.hc__slot');
    const inner = scope.querySelector<HTMLElement>('.hc__inner');
    const cols = gsap.utils.toArray<HTMLElement>('.hc-col', scope);
    const panels = gsap.utils.toArray<HTMLElement>('.hc-panel', scope);
    if (!slot || !inner || cols.length !== CHAPTERS.length || panels.length !== CHAPTERS.length) {
      return;
    }

    const frame: Frame = { stack: [], hero: { x: 0, y: 0, scale: 1 } };

    /* THE LAYOUT'S GEOMETRY, READ FROM OFFSETS RATHER THAN FROM BOUNDING BOXES.

       `offsetLeft` / `offsetTop` / `offsetWidth` are what the layout put
       there, and no transform changes them - so the plates can be measured
       exactly while the timeline is holding them anywhere at all.

       This replaced a version that cleared every transform, read
       `getBoundingClientRect()`, and relied on the timeline to put the
       transforms back. It did not: a refresh always lands within a second of
       the page loading (the provider's settle timer, the route's, each late
       image), and at the top of the section the timeline has not reached the
       tweens that hold the opening, so nothing re-applied them. The section
       opened already split into three columns, then snapped to the hero plate
       and back behind the anchor as the reader scrolled in.

       Measured relative to `.hc__inner`, the positioned box every plate and
       the slot share, by walking the offset chain up to it. */
    const box = (el: HTMLElement) => {
      let x = 0;
      let y = 0;
      for (let n: HTMLElement | null = el; n && n !== inner; n = n.offsetParent as HTMLElement | null) {
        x += n.offsetLeft;
        y += n.offsetTop;
      }
      return { x, y, w: el.offsetWidth, h: el.offsetHeight };
    };

    const centre = (el: HTMLElement) => {
      const b = box(el);
      return { x: b.x + b.w / 2, y: b.y + b.h / 2, h: b.h };
    };

    /* Measured again on every refresh, so a resize re-derives the journey. */
    const measure = () => {
      /* MEASURED FROM THE PLATES, NOT FROM THE COLUMNS THEY SIT IN.

         The offset is applied to the column, but what has to end up coincident
         is the three photographs - and a column is its plate plus its caption,
         whose height depends on how many lines the description wraps to. Line
         up the columns and the plates sit a dozen pixels apart, which at the
         opening is two photographs showing where there should be one. Line up
         the plates and the columns take care of themselves, because a
         translation on the column moves its plate by exactly as much. */
      const plate = centre(panels[ANCHOR]);
      frame.stack = panels.map((panel) => {
        const c = centre(panel);
        return { x: plate.x - c.x, y: plate.y - c.y };
      });

      /* The slot is centred on its own `left` / `top` by a CSS translate of
         -50%, which offsets do not see - so its centre is simply its offset
         position. */
      const s = box(slot);
      const target = { x: s.x, y: s.y, h: s.h };
      frame.hero = {
        x: target.x - plate.x,
        y: target.y - plate.y,
        /* The slot and the plates share an aspect ratio in the stylesheet, so
           one uniform scale lands the plate on the slot exactly - and a
           photograph that is only ever scaled uniformly is a photograph that
           is never distorted. */
        scale: plate.h ? target.h / plate.h : 1,
      };
    };

    measure();

    /* THE TIMELINE IS ONE UNIT LONG.

       Every position below is therefore a fraction of the reader's journey
       through the pin, which is the thing they actually experience, rather
       than a number of seconds nobody ever sees. */
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: scope,
        start: 'top top',
        end: () => `+=${Math.round(PIN * window.innerHeight)}`,
        pin: true,
        pinSpacing: true,
        /* Not enough for the reader to feel as lag, and enough that a
           trackpad's jitter never reaches the plates. The transformation
           stays welded to the scroll position; it is only smoothed. */
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        /* Fires before the trigger re-measures and before the tweens re-read
           their function-based values - the one moment in a refresh when the
           boxes can be read without a transform on them. */
        onRefreshInit: measure,
      },
    });

    /* EVERY TWEEN BELOW IS A `fromTo`.

       The timeline is invalidated on every refresh, and a plain `to` re-reads
       its starting value the next time it runs - which, after a refresh in
       the middle of the pin, is its finished value. The closing statement
       would then start already set, on top of the heading. Writing both ends
       down makes every state a function of the scroll position alone.

       The closing block's hidden state is therefore set by its own `fromTo`
       (they render their start immediately), not in the stylesheet, which
       keeps the promise the rest of this site makes - that the resting state
       is the finished state, and that a phone, a printer and a failed script
       all get a complete section rather than one waiting to be revealed. */

    /* ---- the heading gives up its place --------------------------------
       It leaves early and it leaves upward, so the corner is empty through
       the middle of the transformation. That emptiness is doing work: it is
       what stops the closing statement reading as a third block of text
       stacked in the same place. */
    tl.fromTo(
      '.hc__intro',
      { yPercent: 0, autoAlpha: 1 },
      { yPercent: -24, autoAlpha: 0, duration: 0.2, ease: 'power2.in' },
      0.04,
    );
    tl.fromTo(
      '.hc__lede',
      { y: 0, autoAlpha: 1 },
      { y: -26, autoAlpha: 0, duration: 0.18, ease: 'power2.in' },
      0.02,
    );

    /* ---- the plate steps back ------------------------------------------
       One tween, written once and applied to all three plates - because at
       this point they are one photograph. Two of them are hidden exactly
       behind the third and have to stay there until the split begins.

       `power2.inOut`: slow at both ends. This is a heavy object being set
       down, not a card being dealt. */
    tl.fromTo(
      panels,
      {
        x: () => frame.hero.x,
        y: () => frame.hero.y,
        scale: () => frame.hero.scale,
      },
      { x: 0, y: 0, scale: 1, duration: 0.44, ease: 'power2.inOut' },
      0.03,
    );

    /* ---- and the photograph inside it settles --------------------------
       Six percent across the whole approach. Enough that the opening frame is
       not a still photograph waiting for a scroll; not enough that anybody
       watching would call it a zoom. */
    tl.fromTo('.hc-frame', { scale: 1.06 }, { scale: 1, duration: 0.52, ease: 'power2.out' }, 0);

    /* ---- the two outer columns come out from behind it -----------------
       Different starts, different lengths, different eases. This is the
       depth, and it is the one place in the section where the three are
       deliberately not treated alike:

         ONE    leaves first, travels longest, eases at both ends. Heavy, and
                furthest away.
         THREE  leaves last, arrives first, all deceleration. Light, and
                nearest.
         TWO    never moves. It is the plate the reader was already looking
                at, and it stays where it is. */
    const spread: ({ at: number; duration: number; ease: string } | null)[] = [
      { at: 0.19, duration: 0.54, ease: 'power2.inOut' },
      null,
      { at: 0.26, duration: 0.4, ease: 'power3.out' },
    ];

    cols.forEach((col, i) => {
      const move = spread[i];
      if (!move) {
        /* The anchor is already where it belongs. Its offset is written
           anyway, so a refresh landing mid-flight cannot leave it holding a
           stale transform from the previous layout. */
        tl.set(col, { x: 0, y: 0 }, 0);
        return;
      }

      tl.fromTo(
        col,
        { x: () => frame.stack[i].x, y: () => frame.stack[i].y },
        { x: 0, y: 0, duration: move.duration, ease: move.ease },
        move.at,
      );
    });

    /* ---- the captions set themselves -----------------------------------
       Column by column, and inside each column line by line. The whole
       gesture is twenty pixels: this is a specimen label arriving beside a
       photograph, and a caption that performs competes with the picture the
       section is about. */
    cols.forEach((col, i) => {
      const lines = col.querySelectorAll<HTMLElement>('[data-cap]');
      if (!lines.length) return;
      tl.fromTo(
        lines,
        { yPercent: 115, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 0.15, stagger: 0.035, ease: 'power2.out' },
        0.5 + i * 0.05,
      );
    });

    /* ---- the depth, once the movement has stopped ----------------------
       Three photographs travelling inside their frames at three different
       rates for the rest of the pin. It is what keeps the finished
       composition from being a still image the reader happens to be holding
       still, and it is the only thing still moving after 0.7. */
    cols.forEach((col, i) => {
      const img = col.querySelector<HTMLElement>('.hc-img');
      if (!img) return;
      const d = CHAPTERS[i].drift;
      tl.fromTo(img, { yPercent: d }, { yPercent: -d, duration: 0.62 }, 0.38);
    });

    /* A last, very small vertical drift on the columns themselves, in three
       directions and at three sizes. Three percent of a column across the last
       quarter of the pin: below the threshold at which a reader could say what
       is happening, above the one at which the composition feels nailed to the
       glass.

       IT STARTS AFTER THE LAST SPREAD HAS LANDED, AND IT IS `yPercent`.

       Both on purpose. The spreads own `y` on these same elements until 0.73,
       and a second tween writing the same property over the top of a running
       one is the one way this timeline could tear. `yPercent` is a separate
       property that GSAP composes into the same transform, and starting at
       0.74 means the two never overlap anyway - belt and braces on the one
       element that carries two motions. */
    [2.4, -3, 4].forEach((drift, i) => {
      tl.fromTo(cols[i], { yPercent: 0 }, { yPercent: drift, duration: 0.26 }, 0.74);
    });

    /* ---- the closing block ---------------------------------------------
       Label, then the statement line by line, then the link. Masked rather
       than faded: the lines set themselves from under their own overflow
       boxes, which is how every other headline on this site arrives. */
    tl.fromTo(
      '.hc__outro .hc__mask > *',
      { yPercent: 110 },
      { yPercent: 0, duration: 0.16, ease: 'power2.out' },
      0.56,
    )
      .fromTo(
        '.hc__outro .hc__line > span',
        { yPercent: 110 },
        { yPercent: 0, duration: 0.22, stagger: 0.07, ease: 'power3.out' },
        0.6,
      )
      .fromTo(
        '.hc__cta',
        { y: 18, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.16, ease: 'power2.out' },
        0.76,
      );

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  });

  /* --------------------------------------------------------------------------
     The column - phones
     --------------------------------------------------------------------------
     No pin, and nothing that takes the scroll away. The same story, told by
     the same three plates in the same order; the scroll drives each one as it
     arrives rather than holding the reader in place while it plays.
     -------------------------------------------------------------------------- */
  mm.add('(max-width: 899px) and (prefers-reduced-motion: no-preference)', () => {
    const cols = gsap.utils.toArray<HTMLElement>('.hc-col', scope);

    cols.forEach((col, i) => {
      const frame = col.querySelector<HTMLElement>('.hc-frame');
      const img = col.querySelector<HTMLElement>('.hc-img');
      const lines = col.querySelectorAll<HTMLElement>('[data-cap]');

      /* The plate is printed rather than faded in - the site's own `unmask`
         gesture, kept local because this one also has to parallax and the two
         must not fight over the same element. */
      if (frame) {
        gsap.from(frame, {
          clipPath: 'inset(100% 0% 0% 0%)',
          duration: 1.15,
          ease: 'power4.inOut',
          scrollTrigger: { trigger: col, start: 'top 82%', once: true },
        });
      }

      if (img) {
        gsap.fromTo(
          img,
          { yPercent: CHAPTERS[i].drift },
          {
            yPercent: -CHAPTERS[i].drift,
            ease: 'none',
            scrollTrigger: { trigger: col, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
          },
        );
      }

      if (lines.length) {
        gsap.from(lines, {
          yPercent: 110,
          autoAlpha: 0,
          duration: 0.75,
          stagger: 0.07,
          ease: 'power2.out',
          scrollTrigger: { trigger: col, start: 'top 68%', once: true },
        });
      }
    });

    const statement = scope.querySelectorAll<HTMLElement>('.hc__outro .hc__line > span');
    if (statement.length) {
      gsap.from(statement, {
        yPercent: 115,
        duration: 1,
        stagger: 0.09,
        ease: 'power4.out',
        scrollTrigger: { trigger: '.hc__outro', start: 'top 84%', once: true },
      });
    }
  });

  return () => mm.revert();
}

/* ==========================================================================
   The section
   --------------------------------------------------------------------------
   THE DOCUMENT ORDER IS THE PHONE'S ORDER: heading, supporting line, the
   three chapters, the closing statement, the link. The desktop grid puts the
   heading and the statement in one cell and the line and the link in another;
   nothing is reordered, and nothing is duplicated for a breakpoint.
   ========================================================================== */

export function HomeCampus() {
  const scope = useGsapScope<HTMLElement>((_, el) => buildMotion(el), []);

  return (
    <section ref={scope} className="section hc" id="campus">
      <div className="hc__stage">
        <div className="wrap hc__inner">
          {/* The opening plate's geometry, and nothing else. Never drawn: the
              module measures it and moves the three plates onto it. */}
          <span className="hc__slot" aria-hidden="true" />

          <div className="hc__intro">
            <p className="hc__eyebrow">The campus</p>
            <h2 className="hc__head">
              <span className="hc__line">
                <span>Campus.</span>
              </span>
              <span className="hc__line">
                <span>Space to grow.</span>
              </span>
            </h2>
          </div>

          <p className="hc__lede">
            Four acres, one campus, and no corridor that is a dead end.
          </p>

          {/* THE THREE COLUMNS.

              In the document in reading order, complete, and never removed, so
              the section is legible in full to somebody who never sees a frame
              of it move.

              FOUR LAYERS, EACH OWNING DIFFERENT PROPERTIES, WHICH IS WHY
              NOTHING HERE NEEDS `overwrite`:
                .hc-col     the spread and the drift.   x / y
                .hc-panel   the travel and the scale.   x / y / scale
                .hc-frame   the settle.                 scale
                .hc-img     the parallax.               yPercent            */}
          <ol className="hc-cols">
            {CHAPTERS.map((chapter, i) => (
              <li className="hc-col" key={chapter.id}>
                <div className="hc-col__media">
                  <div className="hc-panel">
                    <figure className="hc-frame">
                      <img
                        className="hc-img"
                        src={resolve(chapter.photo, 900)}
                        srcSet={resolveSet(chapter.photo, [480, 900, 1400])}
                        sizes="(max-width: 899px) 88vw, 28vw"
                        alt={chapter.photo.alt}
                        loading={i === ANCHOR ? 'eager' : 'lazy'}
                        decoding="async"
                        style={
                          chapter.photo.focus ? { objectPosition: chapter.photo.focus } : undefined
                        }
                      />
                    </figure>
                  </div>
                </div>

                <div className="hc-cap">
                  <span className="hc-cap__mask">
                    <span className="hc-cap__head" data-cap>
                      <span className="hc-cap__num">{chapter.index}</span>
                      <span className="hc-cap__rule" aria-hidden="true" />
                    </span>
                  </span>

                  <span className="hc-cap__mask">
                    <h3 className="hc-cap__title" data-cap>
                      {chapter.title}
                    </h3>
                  </span>

                  <span className="hc-cap__mask">
                    <p className="hc-cap__body" data-cap>
                      {chapter.body}
                    </p>
                  </span>
                </div>
              </li>
            ))}
          </ol>

          <div className="hc__outro">
            <p className="hc__label">
              <span className="hc__mask">
                <span>
                  Campus <b>/ 03</b>
                </span>
              </span>
            </p>
            <p className="hc__statement">
              <span className="hc__line">
                <span>More than a place to learn.</span>
              </span>
              <span className="hc__line">
                <span>A place to become.</span>
              </span>
            </p>
          </div>

          <Link className="hc__cta" to={ROUTES.studentLife}>
            Explore campus
            <i aria-hidden="true">
              <Icon name="arrowRight" size={16} />
            </i>
          </Link>
        </div>
      </div>
    </section>
  );
}
