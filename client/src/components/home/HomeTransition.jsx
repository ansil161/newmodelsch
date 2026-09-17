import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES, SCHOOL, STATS } from '@/constants';
import { campusImages } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { gsap, ScrollTrigger, SplitText } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Figure } from '@/components/editorial';
import './legacy.css';

/* ==========================================================================
   04 - OUR LEGACY
   --------------------------------------------------------------------------
   One photograph of the place and four figures that prove it, joined by a
   single drawn line. The line is the argument: legacy first, then the year it
   began, the years since, the people it produced and the results it keeps.

   THE CONNECTOR IS ONE TREE, MEASURED FROM THE LAYOUT

   It is built from the real positions of the photograph and the four cards,
   so it cannot drift out of alignment at any width. Three shapes, picked by
   what the grid is actually doing rather than by duplicated breakpoints:

     side by side   a stem out of the photograph, a trunk beside the cards,
                    and a second trunk down the gutter between the columns -
                    the two trunks joined through the gutter between the rows
     stacked, 2x2   a stem out of the photograph's foot, forking into the top
                    row and running down the column gutter to the bottom row
     one column     a stem into a vertical timeline down the cards' left edge

   Every path carries `pathLength="1"`, so the draw is a dash offset from 1 to
   0 whatever the geometry turns out to be. A resize mid-reveal only changes
   `d`; the animation does not have to know.

   THE REVEAL

   Photograph, stem, button, then for each card in turn: its branch, its node,
   the card, and inside it the index, the figure, the title and the line. One
   timeline where the whole section fits a screen. On a phone, where it does
   not, each card waits for the reader to reach it, and a small queue keeps
   the order even when they scroll faster than the drawing.

   Like every helper in `lib/motion`, nothing is hidden in CSS and reduced
   motion means the finished section, not a faster one.

   The card's entrance blurs. That is the one property here outside the
   transform-and-opacity rule: it is four nodes, once, and it is cleared the
   moment each card lands.
   ========================================================================== */

/* Below this width the cards run in one column. Must match `legacy.css`. */
const ONE_COLUMN = 600;

const stat = (label) => STATS.find((item) => item.label === label);
const written = (item) => `${item.value.toLocaleString('en-IN')}${item.suffix}`;

const years = stat('Years');
const alumni = stat('Alumni');
const results = stat('Board Results');

const MILESTONES = [
  {
    id: 'founded',
    icon: 'history',
    value: String(SCHOOL.established),
    title: 'Founded',
    body: 'A legacy that began in Bahadurpura with a vision for better education.',
  },
  {
    id: 'years',
    icon: 'cap',
    value: written(years),
    count: true,
    title: 'Years of Legacy',
    body: `${years.detail}: six decades of trust, learning and growth.`,
  },
  {
    id: 'alumni',
    icon: 'users',
    value: written(alumni),
    count: true,
    title: 'Alumni',
    body: `Leaders, dreamers and changemakers, now ${alumni.detail.toLowerCase()}.`,
  },
  {
    id: 'results',
    icon: 'trophy',
    value: written(results),
    count: true,
    title: results.label,
    body: `${results.detail}, prepared inside school hours.`,
  },
];

/* --------------------------------------------------------------------------
   Geometry
   -------------------------------------------------------------------------- */

const EMPTY = {
  segs: ['', '', '', '', ''],
  nodes: [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ],
  go: [0, 0],
};

const px = (v) => Math.round(v * 10) / 10;

/**
 * An orthogonal polyline as an SVG path with rounded corners. Each corner's
 * radius is clamped to the legs either side of it - a whole end leg, half of
 * a shared one - so a short leg bends tighter instead of overshooting.
 */
