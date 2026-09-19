import { DAY_BLOCKS } from '@/constants';
import { academicImages, campusImages, studentImages } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { drift, grow, lines, rise } from '@/lib/motion';
import { Figure, Mark, Sticker } from '@/components/editorial';
import './day.css';

/* ==========================================================================
   01 - A DAY AT SCHOOL
   --------------------------------------------------------------------------
   Nine hours of a real timetable, read the way a printed page is read: from
   the top, at the reader's own pace, with nothing held back until they have
   scrolled far enough to earn it.

   WHAT THIS REPLACED, AND WHY

   This section used to pin the viewport and scrub a nine-step composition -
   a curved SVG path, a travelling node, a photograph deck and a caption that
   turned over. It was the most machinery on the site and it bought the least:
   a parent who wanted to know when lunch is had to scroll six screens to be
   told, could not skim, could not use find-in-page usefully, and on a phone
   got a different layout entirely because none of it survives a touch device.

   The replacement is the reference composition: a time on the left, a card on
   the right, a brushed stroke between them, and the photograph breaking out
   of the card's edge. It reads at a glance and it reads on a phone, and every
   piece of movement in it is something the reader is already doing.

   THE FOUR THINGS THAT MOVE, ALL OF THEM SMALL

     1. the head    the site's standard headline entrance, once
     2. the row     time and card come up together as the row arrives
     3. the stroke  the brush between two hours is drawn by the reader's own
                    scroll, not played at them
     4. the frame   a few pixels of parallax inside the photograph, so the
                    card feels like paper with a print laid on it rather than
                    one flat rectangle

   Nothing pins. Nothing captures the scroll. Nothing is hidden in CSS: with
   JavaScript off, the section is the finished nine rows.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Content
   --------------------------------------------------------------------------
   The nine blocks are the school's real timetable and live in `constants`,
   where the school edits them. Everything added here is presentation.

   Photographs are paired by what is actually IN the frame, checked one by
   one, rather than by the alt text in `imagery.js` - several entries there
   describe a subject the file does not show, and two of them (the old 07:45
   and 08:15) are the same photograph under two different descriptions. The
   pinned deck could hide that because it never had two hours on screen at
   once. A column of nine cards cannot: a repeat four inches from its twin is
   the first thing a reader sees.
   -------------------------------------------------------------------------- */

const EVENT_PHOTOS = [
  studentImages[0], // 07:45  a crowd of students coming in together
  studentImages[4], // 08:15  the hall, seated, someone at the front
  academicImages[0], // 08:30  a teaching room mid-lesson
  studentImages[1], // 10:45  a student turned away from their work
  academicImages[2], // 11:05  hands, tools and a drawing on the bench
  studentImages[3], // 12:40  students together over books, not at desks
  studentImages[2], // 13:20  a student in class in the afternoon
  campusImages[6], // 15:00  the music wing
  campusImages[7], // 16:30  the building from the front courtyard
];

/**
 * Where each part of the day starts, by index into the timetable.
 *
 * Three quiet labels, printed once each, in the left column above the hour
 * that opens the period. They are not a progress indicator and nothing
 * updates them - the reference has no such device, and a day that is already
 * written down in order does not need one. They exist because nine rows in a
 * column want somewhere to breathe, and "Midday" is a better rest than a gap.
 */
const PERIOD_AT = {
  0: 'Morning',
  4: 'Midday',
  6: 'Afternoon',
};

/**
 * The hour the day actually ends, which is not the hour of the last block.
 * Departure is staggered from 16:30 and the copy says teams and rehearsals run
 * until six, so the final pill closes there rather than on itself.
 */
const DAY_ENDS = '18:00';

