import { useMemo, useState } from 'react';
import { ADMISSIONS_INTRO, MILESTONES, SCHOOL, STATS, WHY_CHOOSE } from '@/constants';
import {
  academicImages,
  artsImages,
  beyondImages,
  everydayImages,
  resolve,
  resolveSet,
  sportsImages,
  studentImages,
} from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useMediaQuery, useReducedMotion } from '@/hooks/useMediaQuery';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import { Icon } from '@/components/common/Icon';
import './why-book.css';

const SPREAD_QUERY = '(min-width: 900px) and (min-aspect-ratio: 11/10)';

/** Page-width fractions of each hinged strip, spine to edge. */
const SEGMENTS = {
  spread: [0.44, 0.31, 0.25],
  single: [0.56, 0.44],
};

/** Extra rotation per strip at the height of the curl, in degrees. The sum
 *  must stay under 57, or the edge passes through the page it lands on. */
const CURL = {
  spread: [0, 16, 22],
  single: [0, 20],
};

/** Shear per strip at mid-turn, in degrees: the lower corner leads. */
const SKEW = {
  spread: [0, -0.5, -0.9],
  single: [0, -0.7],
};

/** Sheets in each side's text block. */
const SHEETS = 16;

/* Timeline units: a rest before the first turn, then per page one turn and
   one rest in which the spread lies open and can be read. */
const H0 = 0.3;
const TURN = 1;
const HOLD = 0.55;

/** Viewport heights of scroll per timeline unit. */
const UNIT = { spread: 0.62, single: 0.5 };

const reason = (id) => {
  const found = WHY_CHOOSE.find((item) => item.id === id);
  return { title: found?.title ?? '', description: found?.description ?? '' };
};

const CHAPTERS = [
  { id: 'results', label: 'Academics', icon: 'cap' },
  { id: 'known', label: 'Pastoral care', icon: 'users' },
  { id: 'breadth', label: 'Beyond the syllabus', icon: 'compass' },
  { id: 'honesty', label: 'Reporting', icon: 'document' },
  { id: 'legacy', label: 'Heritage', icon: 'history' },
];

const chapter = (id) => CHAPTERS.find((item) => item.id === id) ?? CHAPTERS[0];

/** What each spread is called. Read by the live region that announces a page
 *  turn; the icons are unused now that the visible indicator column is gone,
 *  and are kept only so the two lists cannot drift apart if it comes back. */
const INDEX = [
  { label: 'Contents', icon: 'book' },
  ...CHAPTERS.map(({ label, icon }) => ({ label, icon })),
];

const SPREADS = CHAPTERS.length + 1;
const LEAVES = SPREADS - 1;

const INTRO_LEAD =
  'Five answers, and every one of them is something you can check on a campus visit rather than something we can only assert here.';

const board = STATS.find((stat) => stat.suffix === '%');
const BOARD = board ? `${board.value}${board.suffix}` : '100%';

const [HONESTY_LEAD, ...honestyRest] = reason('honesty').description.split(/(?<=\.)\s+/);
const HONESTY_QUOTE = honestyRest.join(' ') || HONESTY_LEAD;

const TIMELINE = MILESTONES.filter((m) => ['1962', '1975', '1985', '2000', '2020'].includes(m.year));

const PHOTOS = {
  opening: everydayImages.deskGirls,
  results: everydayImages.reading,
  known: academicImages[0],
  knownInset: everydayImages.deskBoys,
  honesty: everydayImages.lesson,
  legacy: studentImages[5],
};

/** The four strands the breadth reason names, each with its icon and its evidence. */
const STRANDS = [
  { label: 'Robotics', icon: 'robot', photo: beyondImages.problemSolving },
  { label: 'Studio', icon: 'palette', photo: artsImages[1] },
  { label: 'Field', icon: 'ball', photo: sportsImages[0] },
  { label: 'Stage', icon: 'mic', photo: artsImages[3] },
];

const LEGACY_FIGURES = [
  { value: '64', label: 'Years' },
  { value: '10,000+', label: 'Alumni' },
  { value: '1,000+', label: 'Second-generation families' },
];

const est = `Est. ${SCHOOL.established}`;

/* ==========================================================================
   Printed parts
   ========================================================================== */

const SIZES = '(max-width: 899px) 90vw, 40vw';

