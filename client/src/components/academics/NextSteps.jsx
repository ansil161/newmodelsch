import { Link } from 'react-router-dom';
import { NEXT_STEPS, ROUTES } from '@/constants';
import { nextStepImages, resolve, resolveSet } from '@/constants/imagery';
import { Icon } from '@/components/common/Icon';
import { Hand } from '@/components/editorial';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import './next-steps.css';

/* The three stream names, read from the counselling data rather than typed
   again, so the card cannot drift from the record. */
const STREAMS = NEXT_STEPS.map((step) => step.name.split(' ')[0]);

const PATHS = [
  {
    id: 'senior-secondary',
    index: '01',
    title: 'Senior Secondary',
    kicker: 'Academic pathways',
    text: `${STREAMS.slice(0, -1).join(', ')} or ${STREAMS[STREAMS.length - 1]}: subject choices, preparation and the move to Class 11.`,
    to: `${ROUTES.academics}#curriculum`,
    icon: 'book',
    tone: 'lav',
    photo: nextStepImages.seniorSecondary,
    from: 'right',
  },
  {
    id: 'higher-education',
    index: '02',
    title: 'Higher Education',
    kicker: 'University pathways',
    text: 'Courses, entrance routes and applications, mapped while there is still time to prepare.',
    to: `${ROUTES.about}#alumni`,
    icon: 'globe',
    tone: 'sun',
    photo: nextStepImages.higherEducation,
    from: 'left',
  },
  {
    id: 'career-pathways',
    index: '03',
    title: 'Career Pathways',
    kicker: 'Explore possibilities',
    text: 'Career guidance, skills and real-world direction from the Class 9 and 10 counselling.',
    to: `${ROUTES.academics}#future-skills`,
    icon: 'compass',
    tone: 'green',
    photo: nextStepImages.careers,
    from: 'right',
  },
  {
    id: 'beyond-academics',
    index: '04',
    title: 'Beyond Academics',
    kicker: 'Life beyond the classroom',
    text: 'Leadership, activities and experiences that grow the whole person.',
    to: ROUTES.studentLife,
    icon: 'star',
    tone: 'blue',
    photo: nextStepImages.beyond,
    from: 'bottom',
  },
];

