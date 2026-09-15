import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { ADMISSIONS_INTRO, SCHOOL, STATS, WHY_CHOOSE } from '@/constants';
import {
  academicImages,
  beyondImages,
  campusImages,
  everydayImages,
  resolve,
  resolveSet,
  studentImages,
} from '@/constants/imagery';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useMediaQuery, useReducedMotion } from '@/hooks/useMediaQuery';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import { Icon } from '@/components/common/Icon';
import './why-book.css';

/* ==========================================================================
   02 - WHY CHOOSE US - the prospectus
   --------------------------------------------------------------------------
   The five reasons, bound as a book. The section pins, and the reader's
   scroll turns the pages: the right-hand leaf lifts from its outer edge,
   curls over the spine and lands as the next left-hand page, uncovering the
   next reason underneath it.

     SPREAD 0   the cover photograph  |  the heading and the contents
     SPREAD n   the evidence          |  reason n, its words and its figure

   HOW A LEAF IS BUILT

   A leaf is one sheet of paper with two printed sides: its front is the
   right-hand page of spread n, its back is the left-hand page of spread n+1.
   Turning it is a rotation about the spine through 180 degrees.

   A rigid rotation reads as a card being flipped, so every leaf is cut into
   three hinged strips (`SEGMENTS`), each nested inside the one nearer the
   spine and each carrying its own slice of both printed sides. The strips
   rotate a little further than the one before on the way up - the edge is
   lifted first - and a little less on the way down - the edge floats down
   last. Summed, the extra curl never exceeds 57 degrees, which is the bound
   that keeps the outer edge from passing through the page it lands on.

   Light, depth and the rest are drawn rather than simulated: each strip
   darkens by the sine of its own angle, the leaf casts a gradient onto the
   page below it, the stacks of paper either side of the spine thicken and
   thin as pages move across, and the words on the page being uncovered
   rise the last few pixels into place as the leaf clears them.

   STACKING WITHOUT A SHARED 3D CONTEXT

   Every leaf is its own 3D rendering context - the book itself is flat - so
   the leaves are ordered by `z-index`, not by depth sorting. Coplanar pages
   in one shared context z-fight; ordered explicitly they cannot. Leaves on
   the right are stacked lowest index on top, leaves on the left highest
   index on top, and the one leaf in motion is above both.

   PHONES, AND READERS WHO ASKED FOR LESS MOVEMENT

   A spread is too small to read on a phone, so below the spread query the
   book is a single page - photograph and words together - and each leaf
   turns away over the spine to the left. With reduced motion there is no
   pin: the spreads are printed flat, one under the other.

   The book is decoration for assistive technology (`aria-hidden`): the same
   content is in the document once, in order, as a list.
   ========================================================================== */

type Mode = 'spread' | 'single';

/** The spread layout needs width and a landscape-ish window. */
const SPREAD_QUERY = '(min-width: 900px) and (min-aspect-ratio: 11/10)';

/** Page-width fractions of each hinged strip, spine to outer edge. */
const SEGMENTS = [0.44, 0.31, 0.25];

/** Extra rotation each strip adds at the height of the curl, in degrees.
 *  The sum must stay under 57 - see the header. */
const CURL = [0, 18, 24];

/* Timeline units. One unit of hold at the start, one of turn per page, and a
   hold after each turn in which the page lies flat and can be read. */
const H0 = 0.3;
const TURN = 1;
const HOLD = 0.55;

/** Viewport heights of scroll per timeline unit. */
const UNIT = { spread: 0.62, single: 0.5 } as const;

/* --------------------------------------------------------------------------
   Content
   --------------------------------------------------------------------------
   The titles and descriptions are the school's own, from `WHY_CHOOSE`. The
   kickers are the ones the section already used. Every figure below is one
   the site already publishes elsewhere - nothing here is new information.
   -------------------------------------------------------------------------- */

interface Figure {
  value: string;
  label: string;
}

interface Reason {
  id: string;
  kicker: string;
  title: string;
  /** The description as written. */
  description: string;
  /** What the page prints as its paragraph. */
  body: string;
  /** A second sentence set large, where a reason has no figure to show. */
  pull?: string;
  figures: Figure[];
  photo: Photo;
}

type ReasonId = (typeof WHY_CHOOSE)[number]['id'];

const board = STATS.find((stat) => stat.suffix === '%');