const EVENTS = DAY_BLOCKS.map((block, i) => ({
  id: `day-${block.time.replace(':', '')}`,
  from: block.time,
  // Each hour is shown as the span it occupies - the reference prints ranges,
  // and a range is the honest unit: nothing on a timetable happens at an
  // instant. The end of one block is the start of the next by construction,
  // so the two can never drift apart when the school edits the timetable.
  to: DAY_BLOCKS[i + 1]?.time ?? DAY_ENDS,
  title: block.title,
  body: block.description,
  photo: EVENT_PHOTOS[i] ?? studentImages[0],
  period: PERIOD_AT[i],
}));

/* --------------------------------------------------------------------------
   The brush stroke
   --------------------------------------------------------------------------
   Three paths, not one. The reference's connector is a dry brush loaded at
   the top and running out toward the bottom: two broken strokes side by side
   where the bristles are still wet, narrowing to a single hairline that
   tapers away before it reaches the next hour. A single round-capped stroke
   cannot do that - it is uniform by definition, and uniform is what makes a
   connector read as a border rather than as a mark someone made.

   So: a heavy stroke that stops early, a lighter one offset a couple of
   pixels that runs further, and a hairline tail that carries on alone. The
   erosion filter breaks all three edges; the different lengths do the taper.

   The stroke deliberately does NOT reach the next pill. It is a mark, not a
   rail, and a line that touches both ends is a table border.
   -------------------------------------------------------------------------- */
const THREAD = [
  { d: 'M 15.4 2 C 14.2 34, 16.4 62, 15 98', w: 7, o: 0.95 },
  { d: 'M 10.2 7 C 9.2 42, 11.4 80, 10.6 128', w: 4.6, o: 0.66 },
  { d: 'M 13.2 66 C 12.6 104, 14 140, 13.3 185', w: 1.6, o: 0.5 },
];

function Thread() {
  return (
    <svg
      className="day-thread"
      viewBox="0 0 26 190"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g filter="url(#day-chalk)">
        {THREAD.map((stroke) => (
          <path
            className="day-thread__stroke"
            d={stroke.d}
            key={stroke.d}
            strokeWidth={stroke.w}
            style={{ opacity: stroke.o }}
          />
        ))}
      </g>
    </svg>
  );
}

/* --------------------------------------------------------------------------
   The two crops
   --------------------------------------------------------------------------
   The reference masks its photography into a soft many-lobed cloud - the one
   shape in the whole composition that is not a rectangle, which is exactly
   why it carries the warmth. The kit's `blob` is a squircle and cannot do it,
   so this is a real clip path.

   Written as five lobes on a circle: peaks at every 72 degrees touching the
   edge of the box, valleys between them at 0.43 of the radius, each lobe a
   quadratic whose control point is placed so the curve's apex lands exactly
   on the peak rather than short of it. That last part is the whole trick - a
   quadratic drawn to its peak as a control point only reaches halfway there,
   which is how a flower ends up an oval.

   The valley depth is the only number here worth arguing about. At 0.365 the
   lobes are deep and the shape reads as a star; at 0.43 they are shallow
   enough that the eye joins them into one soft mass and the photograph looks
   like it was torn out rather than cut with pinking shears.

   Two of them, because nine identical crops down a column read as a stamp.
   The second is the same geometry turned 34 degrees, so the lobes fall
   somewhere else without inventing a second shape.

   `objectBoundingBox` units mean the path is written once for any size. The
   figures are square by construction (`ratio="square-ar"`), so the rotation
   in the second crop cannot shear.
   -------------------------------------------------------------------------- */
const CLOUD =
  'M 0.7528 0.1521 Q 0.5 -0.1521 0.2473 0.1521 Q -0.1202 0.2985 0.0910 0.6329 ' +
  'Q 0.1167 1.0276 0.5 0.93 Q 0.8833 1.0276 0.9090 0.6329 Q 1.1202 0.2985 0.7528 0.1521 Z';