export function AcNext() {
  const { scrollTo } = useSmoothScroll();

  const toPaths = (event) => {
    event.preventDefault();
    scrollTo('#next-paths', -96);
  };

  return (
    <section className="nx" id="after-ten" aria-labelledby="nx-title">
      <span className="nx__corner nx__corner--tr" aria-hidden="true" data-nx-shape />
      <span className="nx__corner nx__corner--bl" aria-hidden="true" data-nx-shape />
      <Sprig />

      <div className="wrap">
        <div className="nx__stage">
          <header className="nx__copy">
            <p className="nx__eyebrow">Next Steps</p>
            <h2 className="nx__title" id="nx-title" data-nx-lines>
              Your next chapter
              <br />
              <span className="nx__script">
                starts
                <Hand kind="swash" className="nx__swash" />
              </span>{' '}
              here.
            </h2>
            <p className="nx__lead">
              The school ends at Class 10; the advice does not. Four directions a leaver can take,
              and the conversation behind each.
            </p>
            <a className="nx__cta" href="#next-paths" onClick={toPaths}>
              <span className="nx__cta-disc" aria-hidden="true">
                <Icon name="arrowRight" size={16} />
              </span>
              <span className="nx__cta-label">
                Explore
                <br />
                Next Steps
              </span>
            </a>
          </header>

          <p className="nx__counter" aria-hidden="true">
            01 <i /> 04
          </p>

          <figure className="nx__hero" data-nx-hero>
            <span className="nx__blob" aria-hidden="true" data-nx-shape />
            <Orbit />
            <div className="nx__photo">
              <img
                src={resolve(nextStepImages.hero, 960)}
                srcSet={resolveSet(nextStepImages.hero, [640, 960, 1280])}
                sizes="(min-width: 1180px) 36vw, 78vw"
                alt={nextStepImages.hero.alt}
                width={960}
                height={960}
                loading="lazy"
                decoding="async"
                style={{ objectPosition: nextStepImages.hero.focus }}
              />
            </div>
            <div className="nx__badge" data-nx-badge>
              <span>Next</span>
              <span>Step</span>
            </div>
            <figcaption className="nx__badge-label">Your journey</figcaption>
          </figure>

          <ol className="nx__paths" id="next-paths">
            {PATHS.map((path, i) => (
              <PathCard path={path} slot={i + 1} key={path.id} />
            ))}
          </ol>

          <div className="nx__rail" aria-hidden="true">
            <span />
            <b />
            <span className="is-on" />
            <b />
            <span />
            <span />
          </div>

          <p className="nx__foot" aria-hidden="true">
            Your future <i /> Our guidance
          </p>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   A path panel
   -------------------------------------------------------------------------- */

function PathCard({ path, slot }) {
  return (
    <li
      className={`nx-card nx-card--${path.tone} nx-card--s${slot}`}
      data-nx-card
      data-from={path.from}
    >
      <div className="nx-card__panel">
        <div className="nx-card__photo">
          <img
            src={resolve(path.photo, 320)}
            srcSet={resolveSet(path.photo, [240, 320, 480])}
            sizes="(min-width: 1180px) 15vw, 180px"
            alt={path.photo.alt}
            width={320}
            height={320}
            loading="lazy"
            decoding="async"
            style={path.photo.focus ? { objectPosition: path.photo.focus } : undefined}
          />
        </div>
        <span className="nx-card__icon" aria-hidden="true">
          <Icon name={path.icon} />
        </span>

        <p className="nx-card__num">{path.index}</p>
        <h3 className="nx-card__title">{path.title}</h3>
        <p className="nx-card__kicker">{path.kicker}</p>
        <p className="nx-card__text">{path.text}</p>
        <Link className="nx-card__more" to={path.to} aria-label={`Learn more about ${path.title}`}>
          Learn more
          <Icon name="arrowRight" />
        </Link>
      </div>
    </li>
  );
}

/* --------------------------------------------------------------------------
   The orbit
   --------------------------------------------------------------------------
   Drawn in the portrait's own units: the photograph is the circle at
   (50, 50) with radius 50, and the view box runs 22 units past it on every
   side. Node and tick positions are points on those rings, worked out once.
   -------------------------------------------------------------------------- */

function Orbit() {
  return (
    <svg className="nx__orbit" viewBox="-22 -22 144 144" aria-hidden="true" focusable="false" data-nx-orbit>
      <circle className="nx__ring" cx="50" cy="50" r="61" data-nx-ring />
      <circle className="nx__ring nx__ring--dash" cx="53" cy="47.5" r="67" data-nx-ring />
      <path className="nx__ring nx__ring--arc" d="M77.5 2.4 A55 55 0 0 1 101.7 31.2" data-nx-ring />

      {/* ticks, with their micro-labels */}
      <path className="nx__tick" d="M18.5 4.5 L13 -2.8" />
      <text className="nx__micro" x="10.5" y="-5.5" textAnchor="end">
        CLASS 10
      </text>
      <path className="nx__tick" d="M103.8 70.3 L110.8 73" />
      <text className="nx__micro" x="113" y="69.5">
        CLASS 11
      </text>

      {/* the connector toward the lower-right path */}
      <path className="nx__ring nx__ring--dash" d="M96.7 89.2 L108 98.6" />

      <circle className="nx__halo nx__halo--lav" cx="29.1" cy="-7.3" r="3" data-nx-node />
      <circle className="nx__node nx__node--lav" cx="29.1" cy="-7.3" r="1.35" data-nx-node />
      <circle className="nx__node nx__node--sun" cx="-7.3" cy="29.1" r="1.3" data-nx-node />
      <circle className="nx__halo nx__halo--green" cx="106.6" cy="72.9" r="3.1" data-nx-node />
      <circle className="nx__node nx__node--green" cx="106.6" cy="72.9" r="1.5" data-nx-node />
      <circle className="nx__node nx__node--coral" cx="12.4" cy="98.1" r="1" data-nx-node />
      <circle className="nx__node nx__node--ink" cx="104.3" cy="4.4" r="0.9" data-nx-node />
    </svg>
  );
}

/* --------------------------------------------------------------------------
   The sprig, bottom right - line-drawn, the weight of a pencil
   -------------------------------------------------------------------------- */

function Sprig() {
  return (
    <svg className="nx__sprig" viewBox="0 0 120 170" aria-hidden="true" focusable="false" data-nx-shape>
      <path d="M58 168 C57 128 63 86 86 30" />
      <path d="M61 130 C44 124 32 110 29 93 C46 97 58 111 61 130 Z" />
      <path d="M61 130 L36 99" />
      <path d="M63 108 C80 102 92 88 95 71 C79 75 67 89 63 108 Z" />
      <path d="M63 108 L89 78" />
      <path d="M68 86 C52 78 44 62 45 47 C60 53 68 69 68 86 Z" />
      <path d="M68 86 L49 54" />
      <path d="M76 60 C92 52 100 38 101 23 C87 29 79 43 76 60 Z" />
      <path d="M76 60 L97 30" />
      <path d="M84 36 C76 26 74 14 78 3 C86 11 88 23 84 36 Z" />
      <path d="M44 168 C44 150 40 136 26 124" />
      <path d="M42 146 C30 146 20 140 16 130 C28 129 38 135 42 146 Z" />
    </svg>
  );
}