const DETAIL: Record<ReasonId, { kicker: string; photo: Photo; figures: Figure[]; pull?: true }> = {
  known: {
    kicker: 'Curious by design',
    photo: academicImages[0],
    // education.ts - the mentor groups
    figures: [{ value: '1:18', label: 'Mentor group ratio' }],
  },
  results: {
    kicker: 'Rooted in values',
    photo: everydayImages.reading,
    figures: board
      ? [{ value: `${board.value}${board.suffix}`, label: `${board.label} · ${board.detail}` }]
      : [],
  },
  breadth: {
    kicker: 'Built for every child',
    photo: beyondImages.problemSolving,
    // campus-life.ts - the campus facts
    figures: [{ value: '11', label: 'Laboratories · science, computing, robotics' }],
  },
  honesty: {
    kicker: 'Learning beyond marks',
    photo: everydayImages.lesson,
    figures: [],
    pull: true,
  },
  legacy: {
    kicker: 'A place to come back to',
    photo: studentImages[5],
    figures: [
      { value: '64', label: 'Years' },
      { value: '10,000+', label: 'Alumni' },
      { value: '1,000+', label: 'Second-generation families' },
    ],
  },
};

const REASONS: Reason[] = WHY_CHOOSE.map((item) => {
  const detail = DETAIL[item.id];
  const [first, ...rest] = item.description.split(/(?<=\.)\s+/);
  const pull = detail.pull && rest.length ? rest.join(' ') : undefined;
  return {
    id: item.id,
    kicker: detail.kicker,
    title: item.title,
    description: item.description,
    body: pull ? first : item.description,
    pull,
    figures: detail.figures,
    photo: detail.photo,
  };
});

const INTRO = {
  photo: campusImages[7],
  kicker: `${REASONS.length} reasons`,
  title: 'Reasons you can check for yourself.',
  lead: 'Five answers, and every one of them is something you can check on a campus visit rather than something we can only assert here.',
};

/** Spreads in the book: the opening one, then one per reason. */
const SPREADS = REASONS.length + 1;
/** Leaves that turn. */
const LEAVES = SPREADS - 1;

const pad = (n: number) => String(n).padStart(2, '0');

/* ==========================================================================
   Pages
   ========================================================================== */

function Plate({
  photo,
  className,
  sizes,
  children,
}: {
  photo: Photo;
  className?: string;
  sizes: string;
  children?: ReactNode;
}) {
  return (
    <div className={`wb-plate ${className ?? ''}`}>
      <img
        data-img
        src={resolve(photo, 900)}
        srcSet={resolveSet(photo, [480, 900, 1300])}
        sizes={sizes}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        style={photo.focus ? { objectPosition: photo.focus } : undefined}
      />
      {children}
    </div>
  );
}

const SPREAD_SIZES = '(max-width: 1400px) 34vw, 560px';
const SINGLE_SIZES = '(max-width: 700px) 88vw, 560px';