function route(points, radius) {
  let d = `M${px(points[0][0])},${px(points[0][1])}`;
  const last = points.length - 1;

  for (let i = 1; i < last; i += 1) {
    const [ax, ay] = points[i - 1];
    const [x, y] = points[i];
    const [bx, by] = points[i + 1];
    const inLen = Math.hypot(x - ax, y - ay);
    const outLen = Math.hypot(bx - x, by - y);
    if (!inLen || !outLen) continue;

    const ix = (x - ax) / inLen;
    const iy = (y - ay) / inLen;
    const ox = (bx - x) / outLen;
    const oy = (by - y) / outLen;
    const turn = ix * oy - iy * ox;
    const r = Math.min(radius, i === 1 ? inLen : inLen / 2, i === last - 1 ? outLen : outLen / 2);

    if (Math.abs(turn) < 1e-6 || r < 0.5) {
      d += ` L${px(x)},${px(y)}`;
      continue;
    }

    // Screen space is y-down, so a positive cross product is a clockwise turn.
    d +=
      ` L${px(x - ix * r)},${px(y - iy * r)}` +
      ` A${px(r)},${px(r)} 0 0 ${turn > 0 ? 1 : 0} ${px(x + ox * r)},${px(y + oy * r)}`;
  }

  return `${d} L${px(points[last][0])},${px(points[last][1])}`;
}

/* Layout boxes rather than client rects: the cards are measured while GSAP
   has them lowered and scaled, and the line has to meet where they land. */
const box = (el) => {
  const x = el.offsetLeft;
  const y = el.offsetTop;
  return { x, y, r: x + el.offsetWidth, b: y + el.offsetHeight, cx: x + el.offsetWidth / 2 };
};

function measure(media, cards) {
  const m = box(media);
  const c = cards.map(box);
  // Where each card's icon sits, from the card's own top edge.
  const eye = cards.map((card) => {
    const icon = card.querySelector('.legacy-card__icon');
    return icon ? icon.offsetTop + icon.offsetHeight / 2 : 40;
  });

  /* Side by side. Top-row nodes level with the icons, bottom-row nodes the
     same distance up from the foot, so both trunks are symmetrical about the
     row gutter the stem runs through. */
  if (m.r <= c[0].x) {
    const cy = (c[0].b + c[2].y) / 2;
    const trunk = m.r + (c[0].x - m.r) / 2;
    const gutter = (c[0].r + c[1].x) / 2;
    const bend = Math.min(26, (c[0].x - trunk) * 0.8);
    const tight = Math.min(12, (c[1].x - c[0].r) / 2, (c[2].y - c[0].b) / 2);
    const top = [c[0].y + eye[0], c[1].y + eye[1]];
    const foot = [c[2].b - eye[2], c[3].b - eye[3]];

    return {
      segs: [
        route([[m.r, cy], [trunk, cy]], 0),
        route([[trunk, cy], [trunk, top[0]], [c[0].x, top[0]]], bend),
        route([[trunk, cy], [gutter, cy], [gutter, top[1]], [c[1].x, top[1]]], tight),
        route([[trunk, cy], [trunk, foot[0]], [c[2].x, foot[0]]], bend),
        route([[gutter - tight, cy], [gutter, cy], [gutter, foot[1]], [c[3].x, foot[1]]], tight),
      ],
      nodes: [
        [c[0].x, top[0]],
        [c[1].x, top[1]],
        [c[2].x, foot[0]],
        [c[3].x, foot[1]],
      ],
      go: [trunk, cy],
    };
  }

  /* Stacked, two up. A T under the photograph into the top row; the stem
     carries on down the column gutter and forks along the row gutter. */
  if (c[1].y === c[0].y) {
    const gutter = (c[0].r + c[1].x) / 2;
    const by = (m.b + c[0].y) / 2;
    const cy = (c[0].b + c[2].y) / 2;
    const bend = Math.min(22, (c[0].y - by) * 0.8);
    const tight = Math.min(12, (c[1].x - c[0].r) / 2, (c[2].y - c[0].b) / 2);

    return {
      segs: [
        route([[gutter, m.b], [gutter, by]], 0),
        route([[gutter, by], [c[0].cx, by], [c[0].cx, c[0].y]], bend),
        route([[gutter, by], [c[1].cx, by], [c[1].cx, c[1].y]], bend),
        route([[gutter, by], [gutter, cy], [c[2].cx, cy], [c[2].cx, c[2].y]], tight),
        route([[gutter, cy - tight], [gutter, cy], [c[3].cx, cy], [c[3].cx, c[3].y]], tight),
      ],
      nodes: c.map((card) => [card.cx, card.y]),
      go: [gutter, by],
    };
  }

  /* One column: a timeline. Each branch starts where the previous one left
     the trunk, so the four pieces read as one line. */
  const trunk = c[0].x / 2;
  const by = (m.b + c[0].y) / 2;
  const bend = Math.min(16, c[0].x - trunk);
  const at = c.map((card, i) => card.y + eye[i]);

  return {
    segs: [
      route([[trunk, m.b], [trunk, by]], 0),
      ...c.map((card, i) =>
        route([[trunk, i ? at[i - 1] - bend : by], [trunk, at[i]], [card.x, at[i]]], bend),
      ),
    ],
    nodes: c.map((card, i) => [card.x, at[i]]),
    go: [trunk, by],
  };
}