function DayDefs() {
  return (
    <svg className="day__defs" aria-hidden="true" focusable="false">
      <defs>
        {/* The dry brush. Fractal noise displacing the stroke's own edge.

            Both numbers are lower than the obvious first guess, for the same
            reason: a displacement large relative to the stroke does not
            roughen the stroke, it destroys it, and what comes out the other
            side is a speckle rather than a mark. `scale` stays well under
            half the heaviest stroke width so the body survives and only the
            edge breaks, and the noise is stretched hard along y - low
            frequency vertically, higher horizontally - so the break reads as
            bristles dragged down the mark rather than as static.

            Static filter, no animation: the browser rasterises each once. */}
        <filter id="day-chalk" x="-40%" y="-8%" width="180%" height="116%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.62 0.13"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="3.4"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <clipPath id="day-cloud-a" clipPathUnits="objectBoundingBox">
          <path d={CLOUD} />
        </clipPath>
        <clipPath id="day-cloud-b" clipPathUnits="objectBoundingBox">
          <path d={CLOUD} transform="rotate(34 0.5 0.5)" />
        </clipPath>
      </defs>
    </svg>
  );
}

/* ==========================================================================
   The section
   ========================================================================== */

export function SlDay() {
  const scope = useGsapScope((_, el) => {
    const head = el.querySelector('.day__title');
    if (head) lines(head, { trigger: el, stagger: 0.09 });
    rise(el.querySelectorAll('[data-intro]'), { trigger: el, y: 18, delay: 0.3 });

    /* Per row rather than per section. One trigger over nine rows would have
       to start when the first arrives and end when the last leaves, which on
       a section this tall means the middle rows animate against a scroll
       position they are nowhere near. */
    el.querySelectorAll('.day-row').forEach((row) => {
      rise(row.querySelectorAll('[data-row]'), {
        trigger: row,
        y: 22,
        stagger: 0.08,
      });

      const strokes = row.querySelectorAll('.day-thread__stroke');
      if (strokes.length) grow(strokes, { trigger: row, end: 'bottom 78%' });

      const frame = row.querySelector('.day-row__figure');
      // Small enough that it is felt rather than seen. The frame is already
      // taller than its crop, so this never exposes an edge.
      if (frame) drift(frame, 26, { trigger: row });
    });
  }, []);

  return (
    <section ref={scope} className="section day ground-paper" id="day">
      <DayDefs />

      <div className="wrap day__inner">
        <header className="day__head">
          <div data-intro>
            <Sticker tone="sun" tilt={-2.2}>
              01 · An ordinary Tuesday
            </Sticker>
          </div>

          <h2 className="day__title">
            <span>A day at</span>
            <span>
              <Mark kind="underline">school</Mark>
            </span>
          </h2>

          <p className="day__statement" data-intro>
            Every moment becomes part of their journey.
          </p>
        </header>

        <ol className="day__list">
          {EVENTS.map((event, i) => {
            // Alternating sides, starting with the photograph on the right.
            // The flip is what stops nine rows reading as a table.
            const flip = i % 2 === 1;
            return (
              <li
                className={`day-row${flip ? ' day-row--flip' : ''}${
                  event.period ? ' day-row--opens' : ''
                }`}
                key={event.id}
              >
                <div className="day-row__when" data-row>
                  {event.period ? <p className="day-row__period meta">{event.period}</p> : null}
                  <p className="day-row__time">
                    {event.from} – {event.to}
                  </p>
                </div>

                {/* Outside the columns, positioned against the row, so it can
                    never be stretched by a card that happens to have a long
                    paragraph in it. */}
                {i < EVENTS.length - 1 ? <Thread /> : null}

                <article className="day-row__card" data-row>
                  <div className="day-row__text">
                    <h3 className="day-row__title">{event.title}</h3>
                    <p className="day-row__body">{event.body}</p>
                  </div>

                  <Figure
                    className={`day-row__figure day-row__figure--${flip ? 'b' : 'a'}`}
                    photo={event.photo}
                    ratio="square-ar"
                    shape="square"
                    sizes="(max-width: 599px) 74vw, 340px"
                    width={340}
                    widths={[280, 340, 560, 680]}
                  />
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