/** An icon at the size of the type around it. */
function Glyph({ name, className = '' }) {
  return (
    <span className={`wb-ico ${className}`}>
      <Icon name={name} size={24} />
    </span>
  );
}

function Plate({ photo, className = '', width = 900 }) {
  return (
    <div className={`wb-plate ${className}`}>
      <img
        data-img
        src={resolve(photo, width)}
        srcSet={resolveSet(photo, [480, 900, 1300])}
        sizes={SIZES}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        style={photo.focus ? { objectPosition: photo.focus } : undefined}
      />
    </div>
  );
}

function Page({ side, variant, children }) {
  return (
    <div className={`wb-page wb-page--${side}${variant ? ` wb-page--${variant}` : ''}`}>
      <div className="wb-page__inner">{children}</div>
    </div>
  );
}

function Run({ left, right }) {
  return (
    <div className="wb-run">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

function Meta({ left, right, light }) {
  return (
    <div className={`wb-meta${light ? ' wb-meta--light' : ''}`}>
      <span>{left}</span>
      {right && <span>{right}</span>}
    </div>
  );
}

/** A short instruction or fact with its icon, printed inline. */
function Hint({ icon, label, after }) {
  return (
    <span className="wb-hint">
      {!after && <Glyph name={icon} />}
      {label}
      {after && <Glyph name={icon} />}
    </span>
  );
}

/** A chapter's mark: its icon in a ring, and its name beside it. */
function Mark({ id }) {
  const { icon, label } = chapter(id);
  return (
    <div className="wb-mark" data-rise>
      <span className="wb-ring">
        <Icon name={icon} size={24} />
      </span>
      <span className="wb-mark__label">{label}</span>
    </div>
  );
}

/** A photograph's caption, marked as one by the camera. */
function Caption({ photo }) {
  return (
    <p className="wb-cap" data-rise>
      <Glyph name="camera" />
      <span>{photo.alt}</span>
    </p>
  );
}

function Contents() {
  return (
    <ol className="wb-toc" data-rise>
      {CHAPTERS.map((item) => (
        <li key={item.id}>
          <Glyph name={item.icon} />
          <span className="wb-toc__t">{reason(item.id).title}</span>
        </li>
      ))}
    </ol>
  );
}

function BoardStats() {
  return (
    <div className="wb-stats" data-rise>
      <div className="wb-stat">
        <span className="wb-stat__v">{BOARD}</span>
        <span className="wb-stat__l">
          Board results
          <br />
          for 12 years
        </span>
      </div>
      <div className="wb-stat">
        <span className="wb-ring wb-ring--solid">
          <Icon name="users" size={24} />
        </span>
        <span className="wb-stat__l">
          Trained &amp; dedicated
          <br />
          teachers
        </span>
      </div>
    </div>
  );
}

function Mentors() {
  return (
    <div className="wb-fig" data-rise>
      <span className="wb-fig__v">1:18</span>
      <span className="wb-fig__l">
        <b>Mentor group ratio</b>
        <br />
        One named adult who calls home
      </span>
    </div>
  );
}

function Laboratories() {
  return (
    <div className="wb-fig" data-rise>
      <span className="wb-fig__v">11</span>
      <span className="wb-fig__l">
        <b>Laboratories</b>
        <br />
        Science, computing, robotics
      </span>
    </div>
  );
}

function Trio() {
  return (
    <div className="wb-trio" data-rise>
      {LEGACY_FIGURES.map((figure) => (
        <div key={figure.label}>
          <b>{figure.value}</b>
          <span>{figure.label}</span>
        </div>
      ))}
    </div>
  );
}

function StrandGrid() {
  return (
    <div className="wb-grid">
      {STRANDS.map((strand) => (
        <div className="wb-grid__cell" key={strand.label}>
          <Plate photo={strand.photo} className="wb-grid__plate" width={600} />
          <p className="wb-grid__cap" data-rise>
            <Glyph name={strand.icon} />
            {strand.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   The spreads - each one composed for its content
   ========================================================================== */

/** Left-hand page of spread `s`. */
function LeftPage({ s }) {
  switch (s) {
    /* The opening: a photograph, full bleed. */
    case 0:
      return (
        <Page side="l" variant="bleed">
          <Plate photo={PHOTOS.opening} className="wb-bleed" />
          <span className="wb-bleed__shade" />
          <Meta left={SCHOOL.name} right={est} light />
          <div className="wb-bleed__foot">
            <p className="wb-bleed__place" data-rise>
              {SCHOOL.locality}
            </p>
            <Meta
              left={`Prospectus ${ADMISSIONS_INTRO.session}`}
              right={<Hint icon="arrowRight" label="Turn the page" after />}
              light
            />
          </div>
        </Page>
      );

    /* Academics: a framed photograph and its caption. */
    case 1:
      return (
        <Page side="l">
          <Meta left={SCHOOL.name} right={est} />
          <Plate photo={PHOTOS.results} className="wb-frame" />
          <Caption photo={PHOTOS.results} />
        </Page>
      );

    /* Pastoral care: words first, and a figure. */
    case 2:
      return (
        <Page side="l">
          <Run left={SCHOOL.name} right={est} />
          <Mark id="known" />
          <p className="wb-h" data-rise>
            {reason('known').title}
          </p>
          <p className="wb-body" data-rise>
            {reason('known').description}
          </p>
          <Mentors />
        </Page>
      );

    /* Beyond the syllabus: words, the four strands, a figure. */
    case 3:
      return (
        <Page side="l">
          <Run left={SCHOOL.name} right={est} />
          <Mark id="breadth" />
          <p className="wb-h" data-rise>
            {reason('breadth').title}
          </p>
          <p className="wb-body" data-rise>
            {reason('breadth').description}
          </p>
          <ul className="wb-strands" data-rise>
            {STRANDS.map((strand) => (
              <li key={strand.label}>
                <Glyph name={strand.icon} />
                {strand.label}
              </li>
            ))}
          </ul>
          <Laboratories />
        </Page>
      );

    /* Reporting: one sentence, set large. */
    case 4:
      return (
        <Page side="l" variant="quote">
          <Run left={SCHOOL.name} right={est} />
          <span className="wb-quote__mark" data-rise />
          <p className="wb-quote" data-rise>
            {HONESTY_QUOTE}
          </p>
          <p className="wb-quote__src" data-rise>
            <Glyph name={chapter('honesty').icon} />
            {reason('honesty').title}
          </p>
        </Page>
      );

    /* Heritage: a photograph, full bleed, with the number over it. */
    default:
      return (
        <Page side="l" variant="bleed">
          <Plate photo={PHOTOS.legacy} className="wb-bleed" />
          <span className="wb-bleed__shade" />
          <Meta left={SCHOOL.name} right={est} light />
          <div className="wb-bleed__foot">
            <p className="wb-bleed__big" data-rise>
              64
            </p>
            <p className="wb-bleed__label" data-rise>
              Years on one campus
            </p>
            <Meta left={<Hint icon="pin" label={SCHOOL.locality} />} light />
          </div>
        </Page>
      );
  }
}

/** Right-hand page of spread `s`. */
function RightPage({ s }) {
  switch (s) {
    /* The opening: the heading and the contents. */
    case 0:
      return (
        <Page side="r">
          <Run left="Why choose us" right="Contents" />
          <p className="wb-eyebrow" data-rise>
            Why choose us
          </p>
          <p className="wb-display" data-rise>
            What makes this place different?
          </p>
          <p className="wb-lead" data-rise>
            {INTRO_LEAD}
          </p>
          <Contents />
        </Page>
      );

    /* Academics: the claim, and the evidence under it. */
    case 1:
      return (
        <Page side="r">
          <Run left="Why choose us" right={est} />
          <Mark id="results" />
          <p className="wb-h" data-rise>
            {reason('results').title}
          </p>
          <p className="wb-body" data-rise>
            {reason('results').description}
          </p>
          <BoardStats />
        </Page>
      );

    /* Pastoral care: a portrait, with a second print tipped in. */
    case 2:
      return (
        <Page side="r">
          <Meta left="Why choose us" right={est} />
          <div className="wb-portrait">
            <Plate photo={PHOTOS.known} className="wb-portrait__main" />
            <Plate photo={PHOTOS.knownInset} className="wb-portrait__inset" width={600} />
          </div>
          <Caption photo={PHOTOS.known} />
        </Page>
      );

    /* Beyond the syllabus: four prints, one per strand. */
    case 3:
      return (
        <Page side="r">
          <Meta left="Why choose us" right={est} />
          <StrandGrid />
        </Page>
      );

    /* Reporting: a photograph over the reason. */
    case 4:
      return (
        <Page side="r">
          <Meta left="Why choose us" right={est} />
          <Plate photo={PHOTOS.honesty} className="wb-frame" />
          <div className="wb-after">
            <Mark id="honesty" />
            <p className="wb-h" data-rise>
              {reason('honesty').title}
            </p>
            <p className="wb-body" data-rise>
              {HONESTY_LEAD}
            </p>
          </div>
        </Page>
      );

    /* Heritage: the record, as a timeline and three figures. */
    default:
      return (
        <Page side="r">
          <Run left="Why choose us" right={est} />
          <Mark id="legacy" />
          <p className="wb-h" data-rise>
            {reason('legacy').title}
          </p>
          <p className="wb-body" data-rise>
            {reason('legacy').description}
          </p>
          <ol className="wb-timeline" data-rise>
            {TIMELINE.map((milestone) => (
              <li key={milestone.year}>
                <span className="wb-timeline__y">{milestone.year}</span>
                <span className="wb-timeline__t">{milestone.title}</span>
              </li>
            ))}
          </ol>
          <Trio />
        </Page>
      );
  }
}

/** A phone's chapter heading: the chapter's icon beside the title. */
function Heading({ id }) {
  return (
    <div className="wb-head" data-rise>
      <span className="wb-ring">
        <Icon name={chapter(id).icon} size={24} />
      </span>
      <p className="wb-h">{reason(id).title}</p>
    </div>
  );
}

/** A phone's page for spread `s`: its own composition, not the spread. */
function SinglePage({ s }) {
  const meta = (id) => (
    <Meta
      left={SCHOOL.name}
      right={id ? <Hint icon={chapter(id).icon} label={chapter(id).label} /> : est}
    />
  );

  switch (s) {
    case 0:
      return (
        <Page side="single">
          {meta()}
          <Plate photo={PHOTOS.opening} className="wb-frame" />
          <p className="wb-eyebrow" data-rise>
            Why choose us
          </p>
          <p className="wb-display" data-rise>
            What makes this place different?
          </p>
          <p className="wb-lead" data-rise>
            {INTRO_LEAD}
          </p>
        </Page>
      );
    case 1:
      return (
        <Page side="single">
          {meta('results')}
          <Plate photo={PHOTOS.results} className="wb-frame" />
          <Heading id="results" />
          <p className="wb-body" data-rise>
            {reason('results').description}
          </p>
          <BoardStats />
        </Page>
      );
    case 2:
      return (
        <Page side="single">
          {meta('known')}
          <Plate photo={PHOTOS.known} className="wb-frame" />
          <Heading id="known" />
          <p className="wb-body" data-rise>
            {reason('known').description}
          </p>
          <Mentors />
        </Page>
      );
    case 3:
      return (
        <Page side="single">
          {meta('breadth')}
          <StrandGrid />
          <Heading id="breadth" />
          <p className="wb-body" data-rise>
            {reason('breadth').description}
          </p>
        </Page>
      );
    case 4:
      return (
        <Page side="single" variant="quote">
          {meta('honesty')}
          <span className="wb-quote__mark" data-rise />
          <p className="wb-quote" data-rise>
            {HONESTY_QUOTE}
          </p>
          <Heading id="honesty" />
          <p className="wb-body" data-rise>
            {HONESTY_LEAD}
          </p>
        </Page>
      );
    default:
      return (
        <Page side="single">
          {meta('legacy')}
          <Plate photo={PHOTOS.legacy} className="wb-frame" />
          <Heading id="legacy" />
          <p className="wb-body" data-rise>
            {reason('legacy').description}
          </p>
          <Trio />
        </Page>
      );
  }
}

/** The reverse of a phone's page, seen only while it turns away. */
function PaperBack() {
  return (
    <div className="wb-page wb-page--back">
      <div className="wb-page__inner" />
    </div>
  );
}

/* ==========================================================================
   The book
   ========================================================================== */

/** A side of the text block: real sheets, each a hair out of true. */
function Stack({ side }) {
  const seed = side === 'l' ? 7 : 3;
  return (
    <span className={`wb-stack wb-stack--${side}`}>
      {Array.from({ length: SHEETS }, (_, n) => {
        // Deepest sheet first, so each one is painted under the next.
        const i = SHEETS - 1 - n;
        const style = {
          '--i': i,
          '--jx': (((i * 37 + seed) % 7) - 3) * 0.14,
          '--jy': (((i * 23 + seed) % 5) - 2) * 0.12,
          '--jr': (((i * 53 + seed) % 5) - 2) * 0.025,
        };
        return <span className="wb-sheet" key={i} style={style} />;
      })}
    </span>
  );
}

function Leaf({ index, faces, mode }) {
  const segments = SEGMENTS[mode];

  const strip = (j, from) => {
    const to = from + segments[j];
    const last = j === segments.length - 1;
    return (
      <div className="wb-seg" style={{ '--seg-w': segments[j] }}>
        <div className="wb-face wb-face--front">
          <div className="wb-face__page" style={{ '--x': from }}>
            {faces.front}
          </div>
          <span className="wb-face__shade" />
        </div>
        <div className="wb-face wb-face--back">
          <div className="wb-face__page" style={{ '--x': 1 - to }}>
            {faces.back}
          </div>
          <span className="wb-face__shade" />
        </div>
        {last ? <span className="wb-leaf__edge" /> : strip(j + 1, to)}
      </div>
    );
  };

  return (
    <div className="wb-leaf" data-leaf={index}>
      {strip(0, 0)}
    </div>
  );
}

function Book({ mode }) {
  const single = mode === 'single';
  const leaves = Array.from({ length: LEAVES }, (_, k) => ({
    k,
    faces: single
      ? { front: <SinglePage s={k} />, back: <PaperBack /> }
      : { front: <RightPage s={k} />, back: <LeftPage s={k + 1} /> },
  }));

  return (
    <div className={`wb-book wb-book--${mode}`} aria-hidden="true">
      <span className="wb-book__contact" />

      <span className="wb-cover">
        {!single && <span className="wb-cover__board wb-cover__board--l" />}
        <span className="wb-cover__board wb-cover__board--r" />
        <span className="wb-cover__spine" />
      </span>

      {!single && <Stack side="l" />}
      <Stack side="r" />
      <span className="wb-ribbon" />

      {!single && (
        <div className="wb-book__base wb-book__base--l">
          <LeftPage s={0} />
        </div>
      )}
      <div className="wb-book__base wb-book__base--r">
        {single ? <SinglePage s={LEAVES} /> : <RightPage s={LEAVES} />}
      </div>

      {/* Reversed, so before the module runs the natural stacking order
          already has the first leaf on top. */}
      {[...leaves].reverse().map(({ k, faces }) => (
        <Leaf key={k} index={k} faces={faces} mode={mode} />
      ))}

      <span className="wb-book__grain" />
      <span className="wb-book__gutter" />
      <span className="wb-book__cast wb-book__cast--r" />
      {!single && <span className="wb-book__cast wb-book__cast--l" />}
    </div>
  );
}

/** Reduced motion: every spread printed flat, in order. */
function StaticBooks({ mode }) {
  return (
    <div className="wb-static" aria-hidden="true">
      {Array.from({ length: SPREADS }, (_, s) => (
        <div className={`wb-book wb-book--${mode} wb-book--static`} key={s}>
          <span className="wb-cover">
            {mode === 'spread' && <span className="wb-cover__board wb-cover__board--l" />}
            <span className="wb-cover__board wb-cover__board--r" />
            <span className="wb-cover__spine" />
          </span>
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
          <span className="wb-book__gutter" />
        </div>
      ))}
    </div>
  );
}

const smooth = (lo, hi, v) => {
  const x = gsap.utils.clamp(0, 1, (v - lo) / (hi - lo));
  return x * x * (3 - 2 * x);
};

function collect(pages) {
  const rise = [];
  const img = [];
  pages.forEach((page) => {
    page.querySelectorAll('[data-rise]').forEach((el, i) => rise.push({ el, i }));
    page.querySelectorAll('[data-img]').forEach((el) => img.push(el));
  });
  return { rise, img };
}

function buildBook(
  scope,
  mode,
  onPage,
  scrollTo,
) {
  const book = scope.querySelector('.wb-book');
  const tilt = scope.querySelector('.wb__tilt');
  if (!book || !tilt) return;

  const single = mode === 'single';
  const curl = CURL[mode];
  const skew = SKEW[mode];

  const leafEls = gsap.utils
    .toArray('.wb-leaf', book)
    .sort((a, b) => Number(a.dataset.leaf) - Number(b.dataset.leaf));
  const L = leafEls.length;
  if (L !== LEAVES) return;

  const leaves = leafEls.map((el) => {
    const segs = Array.from(el.querySelectorAll('.wb-seg'));
    return {
      el,
      segs,
      shadeF: segs.map((seg) => seg.querySelector(':scope > .wb-face--front > .wb-face__shade')),
      shadeB: segs.map((seg) => seg.querySelector(':scope > .wb-face--back > .wb-face__shade')),
      front: collect(Array.from(el.querySelectorAll('.wb-face--front > .wb-face__page'))),
      back: collect(Array.from(el.querySelectorAll('.wb-face--back > .wb-face__page'))),
    };
  });

  const empty = { rise: [], img: [] };
  const baseL = book.querySelector('.wb-book__base--l');
  const baseR = book.querySelector('.wb-book__base--r');
  const baseLS = baseL ? collect([baseL]) : empty;
  const baseRS = baseR ? collect([baseR]) : empty;
  const castR = book.querySelector('.wb-book__cast--r');
  const castL = book.querySelector('.wb-book__cast--l');
  const cue = scope.querySelector('.wb-cue');

  /** The printed surfaces of spread `s`. */
  const surfaces = (s) => {
    const right = s < L ? leaves[s].front : baseRS;
    const left = single ? empty : s === 0 ? baseLS : leaves[s - 1].back;
    return { left, right };
  };

  /* Both of these write only when a value actually changes, and only 2D
     transforms: everything they touch is printed inside a turning strip, so
     every write repaints that strip, and a 3D transform would promote the
     element to a layer of its own in every copy of the page. */
  const written = new WeakMap();
  const write = (el, transform, opacity) => {
    const key = `${transform}|${opacity}`;
    if (written.get(el) === key) return;
    written.set(el, key);
    el.style.transform = transform;
    el.style.opacity = opacity;
  };

  const rise = (surface, r) => {
    surface.rise.forEach(({ el, i }) => {
      const lo = 0.3 + 0.06 * Math.min(i, 6);
      const k = smooth(lo, Math.min(1, lo + 0.42), r);
      if (k >= 1) write(el, '', '');
      else write(el, `translate(0, ${((1 - k) * 14).toFixed(1)}px)`, (0.15 + 0.85 * k).toFixed(2));
    });
  };

  /** A photograph settling as its page lands: 0 slightly enlarged, 1 at rest. */
  const land = (surface, k) => {
    const transform = k >= 1 ? '' : `scale(${(1 + 0.08 * (1 - k)).toFixed(3)})`;
    surface.img.forEach((img) => write(img, transform, ''));
  };

  let perspective = 1800;
  const measure = () => {
    perspective = Math.max(1000, leafEls[0].offsetWidth * 3);
  };
  measure();

  /* One timeline per leaf, played in sequence by the section's timeline. */
  const state = leaves.map(() => ({ p: 0 }));
  let shown = -1;
  let lastA = -1;

  const render = () => {
    let t = 0;
    state.forEach((leaf) => {
      t += leaf.p;
    });
    const a = Math.min(Math.floor(t + 1e-6), L - 1);
    const p = gsap.utils.clamp(0, 1, t - a);

    /* ---- the leaves ---------------------------------------------------- */
    leaves.forEach((leaf, k) => {
      const prog = k < a ? 1 : k > a ? 0 : p;
      const turning = prog > 0 && prog < 1;
      const visible = Math.abs(k - a) <= 1 && !(single && prog >= 1);

      leaf.el.style.visibility = visible ? '' : 'hidden';
      leaf.el.style.zIndex = String(turning ? 100 : prog >= 0.5 ? 10 + 2 * k : 10 + 2 * (L - k));
      if (!visible) return;

      const lift = Math.sin(prog * Math.PI);
      // Edge leads on the way up; it floats down last.
      const bend = Math.sin(prog * Math.PI * 2) * (prog < 0.5 ? 1 : 0.55);
      let phi = 180 * prog;

      leaf.segs.forEach((seg, j) => {
        if (j === 0) {
          seg.style.transform =
            `perspective(${perspective.toFixed(0)}px) translate3d(0, 0, ${(lift * 14).toFixed(2)}px) ` +
            `rotateY(${(-180 * prog).toFixed(3)}deg) rotateX(${(lift * 1.3).toFixed(3)}deg)`;
        } else {
          const extra = (curl[j] ?? 0) * bend;
          phi += extra;
          seg.style.transform =
            `rotateY(${(-extra).toFixed(3)}deg) skewY(${((skew[j] ?? 0) * lift).toFixed(3)}deg)`;
        }

        const light = Math.sin((gsap.utils.clamp(0, 180, phi) * Math.PI) / 180);
        const front = leaf.shadeF[j];
        const back = leaf.shadeB[j];
        if (front) front.style.opacity = phi < 90 ? (light * 0.95).toFixed(3) : '1';
        if (back) back.style.opacity = phi > 90 ? (light * 0.95).toFixed(3) : '1';
      });

      leaf.el.style.opacity = single ? String(1 - smooth(0.58, 0.9, prog)) : '';
    });

    /* ---- the shadow of the moving page --------------------------------- */
    const phiA = 180 * p;
    const rad = (phiA * Math.PI) / 180;
    const moving = p > 0 && p < 1;
    if (castR) {
      castR.style.opacity =
        moving && phiA < 90 ? (smooth(0, 16, phiA) * (0.4 + 0.6 * Math.sin(rad))).toFixed(3) : '0';
      castR.style.transform = `scaleX(${Math.max(0.06, Math.cos(rad) + 0.26).toFixed(3)})`;
    }
    if (castL) {
      castL.style.opacity =
        moving && phiA > 90 ? (smooth(180, 164, phiA) * (0.4 + 0.6 * Math.sin(rad))).toFixed(3) : '0';
      castL.style.transform = `scaleX(${Math.max(0.06, -Math.cos(rad) + 0.26).toFixed(3)})`;
    }

    /* ---- the pages being read and uncovered ---------------------------- */
    const jump = Math.abs(a - lastA) > 1;
    const from = jump ? 0 : Math.max(0, a - 1);
    const to = jump ? L : Math.min(L, a + 2);
    lastA = a;

    for (let s = from; s <= to; s += 1) {
      const { left, right } = surfaces(s);
      const uncovering = s === a + 1;
      const r = uncovering ? p : 1;
      rise(right, r);
      rise(left, r);
      land(left, uncovering ? smooth(0.45, 1, p) : 1);
      land(right, uncovering ? smooth(0.1, 1, p) : 1);
    }

    /* ---- the furniture ------------------------------------------------- */
    const page = Math.round(t);
    if (page !== shown) {
      shown = page;
      onPage(page);
    }
    if (cue) cue.style.opacity = String(1 - smooth(0.02, 0.3, t));
  };

  /* ---- the scroll ------------------------------------------------------ */
  const TOTAL = H0 + L * (TURN + HOLD);
  const rest = (s) => (s <= 0 ? H0 * 0.5 : H0 + s * (TURN + HOLD) - HOLD * 0.5);

  let direction = 1;
  let settleTimer = 0;
  let touching = false;

  const master = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: render,
    scrollTrigger: {
      trigger: scope,
      start: 'top top',
      end: () => `+=${Math.round(window.innerHeight * UNIT[mode] * TOTAL)}`,
      pin: true,
      pinSpacing: true,
      scrub: 0.9,
      anticipatePin: 1,
      refreshPriority: 1,
      onRefresh: () => {
        measure();
        render();
      },
      onUpdate: (self) => {
        direction = self.direction;
        scheduleSettle();
      },
    },
  });

  master.to({}, { duration: H0 });
  state.forEach((leaf) => {
    const turn = gsap.timeline();
    turn.fromTo(leaf, { p: 0 }, { p: 1, duration: TURN, ease: 'power1.inOut', immediateRender: false });
    master.add(turn).to({}, { duration: HOLD });
  });

  const trigger = master.scrollTrigger;
  if (!trigger) return;

  const at = (s) =>
    trigger.start + (trigger.end - trigger.start) * (gsap.utils.clamp(0, TOTAL, rest(s)) / TOTAL);

  /* A page is never left standing on its edge: once the scroll rests part
     way through a turn, the turn completes in the direction of travel. */
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

  render();

  /* ---- arrival: the book comes up from below and settles --------------- */
  gsap.fromTo(
    tilt,
    { rotationX: 24, yPercent: 12, scale: 0.94 },
    {
      rotationX: 7,
      yPercent: 0,
      scale: 1,
      ease: 'none',
      scrollTrigger: { trigger: scope, start: 'top 95%', end: 'top top', scrub: 1 },
    },
  );
  gsap.fromTo(
    scope.querySelectorAll('[data-head]'),
    { y: 16, autoAlpha: 0 },
    {
      y: 0,
      autoAlpha: 1,
      ease: 'none',
      scrollTrigger: { trigger: scope, start: 'top 70%', end: 'top 15%', scrub: 1 },
    },
  );

  // A rebuild creates this pin after the ones below it; re-measure once.
  const raf = requestAnimationFrame(() => ScrollTrigger.refresh());

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(settleTimer);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    book.querySelectorAll('.wb-leaf, .wb-seg, .wb-face__shade, [data-rise], [data-img], .wb-book__cast').forEach((el) => {
      el.style.removeProperty('transform');
      el.style.removeProperty('opacity');
      el.style.removeProperty('visibility');
      el.style.removeProperty('z-index');
    });
  };
}

/* ==========================================================================
   The section
   ========================================================================== */

export function HomeWhy() {
  const wide = useMediaQuery(SPREAD_QUERY);
  const reduced = useReducedMotion();
  const mode = wide ? 'spread' : 'single';

  const [page, setPage] = useState(0);
  const { scrollTo } = useSmoothScroll();

  const scope = useGsapScope(
    (_, el) => (reduced ? undefined : buildBook(el, mode, setPage, (y) => scrollTo(y))),
    [mode, reduced],
  );

  /* Thirty-odd printed pages: a change of page must not re-render them. */
  const book = useMemo(
    () => (reduced ? <StaticBooks mode={mode} /> : <Book mode={mode} />),
    [mode, reduced],
  );

  const current = INDEX[page] ?? INDEX[0];
  const title = page > 0 ? reason(CHAPTERS[page - 1].id).title : '';

  return (
    <section
      ref={scope}
      className={`wb wb--${mode}${reduced ? ' wb--static' : ''}`}
      id="why"
      aria-labelledby="why-title"
    >
      <div className="wb__stage">
        <div className="wrap wb__inner">
          <header className="wb__head" data-head>
            <p className="wb__eyebrow">
              <span className="wb__eyebrow-ico" aria-hidden="true">
                <Icon name="book" size={16} />
              </span>
              Why choose us
            </p>
            <h2 className="sr-only" id="why-title">
              What makes this place different?
            </h2>
            <p className="wb__edition">
              {SCHOOL.name} · Prospectus {ADMISSIONS_INTRO.session}
            </p>
          </header>

          <div className="wb__scene" key={`${mode}-${reduced}`}>
            <div className="wb__float">
              <div className="wb__tilt">{book}</div>
            </div>
          </div>

          {!reduced && (
            <>
              <p className="wb-cue" aria-hidden="true">
                <span className="wb-cue__line" />
                Scroll to turn the page
              </p>

              {/* The visible chapter indicator that used to sit down the right
                  edge has been removed. The book's own spreads say where the
                  reader is, and a second, permanent column of icons beside
                  them was one piece of furniture too many. The live region
                  below is NOT its replacement and is not optional: it is how
                  a screen reader learns the page turned at all, since the
                  turn itself is a scroll-scrubbed animation. */}
              <p className="sr-only" aria-live="polite">
                {current.label}
                {title ? `: ${title}` : ''}
              </p>
            </>
          )}
        </div>
      </div>

      {/* The book, in words, once. */}
      <div className="sr-only">
        <p>{INTRO_LEAD}</p>
        <ul>
          {CHAPTERS.map((item) => (
            <li key={item.id}>
              <h3>
                {item.label}: {reason(item.id).title}
              </h3>
              <p>{reason(item.id).description}</p>
            </li>
          ))}
        </ul>
        <p>
          {BOARD} board results for 12 years. Trained and dedicated teachers. Mentor group ratio
          1:18. 11 laboratories. 64 years, 10,000+ alumni and 1,000+ second-generation families.
        </p>
      </div>
    </section>
  );
}