function useConnector(stageRef) {
  const [geo, setGeo] = useState(EMPTY);

  useIsomorphicLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const media = stage.querySelector('.legacy__media');
    const cards = [...stage.querySelectorAll('.legacy-card')];
    if (!media || cards.length !== 4) return;

    let last = '';
    const update = () => {
      const next = measure(media, cards);
      const key = JSON.stringify(next);
      if (key === last) return;
      last = key;
      setGeo(next);
    };

    update();
    const observer = new ResizeObserver(update);
    [stage, media, ...cards].forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return geo;
}

/* --------------------------------------------------------------------------
   Choreography
   -------------------------------------------------------------------------- */

function drawIn(tl, paths, at, duration) {
  tl.set(paths, { opacity: 1 }, at).to(
    paths,
    { attr: { 'stroke-dashoffset': 0 }, duration, ease: 'power2.inOut' },
    at,
  );
}

function nodeIn(tl, node, at) {
  tl.fromTo(
    node,
    { autoAlpha: 0, scale: 0 },
    { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(1.5)' },
    at,
  );
}

function introIn(tl, el) {
  const media = el.querySelector('.legacy__media');
  const shot = media.querySelector('.legacy__shot');
  const image = shot.querySelector('img');
  const round = getComputedStyle(shot).borderTopLeftRadius || '0px';

  const split = new SplitText(el.querySelector('.legacy__title'), {
    type: 'lines',
    linesClass: 'split-line',
    mask: 'lines',
    autoSplit: true,
  });

  // The frame rises and settles while the photograph inside it is uncovered
  // from the foot upward and eases back from a slight push-in.
  tl.fromTo(
    media,
    { autoAlpha: 0, y: 56, scale: 0.96 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 1.6, ease: 'expo.out', clearProps: 'transform' },
    0,
  )
    .fromTo(
      shot,
      { clipPath: `inset(24% 0% 0% 0% round ${round})` },
      {
        clipPath: `inset(0% 0% 0% 0% round ${round})`,
        duration: 1.5,
        ease: 'power3.inOut',
        clearProps: 'clipPath',
      },
      0,
    )
    .fromTo(image, { scale: 1.16 }, { scale: 1, duration: 2.4, ease: 'power2.out' }, 0)
    .fromTo(
      el.querySelector('.legacy__label'),
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' },
      0.5,
    )
    .fromTo(
      el.querySelector('.legacy__rule'),
      { scaleX: 0, transformOrigin: '0% 50%' },
      { scaleX: 1, duration: 1, ease: 'power3.inOut' },
      0.62,
    )
    .from(split.lines, { yPercent: 118, duration: 1.15, ease: 'power4.out', stagger: 0.1 }, 0.56)
    .fromTo(
      el.querySelector('.legacy__lead'),
      { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out' },
      0.84,
    );

  return split;
}

function goIn(tl, el, at) {
  const go = el.querySelector('.legacy__go');
  tl.fromTo(
    go,
    { autoAlpha: 0, scale: 0.4 },
    { autoAlpha: 1, scale: 1, duration: 0.9, ease: 'expo.out', clearProps: 'transform' },
    at,
  ).fromTo(
    go.querySelector('.legacy__go-ring'),
    { autoAlpha: 0.5, scale: 1 },
    { autoAlpha: 0, scale: 1.9, duration: 1.4, ease: 'power2.out', immediateRender: false },
    at + 0.3,
  );
}

/** Counts a written figure up to itself - '10,000+' keeps its comma and plus. */
function tally(tl, el, at) {
  const final = el.dataset.value;
  const match = final.match(/[\d,]+/);
  if (!match) return;

  const target = parseInt(match[0].replace(/,/g, ''), 10);
  const head = final.slice(0, match.index);
  const tail = final.slice(match.index + match[0].length);
  const grouped = match[0].includes(',');
  const state = { n: 0 };

  tl.to(
    state,
    {
      n: target,
      duration: 1.5,
      ease: 'power3.out',
      onUpdate: () => {
        const n = Math.round(state.n);
        el.textContent = head + (grouped ? n.toLocaleString('en-IN') : n) + tail;
      },
      onComplete: () => {
        el.textContent = final;
      },
    },
    at,
  );
}

function cardIn(tl, card, at) {
  const part = (name) => card.querySelector(`.legacy-card__${name}`);
  const value = part('value');

  // The card's hover transition would chase every frame of the entrance.
  gsap.set(card, { transition: 'none' });

  tl.fromTo(
    card,
    { autoAlpha: 0, y: 44, scale: 0.96, filter: 'blur(6px)' },
    {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      duration: 1.1,
      ease: 'expo.out',
      clearProps: 'opacity,visibility,transform,filter,transition',
    },
    at,
  )
    .fromTo(
      part('index'),
      { autoAlpha: 0, y: -10 },
      { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' },
      at + 0.2,
    )
    .fromTo(
      part('icon'),
      { autoAlpha: 0, scale: 0.8 },
      { autoAlpha: 1, scale: 1, duration: 0.9, ease: 'expo.out' },
      at + 0.26,
    )
    // The figure is written left to right rather than faded up.
    .fromTo(
      value,
      { clipPath: 'inset(-25% 100% -25% 0%)', y: 16 },
      {
        clipPath: 'inset(-25% -8% -25% 0%)',
        y: 0,
        duration: 1.05,
        ease: 'power3.inOut',
        clearProps: 'clipPath,transform',
      },
      at + 0.36,
    );

  if (value.dataset.count) tally(tl, value, at + 0.36);

  tl.fromTo(
    part('title'),
    { autoAlpha: 0, y: 14 },
    { autoAlpha: 1, y: 0, duration: 0.75, ease: 'power3.out' },
    at + 0.6,
  ).fromTo(
    part('body'),
    { autoAlpha: 0, y: 14 },
    { autoAlpha: 1, y: 0, duration: 0.85, ease: 'power3.out' },
    at + 0.72,
  );
}

/* Branch draw time per card. The second branch is the longest route. */
const DRAW = [0.6, 0.85, 0.6, 0.75];

/* --------------------------------------------------------------------------
   Section
   -------------------------------------------------------------------------- */

export function HomeTransition() {
  const stageRef = useRef(null);
  const geo = useConnector(stageRef);

  const scope = useGsapScope((_, el) => {
    if (reduced()) return;

    const seg = (step) => el.querySelectorAll(`.legacy__seg[data-step="${step}"] path`);
    const node = (step) => el.querySelector(`.legacy__node[data-step="${step}"] .legacy__node-in`);
    const cards = [...el.querySelectorAll('.legacy-card')];
    const values = [...el.querySelectorAll('.legacy-card__value')];
    if (cards.length !== 4) return;

    const mm = gsap.matchMedia();

    mm.add(
      {
        wide: `(min-width: ${ONE_COLUMN}px)`,
        narrow: `(max-width: ${ONE_COLUMN - 0.02}px)`,
      },
      ({ conditions }) => {
        gsap.set(el.querySelectorAll('.legacy__seg path'), {
          opacity: 0,
          attr: { 'stroke-dasharray': '1 2', 'stroke-dashoffset': 1 },
        });
        gsap.set(el.querySelectorAll('.legacy__node-in'), { transformOrigin: '50% 50%' });

        let split;

        if (conditions.wide) {
          // The whole section fits a screen: one continuous sequence.
          const tl = gsap.timeline({
            scrollTrigger: { trigger: el, start: '28% bottom', once: true },
          });

          split = introIn(tl, el);
          drawIn(tl, seg(0), 0.85, 0.55);
          goIn(tl, el, 1.22);

          let at = 1.38;
          cards.forEach((card, i) => {
            drawIn(tl, seg(i + 1), at, DRAW[i]);
            nodeIn(tl, node(i + 1), at + DRAW[i] - 0.06);
            const land = at + DRAW[i] - 0.14;
            cardIn(tl, card, land);
            at = land + 0.7;
          });
        } else {
          // A phone: each card waits for the reader, but never jumps the queue.
          let freeAt = 0;
          const enqueue = (tl, handoff) => {
            const now = gsap.ticker.time;
            const wait = Math.max(0, freeAt - now);
            freeAt = now + wait + handoff;
            gsap.delayedCall(wait, () => tl.play());
          };

          const intro = gsap.timeline({ paused: true });
          split = introIn(intro, el);
          drawIn(intro, seg(0), 0.85, 0.5);
          goIn(intro, el, 1.18);

          ScrollTrigger.create({
            trigger: el.querySelector('.legacy__media'),
            start: 'top 80%',
            once: true,
            onEnter: () => enqueue(intro, 1.3),
          });

          cards.forEach((card, i) => {
            const tl = gsap.timeline({ paused: true });
            drawIn(tl, seg(i + 1), 0, 0.7);
            nodeIn(tl, node(i + 1), 0.64);
            cardIn(tl, card, 0.52);

            ScrollTrigger.create({
              trigger: card,
              start: 'top 84%',
              once: true,
              onEnter: () => enqueue(tl, 0.9),
            });
          });
        }

        return () => {
          split?.revert();
          values.forEach((v) => {
            v.textContent = v.dataset.value;
          });
        };
      },
    );

    return () => mm.revert();
  }, []);

  return (
    <section ref={scope} className="legacy ground-mist" aria-labelledby="legacy-title">
      <span className="legacy__orb legacy__orb--a" aria-hidden="true" />
      <span className="legacy__orb legacy__orb--b" aria-hidden="true" />

      <div className="wrap">
        <div ref={stageRef} className="legacy__stage">
          <div className="legacy__media">
            <Figure
              photo={campusImages[8]}
              width={1100}
              sizes="(max-width: 959px) 92vw, 44vw"
              shape="frame"
              ratio="free"
              className="legacy__shot"
            />
            <span className="legacy__veil" aria-hidden="true" />

            <div className="legacy__copy">
              <p className="legacy__label">
                <span>Our legacy</span>
                <span className="legacy__rule" aria-hidden="true" />
              </p>
              <h2 className="legacy__title" id="legacy-title">
                A Journey of Excellence
              </h2>
              <p className="legacy__lead">
                For over six decades, we have been shaping young minds, building character
                and creating a better tomorrow.
              </p>
            </div>
          </div>

          <svg className="legacy__links" aria-hidden="true" focusable="false">
            {geo.segs.map((d, step) => (
              <g className="legacy__seg" data-step={step} key={step}>
                <path className="legacy__halo" d={d} pathLength="1" />
                <path className="legacy__halo legacy__halo--near" d={d} pathLength="1" />
                <path className="legacy__line" d={d} pathLength="1" />
              </g>
            ))}

            {geo.nodes.map(([x, y], i) => (
              <g
                className="legacy__node"
                data-step={i + 1}
                key={i}
                transform={`translate(${x} ${y})`}
              >
                <g className="legacy__node-in">
                  <circle className="legacy__node-halo" r="10" />
                  <circle className="legacy__node-dot" r="4.5" />
                </g>
              </g>
            ))}
          </svg>

          <Link
            className="legacy__go"
            to={ROUTES.about}
            aria-label="Read the story of the school"
            style={{ left: geo.go[0], top: geo.go[1] }}
          >
            <span className="legacy__go-ring" aria-hidden="true" />
            <Icon name="arrowRight" size={20} />
          </Link>

          <ol className="legacy__grid">
            {MILESTONES.map((item, i) => (
              <li className="legacy-card" data-step={i + 1} key={item.id}>
                <div className="legacy-card__top">
                  <span className="legacy-card__icon" aria-hidden="true">
                    <Icon name={item.icon} size={26} />
                  </span>
                  <span className="legacy-card__index" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>

                <p className="legacy-card__stat">
                  <span
                    className="legacy-card__value"
                    data-value={item.value}
                    data-count={item.count ? 'true' : undefined}
                  >
                    {item.value}
                  </span>
                </p>
                <h3 className="legacy-card__title">{item.title}</h3>
                <p className="legacy-card__body">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