function RunHead({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="wb-page__run">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

function Figures({ reason }: { reason: Reason }) {
  if (reason.pull) {
    return (
      <p className="wb-page__pull" data-rise>
        {reason.pull}
      </p>
    );
  }
  if (!reason.figures.length) return null;
  return (
    <div className={`wb-page__figs${reason.figures.length > 1 ? ' is-row' : ''}`} data-rise>
      {reason.figures.map((figure) => (
        <div className="wb-page__fig" key={figure.label}>
          <span className="wb-page__fig-v">{figure.value}</span>
          <span className="wb-page__fig-l">{figure.label}</span>
        </div>
      ))}
    </div>
  );
}

function Contents() {
  return (
    <ol className="wb-toc" data-rise>
      {REASONS.map((reason, i) => (
        <li key={reason.id}>
          <span className="wb-toc__no">{pad(i + 1)}</span>
          <span className="wb-toc__t">{reason.title}</span>
          <span className="wb-toc__dots" />
          <span className="wb-toc__pg">{pad((i + 1) * 2 + 1)}</span>
        </li>
      ))}
    </ol>
  );
}

/** The left-hand page of a spread: the photograph. */
function LeftPage({ s }: { s: number }) {
  if (s === 0) {
    return (
      <div className="wb-page wb-page--l wb-page--cover">
        <div className="wb-page__inner">
          <Plate photo={INTRO.photo} className="wb-cover__plate" sizes={SPREAD_SIZES} />
          <span className="wb-cover__scrim" />
          <div className="wb-cover__top">
            <span className="wb-cover__crest">{SCHOOL.shortName}</span>
            <span>Prospectus {ADMISSIONS_INTRO.session}</span>
          </div>
          <div className="wb-cover__body">
            <p className="wb-cover__label" data-rise>
              Since {SCHOOL.established} · {SCHOOL.locality}
            </p>
            <p className="wb-cover__name" data-rise>
              {SCHOOL.name}
            </p>
            <span className="wb-cover__rule" />
          </div>
        </div>
      </div>
    );
  }

  const reason = REASONS[s - 1];
  return (
    <div className="wb-page wb-page--l">
      <div className="wb-page__inner">
        <RunHead left={SCHOOL.name} right={`Est. ${SCHOOL.established}`} />
        <Plate photo={reason.photo} className="wb-page__plate" sizes={SPREAD_SIZES} />
        <p className="wb-page__caption" data-rise>
          <b>Fig. {pad(s)}</b>
          <span>{reason.photo.alt}</span>
        </p>
        <p className="wb-page__folio">{pad(s * 2 + 1)}</p>
      </div>
    </div>
  );
}

/** The right-hand page of a spread: the words. */
function RightPage({ s }: { s: number }) {
  if (s === 0) {
    return (
      <div className="wb-page wb-page--r wb-page--intro">
        <div className="wb-page__inner">
          <RunHead left="Why choose us" right="Contents" />
          <p className="wb-page__kicker" data-rise>
            {INTRO.kicker}
          </p>
          <p className="wb-page__title wb-page__title--xl" data-rise>
            {INTRO.title}
          </p>
          <p className="wb-page__body" data-rise>
            {INTRO.lead}
          </p>
          <Contents />
          <p className="wb-page__folio">02</p>
        </div>
      </div>
    );
  }

  const reason = REASONS[s - 1];
  return (
    <div className="wb-page wb-page--r">
      <div className="wb-page__inner">
        <RunHead left="Why choose us" right={`Reason ${pad(s)} / ${pad(REASONS.length)}`} />
        <div className="wb-page__lead" data-rise>
          <span className="wb-page__num">{pad(s)}</span>
          <span className="wb-page__kicker">{reason.kicker}</span>
        </div>
        <p className="wb-page__title" data-rise>
          {reason.title}
        </p>
        <p className="wb-page__body" data-rise>
          {reason.body}
        </p>
        <Figures reason={reason} />
        <p className="wb-page__folio">{pad(s * 2 + 2)}</p>
      </div>
    </div>
  );
}

/** A phone's page: photograph and words on one sheet. */
function SinglePage({ s }: { s: number }) {
  if (s === 0) {
    return (
      <div className="wb-page wb-page--single wb-page--intro">
        <div className="wb-page__inner">
          <RunHead left="Why choose us" right={`Prospectus ${ADMISSIONS_INTRO.session}`} />
          <Plate photo={INTRO.photo} className="wb-page__plate wb-page__plate--cover" sizes={SINGLE_SIZES}>
            <span className="wb-cover__scrim" />
            <span className="wb-cover__mini">
              <span>Since {SCHOOL.established}</span>
              <b>{SCHOOL.name}</b>
            </span>
          </Plate>
          <p className="wb-page__kicker" data-rise>
            {INTRO.kicker}
          </p>
          <p className="wb-page__title" data-rise>
            {INTRO.title}
          </p>
          <p className="wb-page__body" data-rise>
            {INTRO.lead}
          </p>
          <p className="wb-page__folio">01</p>
        </div>
      </div>
    );
  }

  const reason = REASONS[s - 1];
  return (
    <div className="wb-page wb-page--single">
      <div className="wb-page__inner">
        <RunHead left="Why choose us" right={`${pad(s)} / ${pad(REASONS.length)}`} />
        <Plate photo={reason.photo} className="wb-page__plate" sizes={SINGLE_SIZES} />
        <div className="wb-page__lead" data-rise>
          <span className="wb-page__num">{pad(s)}</span>
          <span className="wb-page__kicker">{reason.kicker}</span>
        </div>
        <p className="wb-page__title" data-rise>
          {reason.title}
        </p>
        <p className="wb-page__body" data-rise>
          {reason.body}
        </p>
        <Figures reason={reason} />
        <p className="wb-page__folio">{pad(s + 1)}</p>
      </div>
    </div>
  );
}

/** The reverse of a phone's page, seen only while it turns away. */
function PaperBack() {
  return (
    <div className="wb-page wb-page--back">
      <div className="wb-page__inner">
        <span className="wb-back__mark">{SCHOOL.shortName}</span>
      </div>
    </div>
  );
}

/* ==========================================================================
   The book
   ========================================================================== */

interface LeafFaces {
  front: ReactNode;
  back: ReactNode;
}

/** One leaf: the strips, nested spine-outward, each holding its slice of
 *  both printed sides. */
function Leaf({ index, faces }: { index: number; faces: LeafFaces }) {
  const strip = (j: number, from: number): ReactNode => {
    if (j === SEGMENTS.length) return null;
    const to = from + SEGMENTS[j];
    return (
      <div className="wb-seg" style={{ '--seg-w': SEGMENTS[j] } as CSSProperties}>
        <div className="wb-face wb-face--front">
          <div className="wb-face__page" style={{ '--x': from } as CSSProperties}>
            {faces.front}
          </div>
          <span className="wb-face__shade" />
        </div>
        <div className="wb-face wb-face--back">
          <div className="wb-face__page" style={{ '--x': 1 - to } as CSSProperties}>
            {faces.back}
          </div>
          <span className="wb-face__shade" />
        </div>
        {strip(j + 1, to)}
      </div>
    );
  };

  return (
    <div className="wb-leaf" data-leaf={index}>
      {strip(0, 0)}
    </div>
  );
}

function Book({ mode }: { mode: Mode }) {
  const single = mode === 'single';
  const leaves = Array.from({ length: LEAVES }, (_, k) => ({
    k,
    faces: single
      ? { front: <SinglePage s={k} />, back: <PaperBack /> }
      : { front: <RightPage s={k} />, back: <LeftPage s={k + 1} /> },
  }));

  return (
    <div className={`wb-book wb-book--${mode}`} aria-hidden="true">
      <span className="wb-book__shadow" />
      <span className="wb-book__cover">
        <span className="wb-book__ribbon" />
      </span>
      {!single && <span className="wb-book__stack wb-book__stack--l" />}
      <span className="wb-book__stack wb-book__stack--r" />

      {!single && (
        <div className="wb-book__base wb-book__base--l">
          <LeftPage s={0} />
        </div>
      )}
      <div className="wb-book__base wb-book__base--r">
        {single ? <SinglePage s={LEAVES} /> : <RightPage s={LEAVES} />}
      </div>

      {/* Reversed, so before the module runs the stylesheet's natural order
          already has the first leaf on top. */}
      {[...leaves].reverse().map(({ k, faces }) => (
        <Leaf key={k} index={k} faces={faces} />
      ))}

      <span className="wb-book__cast wb-book__cast--r" />
      {!single && <span className="wb-book__cast wb-book__cast--l" />}
    </div>
  );
}

/** Reduced motion: every spread printed flat, in order. */
function StaticBooks({ mode }: { mode: Mode }) {
  return (
    <div className="wb-static" aria-hidden="true">
      {Array.from({ length: SPREADS }, (_, s) => (
        <div className={`wb-book wb-book--${mode} wb-book--static`} key={s}>
          <span className="wb-book__cover" />
          {mode === 'spread' ? (
            <>
              <div className="wb-book__base wb-book__base--l">
                <LeftPage s={s} />
              </div>
              <div className="wb-book__base wb-book__base--r">
                <RightPage s={s} />
              </div>
            </>
          ) : (
            <div className="wb-book__base wb-book__base--r">
              <SinglePage s={s} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   Motion
   ========================================================================== */

interface Run {
  trigger: ScrollTrigger;
  /** Scroll position at which spread `s` lies open and still. */
  at: (s: number) => number;
}

interface Surface {
  rise: { el: HTMLElement; i: number }[];
  img: HTMLElement[];
}

const smooth = (lo: number, hi: number, v: number) => {
  const x = gsap.utils.clamp(0, 1, (v - lo) / (hi - lo));
  return x * x * (3 - 2 * x);
};

function collect(pages: Element[]): Surface {
  const rise: Surface['rise'] = [];
  const img: HTMLElement[] = [];
  pages.forEach((page) => {
    page.querySelectorAll<HTMLElement>('[data-rise]').forEach((el, i) => rise.push({ el, i }));
    page.querySelectorAll<HTMLElement>('[data-img]').forEach((el) => img.push(el));
  });
  return { rise, img };
}

function buildBook(
  scope: HTMLElement,
  mode: Mode,
  onPage: (s: number) => void,
  run: RefObject<Run | null>,
  scrollTo: (y: number) => void,
) {
  const book = scope.querySelector<HTMLElement>('.wb-book');
  const tilt = scope.querySelector<HTMLElement>('.wb__tilt');
  const float = scope.querySelector<HTMLElement>('.wb__float');
  if (!book || !tilt || !float) return;

  const single = mode === 'single';
  const leafEls = gsap.utils
    .toArray<HTMLElement>('.wb-leaf', book)
    .sort((a, b) => Number(a.dataset.leaf) - Number(b.dataset.leaf));
  const L = leafEls.length;
  if (L !== LEAVES) return;

  const leaves = leafEls.map((el) => {
    const segs = Array.from(el.querySelectorAll<HTMLElement>('.wb-seg'));
    return {
      el,
      segs,
      shadeF: segs.map((seg) => seg.querySelector<HTMLElement>(':scope > .wb-face--front > .wb-face__shade')),
      shadeB: segs.map((seg) => seg.querySelector<HTMLElement>(':scope > .wb-face--back > .wb-face__shade')),
      front: collect(Array.from(el.querySelectorAll('.wb-face--front > .wb-face__page'))),
      back: collect(Array.from(el.querySelectorAll('.wb-face--back > .wb-face__page'))),
    };
  });

  const baseL = book.querySelector('.wb-book__base--l');
  const baseR = book.querySelector('.wb-book__base--r');
  const castR = book.querySelector<HTMLElement>('.wb-book__cast--r');
  const castL = book.querySelector<HTMLElement>('.wb-book__cast--l');
  const stackR = book.querySelector<HTMLElement>('.wb-book__stack--r');
  const stackL = book.querySelector<HTMLElement>('.wb-book__stack--l');
  const fill = scope.querySelector<HTMLElement>('.wb-count__fill');
  const cue = scope.querySelector<HTMLElement>('.wb-cue');

  const empty: Surface = { rise: [], img: [] };
  const baseLS = baseL ? collect([baseL]) : empty;
  const baseRS = baseR ? collect([baseR]) : empty;

  /** The printed surfaces of spread `s`: [left, right] on a spread, or the
   *  one page on a phone. */
  const surfaces = (s: number): { left: Surface; right: Surface } => {
    const right = s < L ? leaves[s].front : baseRS;
    if (single) return { left: empty, right };
    return { left: s === 0 ? baseLS : leaves[s - 1].back, right };
  };

  /** Words settling into place: `r` 0 is lowered and faint, 1 is at rest. */
  const rise = (surface: Surface, r: number) => {
    surface.rise.forEach(({ el, i }) => {
      const lo = 0.3 + 0.06 * Math.min(i, 6);
      const k = smooth(lo, Math.min(1, lo + 0.42), r);
      if (k >= 1) {
        el.style.transform = '';
        el.style.opacity = '';
      } else {
        el.style.transform = `translate3d(0, ${((1 - k) * 16).toFixed(2)}px, 0)`;
        el.style.opacity = (0.2 + 0.8 * k).toFixed(3);
      }
    });
  };

  /** A photograph drifting with the reading, and settling as it lands. */
  const drift = (surface: Surface, t: number, s: number, settle: number) => {
    const y = gsap.utils.clamp(-1, 1, t - s) * -3;
    const scale = 1 + 0.1 * (1 - settle);
    surface.img.forEach((img) => {
      img.style.transform = `translate3d(0, ${y.toFixed(2)}%, 0) scale(${scale.toFixed(4)})`;
    });
  };

  let perspective = 1600;
  const measure = () => {
    perspective = Math.max(900, leafEls[0].offsetWidth * 2.8);
  };
  measure();

  let shown = -1;
  let lastA = -1;

  const render = (t: number) => {
    const a = Math.min(Math.floor(t), L - 1);
    const p = gsap.utils.clamp(0, 1, t - a);

    /* ---- the leaves ---------------------------------------------------- */
    leaves.forEach((leaf, k) => {
      const prog = k < a ? 1 : k > a ? 0 : p;
      const turning = prog > 0 && prog < 1;
      const visible = Math.abs(k - a) <= 1 && !(single && prog >= 1);

      leaf.el.style.visibility = visible ? '' : 'hidden';
      leaf.el.style.zIndex = String(turning ? 100 : prog >= 0.5 ? 10 + 2 * k : 10 + 2 * (L - k));
      if (!visible) return;

      // Lifted at the edge on the way up; the edge floats down last.
      const bend = Math.sin(prog * Math.PI * 2) * (prog < 0.5 ? 1 : 0.55);
      let phi = 180 * prog;

      leaf.segs.forEach((seg, j) => {
        const extra = j === 0 ? 0 : (CURL[j] ?? 0) * bend;
        phi += extra;
        seg.style.transform =
          j === 0
            ? `perspective(${perspective.toFixed(0)}px) rotateY(${(-180 * prog).toFixed(3)}deg)`
            : `rotateY(${(-extra).toFixed(3)}deg)`;

        const light = Math.sin((Math.min(180, Math.max(0, phi)) * Math.PI) / 180);
        const front = leaf.shadeF[j];
        const back = leaf.shadeB[j];
        if (front) front.style.opacity = phi < 90 ? (light * 0.95).toFixed(3) : '1';
        if (back) back.style.opacity = phi > 90 ? (light * 0.95).toFixed(3) : '1';
      });

      // On a phone the page turns away past the spine and is gone.
      leaf.el.style.opacity = single ? String(1 - smooth(0.58, 0.9, prog)) : '';
    });

    /* ---- the shadow the moving leaf throws ----------------------------- */
    const phiA = 180 * p;
    const rad = (phiA * Math.PI) / 180;
    const moving = p > 0 && p < 1;
    if (castR) {
      const on = moving && phiA < 90;
      castR.style.opacity = on ? (smooth(0, 16, phiA) * (0.4 + 0.6 * Math.sin(rad))).toFixed(3) : '0';
      castR.style.transform = `scaleX(${Math.max(0.06, Math.cos(rad) + 0.24).toFixed(3)})`;
    }
    if (castL) {
      const on = moving && phiA > 90;
      castL.style.opacity = on ? (smooth(180, 164, phiA) * (0.4 + 0.6 * Math.sin(rad))).toFixed(3) : '0';
      castL.style.transform = `scaleX(${Math.max(0.06, -Math.cos(rad) + 0.24).toFixed(3)})`;
    }

    /* ---- the thickness of paper either side of the spine --------------- */
    if (stackR) stackR.style.transform = `translateX(${((L - t) * 1.3 + 1).toFixed(2)}px)`;
    if (stackL) stackL.style.transform = `translateX(${(-(t * 1.3) - 1).toFixed(2)}px)`;

    /* ---- the pages being read and uncovered ---------------------------- */
    const from = Math.abs(a - lastA) > 1 ? 0 : Math.max(0, a - 1);
    const to = Math.abs(a - lastA) > 1 ? L : Math.min(L, a + 2);
    lastA = a;

    for (let s = from; s <= to; s += 1) {
      const { left, right } = surfaces(s);
      const uncovering = s === a + 1;
      const r = uncovering ? p : 1;
      rise(right, r);
      rise(left, r);
      // The new left-hand photograph settles as its page lands; the one it
      // covers eases back a touch as it disappears under it.
      const settle = uncovering ? smooth(0.45, 1, p) : s === a ? 1 - 0.6 * smooth(0.5, 1, p) : 1;
      drift(left, t, s, settle);
      drift(right, t, s, uncovering ? smooth(0.1, 1, p) : 1);
    }

    /* ---- the furniture ------------------------------------------------- */
    const page = Math.round(t);
    if (page !== shown) {
      shown = page;
      onPage(page);
    }
    if (fill) fill.style.transform = `scaleX(${(t / L).toFixed(4)})`;
    if (cue) cue.style.opacity = String(1 - smooth(0.02, 0.3, t));
  };

  /* ---- the scroll ------------------------------------------------------ */
  const TOTAL = H0 + L * (TURN + HOLD);
  const proxy = { t: 0 };
  const rest = (s: number) => (s <= 0 ? H0 * 0.5 : H0 + s * (TURN + HOLD) - HOLD * 0.5);

  let direction = 1;
  let settleTimer = 0;
  let touching = false;

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: () => render(proxy.t),
    scrollTrigger: {
      trigger: scope,
      start: 'top top',
      end: () => `+=${Math.round(window.innerHeight * UNIT[mode] * TOTAL)}`,
      pin: true,
      pinSpacing: true,
      // Enough lag to give the paper weight, not so much it feels detached.
      scrub: 0.9,
      anticipatePin: 1,
      // The first pinned section on the page: measured before the ones below.
      refreshPriority: 1,
      onRefresh: () => {
        measure();
        render(proxy.t);
      },
      onUpdate: (self) => {
        direction = self.direction;
        scheduleSettle();
      },
    },
  });

  tl.to({}, { duration: H0 });
  for (let k = 0; k < L; k += 1) {
    tl.fromTo(proxy, { t: k }, { t: k + 1, duration: TURN, ease: 'power1.inOut', immediateRender: false });
    tl.to({}, { duration: HOLD });
  }

  const trigger = tl.scrollTrigger;
  if (!trigger) return;

  const at = (s: number) =>
    trigger.start + (trigger.end - trigger.start) * (gsap.utils.clamp(0, TOTAL, rest(s)) / TOTAL);
  run.current = { trigger, at };

  /* A page is never left standing on its edge. Once the scroll comes to
     rest part-way through a turn, the turn is finished in the direction the
     reader was going - a small nudge is enough to turn a page. */
  function settle() {
    if (touching || !trigger?.isActive) return;
    const into = trigger.progress * TOTAL - H0;
    if (into <= 0) return;
    const beat = TURN + HOLD;
    const k = Math.floor(into / beat);
    if (k >= L) return;
    const f = (into - k * beat) / TURN;
    if (f >= 1) return;
    const forward = direction >= 0 ? f > 0.1 : f > 0.9;
    scrollTo(at(forward ? k + 1 : k));
  }

  function scheduleSettle() {
    window.clearTimeout(settleTimer);
    if (!touching) settleTimer = window.setTimeout(settle, 170);
  }

  const onTouchStart = () => {
    touching = true;
    window.clearTimeout(settleTimer);
  };
  const onTouchEnd = () => {
    touching = false;
    scheduleSettle();
  };
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });

  render(proxy.t);

  /* ---- arrival: the book is set down on the desk ----------------------- */
  gsap.fromTo(
    tilt,
    { rotationX: 16, yPercent: 7, scale: 0.93 },
    {
      rotationX: 2.5,
      yPercent: 0,
      scale: 1,
      ease: 'none',
      scrollTrigger: { trigger: scope, start: 'top 92%', end: 'top top', scrub: 1 },
    },
  );
  gsap.fromTo(
    scope.querySelectorAll('[data-head]'),
    { y: 28, autoAlpha: 0 },
    {
      y: 0,
      autoAlpha: 1,
      stagger: 0.08,
      ease: 'none',
      scrollTrigger: { trigger: scope, start: 'top 80%', end: 'top 20%', scrub: 1 },
    },
  );

  /* ---- a hand near the book: it tips very slightly toward the pointer -- */
  let offPointer: (() => void) | undefined;
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const scene = scope.querySelector<HTMLElement>('.wb__scene');
    const rx = gsap.quickTo(float, 'rotationX', { duration: 1.4, ease: 'power3.out' });
    const ry = gsap.quickTo(float, 'rotationY', { duration: 1.4, ease: 'power3.out' });
    const onMove = (e: PointerEvent) => {
      if (!scene) return;
      const box = scene.getBoundingClientRect();
      const x = (e.clientX - (box.left + box.width / 2)) / box.width;
      const y = (e.clientY - (box.top + box.height / 2)) / box.height;
      ry(gsap.utils.clamp(-1, 1, x) * 3.2);
      rx(gsap.utils.clamp(-1, 1, y) * -2.4);
    };
    const onLeave = () => {
      rx(0);
      ry(0);
    };
    scene?.addEventListener('pointermove', onMove);
    scene?.addEventListener('pointerleave', onLeave);
    offPointer = () => {
      scene?.removeEventListener('pointermove', onMove);
      scene?.removeEventListener('pointerleave', onLeave);
    };
  }

  // A rebuild (a resize across the spread query) creates this pin after the
  // ones further down the page; re-measure once everything exists.
  const raf = requestAnimationFrame(() => ScrollTrigger.refresh());

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(settleTimer);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    offPointer?.();
    run.current = null;
    book.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
      if (el.matches('.wb-seg, .wb-face__page')) {
        el.style.removeProperty('transform');
      } else {
        el.style.removeProperty('transform');
        el.style.removeProperty('opacity');
        el.style.removeProperty('visibility');
        el.style.removeProperty('z-index');
      }
    });
  };
}

/* ==========================================================================
   The section
   ========================================================================== */

export function HomeWhy() {
  const wide = useMediaQuery(SPREAD_QUERY);
  const reduced = useReducedMotion();
  const mode: Mode = wide ? 'spread' : 'single';

  const [page, setPage] = useState(0);
  const run = useRef<Run | null>(null);
  const { scrollTo } = useSmoothScroll();

  const scope = useGsapScope<HTMLElement>(
    (_, el) => (reduced ? undefined : buildBook(el, mode, setPage, run, (y) => scrollTo(y))),
    [mode, reduced],
  );

  /* The book is the expensive part of this tree - thirty-odd printed pages -
     and a change of page number must not re-render it. */
  const book = useMemo(
    () => (reduced ? <StaticBooks mode={mode} /> : <Book mode={mode} />),
    [mode, reduced],
  );

  const goTo = (s: number) => {
    const current = run.current;
    if (!current) return;
    if (s >= SPREADS) {
      scrollTo(current.trigger.end + window.innerHeight);
      return;
    }
    scrollTo(current.at(gsap.utils.clamp(0, SPREADS - 1, s)));
  };

  const chapter = page > 0 ? REASONS[page - 1] : null;
  const last = page >= SPREADS - 1;

  return (
    <section
      ref={scope}
      className={`wb wb--${mode}${reduced ? ' wb--static' : ''}`}
      id="why"
      aria-labelledby="why-title"
    >
      <div className="wb__stage">
        <div className="wrap wb__inner">
          <header className="wb__head">
            <p className="wb__eyebrow" data-head>
              <b>02</b>
              <span className="wb__eyebrow-rule" aria-hidden="true" />
              Why choose us
            </p>
            <h2 className="wb__title" id="why-title" data-head>
              What makes this place <em>different?</em>
            </h2>
          </header>

          <p className="wb__meta" data-head>
            <span>Prospectus {ADMISSIONS_INTRO.session}</span>
            <span>
              Est. {SCHOOL.established} · {SCHOOL.locality}
            </span>
          </p>

          <div className="wb__scene" key={`${mode}-${reduced}`}>
            <div className="wb__float">
              <div className="wb__tilt">{book}</div>
            </div>
          </div>

          {!reduced && (
            <div className="wb__foot">
              <div className="wb__status">
                <p className="wb-cue" aria-hidden="true">
                  <span className="wb-cue__line" />
                  Scroll to explore
                </p>
                <p className={`wb-chapter${chapter ? ' is-on' : ''}`} aria-hidden="true" key={page}>
                  {chapter && (
                    <>
                      <b>{pad(page)}</b> {chapter.title}
                    </>
                  )}
                </p>
              </div>

              <div className="wb-count" aria-hidden="true">
                <span className="wb-count__roll">
                  <span className="wb-count__strip" style={{ transform: `translateY(${-page}em)` }}>
                    {Array.from({ length: SPREADS }, (_, s) => (
                      <span key={s}>{pad(s + 1)}</span>
                    ))}
                  </span>
                </span>
                <span className="wb-count__of">/ {pad(SPREADS)}</span>
                <span className="wb-count__track">
                  <span className="wb-count__fill" />
                </span>
              </div>

              <div className="wb-nav">
                <button
                  type="button"
                  className="wb-nav__btn"
                  onClick={() => goTo(page - 1)}
                  disabled={page === 0}
                  aria-label="Previous page"
                  data-cursor="link"
                >
                  <Icon name="arrowLeft" size={16} />
                </button>
                <button
                  type="button"
                  className="wb-nav__btn"
                  onClick={() => goTo(page + 1)}
                  aria-label={last ? 'Continue past the prospectus' : 'Next page'}
                  data-cursor="link"
                >
                  <Icon name={last ? 'arrowDown' : 'arrowRight'} size={16} />
                </button>
              </div>

              <p className="sr-only" aria-live="polite">
                Page {page + 1} of {SPREADS}
                {chapter ? `: ${chapter.title}` : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* The book, in words, once. */}
      <div className="sr-only">
        <p>{INTRO.lead}</p>
        <ol>
          {REASONS.map((reason) => (
            <li key={reason.id}>
              <h3>{reason.title}</h3>
              <p>{reason.description}</p>
              {reason.figures.map((figure) => (
                <p key={figure.label}>
                  {figure.value} - {figure.label}
                </p>
              ))}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
