import { Link } from 'react-router-dom';
import { PRINCIPAL, ROUTES, STATS } from '@/constants';
import { facultyImages } from '@/constants/imagery';
import { Icon } from '@/components/common/Icon';
import { Figure } from '@/components/editorial';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import './principal-message.css';

const [years, results, , alumni] = STATS;
const figure = (stat) =>
  `${stat.value.toLocaleString('en-IN')}${stat.suffix}`;

const FACTS = [
  { icon: 'calendar', value: `Since ${PRINCIPAL.since}`, label: 'Principal of the school' },
  { icon: 'history', value: `${figure(years)} ${years.label}`, label: years.detail },
  { icon: 'cap', value: `${figure(results)} ${results.label}`, label: results.detail },
  { icon: 'users', value: `${figure(alumni)} ${alumni.label}`, label: alumni.detail },
];

export function PrincipalMessage({ paragraphs, showMore = false }) {
  const letter = PRINCIPAL.letter.slice(0, paragraphs ?? PRINCIPAL.letter.length);

  const scope = useGsapScope((_, el) => {
    if (reduced()) return;

    const q = (selector) => el.querySelector(selector);
    const qa = (selector) => el.querySelectorAll(selector);

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      scrollTrigger: { trigger: el, start: 'top 75%', once: true },
    });

    // The portrait: the frame rises and fades up, the mask opens from the
    // bottom edge, and the photograph settles inside it.
    tl.fromTo(
      q('.pmsg__media'),
      { autoAlpha: 0, y: 40 },
      { autoAlpha: 1, y: 0, duration: 1.15, ease: 'expo.out' },
      0,
    )
      .fromTo(
        q('.pmsg__fig'),
        { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power4.inOut', clearProps: 'clipPath' },
        0,
      )
      .fromTo(q('.pmsg__fig img'), { scale: 1.04 }, { scale: 1, duration: 1.6, ease: 'power2.out' }, 0);

    // The text column, in the order it is read.
    tl.fromTo(q('.pmsg__eyebrow'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.1)
      .fromTo(q('.pmsg__title'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1 }, 0.2)
      .fromTo(
        qa('.pmsg__text > p'),
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1 },
        0.35,
      )
      .fromTo(
        qa('.pmsg__fact'),
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 },
        0.5,
      )
      .fromTo(q('.pmsg__close'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 0.75);
  }, []);

  return (
    <section ref={scope} className="pmsg ground-cloth" id="principal" aria-labelledby="pmsg-title">
      <div className="wrap pmsg__inner">
        <div className="pmsg__media">
          <Figure
            photo={facultyImages[0]}
            width={720}
            widths={[480, 720, 1080]}
            sizes="(max-width: 767px) 92vw, (max-width: 1280px) 46vw, 590px"
            shape="square"
            ratio="free"
            className="pmsg__fig"
          />
        </div>

        <div className="pmsg__body">
          <p className="pmsg__eyebrow">
            <span className="pmsg__eyebrow-rule" aria-hidden="true" />
            Message from the principal
          </p>

          <h2 className="pmsg__title" id="pmsg-title">
            A Message from Our Principal
          </h2>

          <div className="pmsg__text">
            {letter.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </div>

          <ul className="pmsg__facts">
            {FACTS.map((fact) => (
              <li className="pmsg__fact" key={fact.icon}>
                <span className="pmsg__fact-icon" aria-hidden="true">
                  <Icon name={fact.icon} size={16} />
                </span>
                <span className="pmsg__fact-text">
                  <b>{fact.value}</b>
                  <span>{fact.label}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="pmsg__close">
            <p className="pmsg__close-label">Leading with purpose</p>

            <div className="pmsg__close-row">
              <blockquote className="pmsg__vision">
                <p>&ldquo;{PRINCIPAL.quote}&rdquo;</p>
              </blockquote>

              <p className="pmsg__sign">
                <span className="pmsg__name">{PRINCIPAL.name}</span>
                <span className="pmsg__role">{PRINCIPAL.title}</span>
              </p>
            </div>

            {showMore ? (
              <Link className="pmsg__more" to={`${ROUTES.about}#principal`}>
                Read the full message
                <Icon name="arrowRight" size={16} />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Home: the first two paragraphs, and a way through to the rest. */
export function HomePrincipal() {
  return <PrincipalMessage paragraphs={2} showMore />;
}

/** About: the whole message. */
export function AboutPrincipal() {
  return <PrincipalMessage />;
}
