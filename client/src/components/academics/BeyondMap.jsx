import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants';
import { beyondImages, resolve, resolveSet } from '@/constants/imagery';
import { Icon } from '@/components/common/Icon';
import { Hand } from '@/components/editorial';
import { useGsapScope } from '@/hooks/useGsapScope';
import { animateBeyond } from './beyond-motion';
import './beyond-map.css';

/* The node sits at (51, 38.5) with a radius of 5.5. Each line leaves its rim,
   bows slightly, and stops just short of its photograph. */
const EXPERIENCES = [
  {
    id: 'collaboration',
    index: '01',
    title: 'Collaboration',
    text: 'Working together and learning from each other.',
    icon: 'users',
    tone: 'sun',
    photo: beyondImages.collaboration,
    to: `${ROUTES.studentLife}#day`,
    note: 'share your perspective',
    layout: {
      photo: { x: 19, y: 21.5, w: 19, r: -2.5, ratio: 1.4, shape: '22% 10% 18% 8% / 26% 14% 24% 12%' },
      card: { x: 4.5, y: 28.5, w: 18.5, r: -2.2 },
      note: { x: 5.5, y: 22.4, r: -5, arrow: { x: 7.4, y: 2.2, w: 3.6, r: 38 } },
    },
    link: {
      d: 'M46.3 35.6 Q43.4 35.9 39.6 31.4',
      ghost: 'M46.1 35.95 Q43.1 36.35 39.85 31.8',
      mid: [43.2, 34.7],
      end: [39.6, 31.4],
    },
    float: [-1, 1],
    drift: 4,
  },
  {
    id: 'communication',
    index: '02',
    title: 'Communication',
    text: 'Expressing ideas clearly, listening with care.',
    icon: 'message',
    tone: 'blue',
    photo: beyondImages.communication,
    to: `${ROUTES.academics}#how-we-teach`,
    note: 'ideas, out loud',
    layout: {
      photo: { x: 56, y: 1.5, w: 16, r: 2, ratio: 0.84, shape: '10% 24% 9% 20% / 8% 18% 7% 16%' },
      card: { x: 69, y: 9.5, w: 18.5, r: 2.4 },
      note: { x: 77, y: 1.4, r: 4, arrow: { x: 1.2, y: 2.4, w: 3, r: 78 } },
    },
    link: {
      d: 'M53.8 33.8 Q58.9 29.5 60.5 22.6',
      ghost: 'M54.15 33.95 Q59.35 29.85 60.85 22.95',
      mid: [58, 28.9],
      end: [60.5, 22.6],
    },
    float: [1, -1],
    drift: -3,
  },
  {
    id: 'problem-solving',
    index: '03',
    title: 'Problem Solving',
    text: 'Asking better questions, testing real solutions.',
    icon: 'bulb',
    tone: 'green',
    photo: beyondImages.problemSolving,
    to: `${ROUTES.academics}#achievements`,
    note: 'learn by doing',
    layout: {
      photo: { x: 17, y: 45, w: 21.5, r: -1.5, ratio: 1.45, shape: '9% 20% 12% 26% / 12% 28% 16% 30%' },
      card: { x: 2.5, y: 51, w: 18.5, r: 1.6 },
      note: { x: 4, y: 44.2, r: -4, arrow: { x: 9.4, y: -0.6, w: 3.4, r: 6 } },
    },
    link: {
      d: 'M46.5 41.7 Q44.6 46.6 40 46.5',
      ghost: 'M46.8 41.95 Q45 47 40.2 46.9',
      mid: [43.9, 45.4],
      end: [40, 46.5],
    },
    float: [-1.5, 0.5],
    drift: 5,
  },
  {
    id: 'creativity',
    index: '04',
    title: 'Creativity',
    text: 'Turning imagination into projects and performances.',
    icon: 'edit',
    tone: 'coral',
    photo: beyondImages.creativity,
    to: `${ROUTES.studentLife}#beyond`,
    note: 'ideas become projects',
    layout: {
      photo: { x: 65, y: 34.5, w: 16, r: 2, ratio: 0.82, shape: '26% 12% 20% 10% / 20% 10% 18% 9%' },
      card: { x: 77, y: 43.5, w: 18.5, r: -2 },
      note: { x: 80.5, y: 59.5, r: 4, arrow: { x: -3.8, y: -3, w: 3.2, r: -118 } },
    },
    link: {
      d: 'M56 40.9 Q59.6 45.4 63.5 44.5',
      ghost: 'M56.2 41.3 Q59.9 45.9 63.7 44.9',
      mid: [59.7, 44.1],
      end: [63.5, 44.5],
    },
    float: [1, -0.5],
    drift: -3.5,
  },
];

