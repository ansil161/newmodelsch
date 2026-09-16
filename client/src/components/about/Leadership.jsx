import { LEADERSHIP } from '@/constants';
import { facultyImages, resolve, resolveSet } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import './leadership.css';

/* ==========================================================================
   08 - LEADERSHIP
   --------------------------------------------------------------------------
   A quiet editorial team row. Eyebrow and two-line heading on the left, a
   short paragraph on the right, and the four leaders as full-bleed portrait
   cards in one line underneath, with a pale sunburst standing up behind the
   middle of the row.

   The four are the school's own leadership from `constants/people.js`,
   unchanged. Photography comes from `imagery.js` rather than from
   `Person.portrait`, because those entries carry a `focus` that keeps the
   face inside a portrait crop.

   MOTION

   Two one-shot reveals, each triggered by the part of the section it
   animates, so the cards are not spent while they are still below the fold
   on a short laptop. The resting state is the finished state: under reduced
   motion nothing is built and the section is simply there.
   ========================================================================== */

const LEADERS = LEADERSHIP.map((person, i) => ({
  ...person,
  photo: facultyImages[i] ?? facultyImages[0],
}));

/* --------------------------------------------------------------------------
   The sunburst
   --------------------------------------------------------------------------
   Rounded bars on a ring, in a 200-unit box centred on the origin. Only the
   upper arc is drawn: the ring is centred on the top edge of the cards, and
   a lower ray would show through the gutter between them.
   -------------------------------------------------------------------------- */
const RAY_COUNT = 14;
const RAY_INNER = 46;
const RAY_OUTER = 94;

const RAYS = Array.from({ length: RAY_COUNT }, (_, i) => {
  const angle = (i / RAY_COUNT) * Math.PI * 2 - Math.PI / 2;
  const round = (n) => Math.round(n * 100) / 100;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x1: round(cos * RAY_INNER),
    y1: round(sin * RAY_INNER),
    x2: round(cos * RAY_OUTER),
    y2: round(sin * RAY_OUTER),
  };
}).filter((ray) => ray.y2 < 16);

export function AboutLeadership() {
  const scope = useGsapScope((_ctx, root) => {
    if (reduced()) return;

    const q = gsap.utils.selector(root);

    gsap
      .timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: { trigger: q('.ld__head')[0], start: 'top 80%', once: true },
      })
      .from(q('.ld__eyebrow'), { opacity: 0, y: 8, duration: 0.6 })
      .from(q('.ld__title-line'), { opacity: 0, y: 26, duration: 0.95, stagger: 0.08 }, '-=0.4')
      .from(q('.ld__lead'), { opacity: 0, y: 10, duration: 0.8 }, '-=0.65');

    gsap
      .timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: { trigger: q('.ld__team')[0], start: 'top 84%', once: true },
      })
      .from(q('.ld-sun svg'), {
        opacity: 0,
        scale: 0.78,
        duration: 1.3,
        ease: 'power2.out',
        transformOrigin: '50% 50%',
      })
      .from(q('.ld-card'), { opacity: 0, y: 30, duration: 0.9, stagger: 0.1 }, 0.12);
  }, []);

  return (
    <section ref={scope} className="section ld" id="leadership" aria-labelledby="ld-title">
      <div className="wrap">
        <header className="ld__head">
          <div className="ld__heading">
            <p className="ld__eyebrow">Our leadership</p>
            <h2 className="ld__title" id="ld-title">
              <span className="ld__title-line">The People Behind</span>{' '}
              <span className="ld__title-line">Our School&rsquo;s Journey</span>
            </h2>
          </div>
          <p className="ld__lead">
            Meet the dedicated leaders who guide our school community with experience, purpose, and
            a commitment to every student&rsquo;s growth.
          </p>
        </header>

        <div className="ld__team">
          <span className="ld-sun" aria-hidden="true">
            <svg viewBox="-100 -100 200 200" focusable="false">
              {RAYS.map((ray, i) => (
                <line key={i} {...ray} />
              ))}
            </svg>
          </span>

          <ul className="ld-team" role="list">
            {LEADERS.map((person) => (
              <li className="ld-card" key={person.id}>
                <figure className="ld-card__frame">
                  <img
                    src={resolve(person.photo, 700)}
                    srcSet={resolveSet(person.photo, [360, 560, 800, 1100])}
                    sizes="(max-width: 859px) 46vw, 23vw"
                    alt={`Portrait of ${person.name}, ${person.role}`}
                    loading="lazy"
                    decoding="async"
                    style={person.photo.focus ? { objectPosition: person.photo.focus } : undefined}
                  />
                  <figcaption className="ld-card__caption">
                    <h3 className="ld-card__name">{person.name}</h3>
                    <p className="ld-card__role">{person.role}</p>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