/* The pen marks that belong to no one experience. */
const MARKS = [
  { kind: 'star', tone: 'sun', x: 52.2, y: 2.4, w: 2.2, r: 0 },
  { kind: 'sparks', tone: 'ink', x: 80.4, y: 30.6, w: 3, r: 18 },
  { kind: 'star', tone: 'sky', x: 40.4, y: 57.6, w: 1.8, r: 12 },
];

/* The imperfect ring, in the node's own 100-unit box: one pass that
   overshoots its start, and a lighter second pass that does not quite meet. */
const RING = 'M88 24C97 40 96 63 83 79 69 96 42 99 24 88 7 77 0 55 6 36 12 17 32 4 53 4 70 4 83 13 90 22';
const RING_GHOST = 'M13 30C22 12 44 5 62 8 82 12 96 30 95 52 94 74 76 94 52 95 30 96 10 82 5 60';

/* The dashed orbit, round the node at radius 8.5, in stage units. */
const ORBIT =
  'M59.6 37.6C59.9 42.6 55.9 47.2 50.6 47.1 45.6 47 42.3 43 42.4 38.4 42.5 33.4 46.3 29.9 51.2 30 56.4 30.1 59.2 33.3 59.8 36.9 59.9 37.8 59.8 38.9 59.5 39.8';

/** A spot as the custom properties the stylesheet reads: `--{key}x` and so on. */
const place = (key, { x, y, w, r }) => ({
  [`--${key}x`]: x,
  [`--${key}y`]: y,
  [`--${key}w`]: w,
  [`--${key}r`]: `${r}deg`,
});

export function AcBeyond() {
  const scope = useGsapScope((_, el) => animateBeyond(el), []);

  return (
    <section ref={scope} className="bm" id="future-skills" aria-labelledby="bm-title">
      <span className="bm__blob bm__blob--a" aria-hidden="true" />
      <span className="bm__blob bm__blob--b" aria-hidden="true" />
      <span className="bm__blob bm__blob--c" aria-hidden="true" />

      <div className="wrap">
        <div className="bm__stage" data-bm-stage>
          <header className="bm__copy">
            <p className="bm__eyebrow" data-bm-copy="head">
              <span className="bm__eyebrow-tab">Beyond the classroom</span>
            </p>
            <h2 className="bm__title" id="bm-title">
              <span className="bm__line" data-bm-copy="head">
                Learning that continues
              </span>
              <span className="bm__line" data-bm-copy="head">
                beyond the{' '}
                <em className="bm__em">
                  syllabus.
                  <Hand kind="swash" className="bm__swash" />
                </em>
              </span>
            </h2>
            <p className="bm__lead" data-bm-copy="lead">
              Education reaches well past textbooks and examinations. Our students explore ideas,
              build confidence, work together, make things and discover the world through
              experiences that shape who they become.
            </p>
          </header>

          <div className="bm__board">
            <MapLines />
            <Decor />
            <ThoughtNode />

            <ol className="bm__list">
              {EXPERIENCES.map((exp) => (
                <ExperienceItem exp={exp} key={exp.id} />
              ))}
            </ol>
          </div>

          <div className="bm__rail" aria-hidden="true" data-bm-rail-list>
            {EXPERIENCES.map((exp) => (
              <span className={`bm__rail-dot bm-tone--${exp.tone}`} data-bm-rail={exp.id} key={exp.id} />
            ))}
          </div>

          <p className="bm__foot" data-bm-foot>
            <Link className="bm__foot-link" to={ROUTES.studentLife}>
              <span className="bm__foot-disc" aria-hidden="true">
                <Icon name="arrowRight" size={16} />
              </span>
              See it on Student Life
            </Link>
            <span className="bm__foot-note">Every one has timetabled hours and a named teacher</span>
          </p>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   One experience: its thread (phones), note, print and card
   -------------------------------------------------------------------------- */

function ExperienceItem({ exp }) {
  const { photo, card, note } = exp.layout;

  const vars = {
    ...place('p', photo),
    ...place('c', card),
    '--ratio': photo.ratio,
    '--shape': photo.shape,
    '--nx': note.x,
    '--ny': note.y,
    '--nr': `${note.r}deg`,
  };

  return (
    <li
      className={`bm-exp bm-tone--${exp.tone}`}
      style={vars}
      data-bm-exp={exp.id}
      data-float={exp.float.join(' ')}
      data-drift={exp.drift}
    >
      <div className="bm-exp__thread" aria-hidden="true">
        <svg viewBox="0 0 40 96" focusable="false">
          <path d="M20 3c-5 14 6 26 1 42-3 11 2 22-1 38" pathLength={1} data-bm-thread />
          <circle className="bm-exp__knot" cx="20" cy="89" r="3" />
        </svg>
      </div>

      <p className="bm-note" aria-hidden="true" data-bm-note>
        <span>{exp.note}</span>
        <Hand
          kind="arrow"
          tone="ink"
          flip={note.arrow.flip}
          className="bm-note__arrow"
          style={place('a', note.arrow)}
        />
      </p>

      <figure className="bm-photo" data-bm-photo>
        <div className="bm-photo__body" data-bm-body>
          <span className="bm-photo__wash" aria-hidden="true" data-bm-wash />
          <div className="bm-photo__frame" data-bm-frame>
            <img
              src={resolve(exp.photo, 640)}
              srcSet={resolveSet(exp.photo, [420, 640, 960])}
              sizes="(min-width: 1180px) 22vw, (min-width: 760px) 42vw, 84vw"
              alt={exp.photo.alt}
              width={640}
              height={Math.round(640 / photo.ratio)}
              loading="lazy"
              decoding="async"
              style={exp.photo.focus ? { objectPosition: exp.photo.focus } : undefined}
            />
          </div>
        </div>
      </figure>

      <article className="bm-card" data-bm-card>
        <div className="bm-card__body" data-bm-card-body>
          <div className="bm-card__top">
            <span className="bm-card__icon" aria-hidden="true">
              <Icon name={exp.icon} />
            </span>
            <span className="bm-card__index" aria-hidden="true">
              {exp.index}
            </span>
          </div>
          <h3 className="bm-card__title">{exp.title}</h3>
          <p className="bm-card__text">{exp.text}</p>
          <Link className="bm-card__more" to={exp.to} aria-label={`Explore ${exp.title.toLowerCase()}`}>
            Explore
            <Icon name="arrowRight" />
          </Link>
        </div>
      </article>
    </li>
  );
}

/* --------------------------------------------------------------------------
   The thought node
   -------------------------------------------------------------------------- */

function ThoughtNode() {
  return (
    <div className="bm-node" aria-hidden="true" data-bm-node>
      {/* Tablet only: four short strokes pointing out at the grid's corners. */}
      <svg className="bm-node__spokes" viewBox="0 0 180 180" focusable="false" data-bm-spokes>
        <g className="bm-spoke bm-tone--sun">
          <path d="M55 57C47 50 38 41 24 29" pathLength={1} />
          <circle cx="21" cy="26" r="2.6" />
        </g>
        <g className="bm-spoke bm-tone--blue">
          <path d="M125 56C134 47 143 40 157 27" pathLength={1} />
          <circle cx="160" cy="24.5" r="2.6" />
        </g>
        <g className="bm-spoke bm-tone--green">
          <path d="M56 125C48 133 40 141 25 153" pathLength={1} />
          <circle cx="22" cy="155.5" r="2.6" />
        </g>
        <g className="bm-spoke bm-tone--coral">
          <path d="M124 124C132 131 141 140 156 152" pathLength={1} />
          <circle cx="159" cy="154.5" r="2.6" />
        </g>
      </svg>

      <div className="bm-node__core" data-bm-node-core>
        <svg className="bm-node__ring" viewBox="0 0 100 100" focusable="false" data-bm-ring>
          <path className="bm-node__pass" d={RING} pathLength={1} />
          <path className="bm-node__pass bm-node__pass--ghost" d={RING_GHOST} pathLength={1} />
        </svg>
        <p className="bm-node__words">
          <span data-bm-word>Beyond</span>
          <span data-bm-word>the</span>
          <span data-bm-word>Syllabus</span>
        </p>
        <span className="bm-node__tick" data-bm-word />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   The pencil layer: orbit, connectors, specks (wide screens only)
   -------------------------------------------------------------------------- */

function MapLines() {
  return (
    <svg className="bm-map" viewBox="0 0 100 66" aria-hidden="true" focusable="false" data-bm-map>
      <path className="bm-map__orbit" d={ORBIT} data-bm-orbit />
      {/* A looser line between the two right-hand experiences. */}
      <path className="bm-map__arc" d="M89.6 21.8C94.6 28 94.4 36.4 90.2 42.6" data-bm-speck />

      {EXPERIENCES.map(({ id, tone, link }) => (
        <g className={`bm-link bm-tone--${tone}`} data-bm-link={id} key={id}>
          <path className="bm-link__ghost" d={link.ghost} pathLength={1} data-bm-draw />
          <path className="bm-link__line" d={link.d} pathLength={1} data-bm-draw />
          <circle className="bm-link__halo" cx={link.end[0]} cy={link.end[1]} r="1.05" />
          <circle className="bm-link__mid" cx={link.mid[0]} cy={link.mid[1]} r="0.38" data-bm-dot />
          <circle className="bm-link__end" cx={link.end[0]} cy={link.end[1]} r="0.52" data-bm-dot />
        </g>
      ))}

      <g className="bm-specks">
        <circle className="bm-speck" cx="35" cy="19.6" r="0.3" data-bm-speck />
        <circle className="bm-speck bm-speck--open" cx="47.6" cy="24.6" r="0.7" data-bm-speck />
        <circle className="bm-speck bm-speck--coral" cx="62.8" cy="31.2" r="0.32" data-bm-speck />
        <circle className="bm-speck" cx="31.5" cy="41.6" r="0.26" data-bm-speck />
        <circle className="bm-speck bm-speck--open" cx="74.6" cy="28" r="0.55" data-bm-speck />
        <circle className="bm-speck bm-speck--sun" cx="93.9" cy="31.6" r="0.42" data-bm-speck />
        <circle className="bm-speck bm-speck--sun" cx="56.5" cy="58.4" r="0.3" data-bm-speck />
        <path className="bm-speck-x" d="M69.6 60.2l1.1 1.1M70.7 60.2l-1.1 1.1" data-bm-speck />
        <path className="bm-speck-x" d="M41.4 15.2l.9.9M42.3 15.2l-.9.9" data-bm-speck />
        <path className="bm-speck-x" d="M26.5 63.6c1-.8 1.8.8 2.8 0s1.8.8 2.8 0 1.8.8 2.8 0" data-bm-speck />
      </g>
    </svg>
  );
}

function Decor() {
  return (
    <div className="bm__decor" aria-hidden="true" data-bm-decor>
      {MARKS.map((mark) => (
        <Hand
          kind={mark.kind}
          tone={mark.tone}
          className="bm-mark"
          style={place('d', mark)}
          key={`${mark.kind}-${mark.x}`}
        />
      ))}

      <p
        className="bm-note bm-note--center"
        style={{ '--nx': 45.2, '--ny': 49, '--nr': '-3deg' }}
        data-bm-note
      >
        <span>curiosity in progress</span>
        <Hand
          kind="arrow"
          tone="ink"
          flip
          className="bm-note__arrow"
          style={place('a', { x: -2.6, y: -3.4, w: 2.8, r: 58 })}
        />
      </p>
    </div>
  );
}
