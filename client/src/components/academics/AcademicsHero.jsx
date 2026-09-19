import { CURRICULUM_ROWS, ROUTES, SCHOOL, STATS } from '@/constants';
import { everydayImages, resolve, resolveSet } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { onStage } from '@/lib/stage';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import './academics-hero.css';

/* ==========================================================================
   ACADEMICS - THE COVER
   --------------------------------------------------------------------------
   A centred two-line claim over one wide, heavily rounded photograph. Two
   translucent figures hover on the frame - one across its top-left edge, one
   inside its lower-right - and the way into the page sits in a white notch
   cut out of the photograph's lower-left corner.

   Everything is visible without JavaScript. The entrance is one timeline,
   played once when the cover enters the viewport and held while a page
   transition covers the screen (see `lib/stage.js`). Scroll adds a few
   percent of parallax to the photograph and lets the two cards travel at
   their own speeds; the heading never moves.
   ========================================================================== */

const PHOTO = everydayImages.deskGirls;

const years = STATS.find((stat) => stat.label === 'Years');
const grades = STATS.find((stat) => stat.label === 'Grades');

const FIGURES = [
  {
    id: 'years',
    value: String(years.value),
    suffix: years.suffix,
    label: `Years of teaching, unbroken since ${SCHOOL.established}`,
  },
  {
    id: 'stages',
    value: 'Nursery–10',
    suffix: '',
    label: `${CURRICULUM_ROWS.length} learning stages, ${grades.value}\u00a0graded years`,
  },
];

function Star() {
  return (
    <svg className="ach__star" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 0c.9 6.6 5.4 11.1 12 12-6.6.9-11.1 5.4-12 12-.9-6.6-5.4-11.1-12-12C6.6 11.1 11.1 6.6 12 0Z" />
    </svg>
  );
}

function StatCard({ value, suffix, label }) {
  return (
    <dl className="ach__card">
      <dt className="ach__card-label">{label}</dt>
      <dd className="ach__card-value">
        {value}
        {suffix ? <span className="ach__card-suffix">{suffix}</span> : null}
      </dd>
    </dl>
  );
}

export function AcCover() {
  const { scrollTo } = useSmoothScroll();

  const scope = useGsapScope((self, el) => {
    if (reduced()) return;

    const q = gsap.utils.selector(el);
    const frame = el.querySelector('.ach__frame');
    const image = frame.querySelector('img');
    const [cardA, cardB] = q('.ach__card');
    const radius = getComputedStyle(frame).borderTopLeftRadius;

    /* ---- the entrance ------------------------------------------------- */
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });

    tl.from(q('.ach__line > span'), { yPercent: 100, opacity: 0, duration: 1.1, ease: 'power4.out', stagger: 0.12 }, 0)
      .from('.ach__star', { autoAlpha: 0, scale: 0.6, rotate: -40, duration: 1 }, 0.5)
      .fromTo(
        frame,
        { clipPath: `inset(9% 7% 9% 7% round ${radius})` },
        { clipPath: `inset(0% 0% 0% 0% round ${radius})`, duration: 1.35, ease: 'power3.inOut', clearProps: 'clipPath' },
        0.3,
      )
      .from(frame, { autoAlpha: 0, duration: 0.5, ease: 'power1.out' }, 0.3)
      .from(image, { scale: 1.04, duration: 1.9, ease: 'power2.out' }, 0.3)
      .from(q('.ach__cta'), { y: 10, autoAlpha: 0, duration: 0.6 }, 1.1)
      .from(cardA, { x: -22, y: 16, autoAlpha: 0, duration: 1 }, 1.0)
      .from(cardB, { x: 22, y: 16, autoAlpha: 0, duration: 1 }, 1.14);

    // Once both have landed, they hover. Added to the context so the loops
    // are reverted with everything else on unmount.
    tl.eventCallback('onComplete', () => {
      self.add(() => {
        [cardA, cardB].forEach((card, i) => {
          gsap.to(card, { y: -6, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: i * 1.1 });
        });
      });
    });

    let release = () => {};
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        release = onStage(() => tl.play());
      },
    });

    /* ---- the layers --------------------------------------------------- */
    const layer = (target, vars) =>
      gsap.to(target, {
        ...vars,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

    // The cards' lift is written for a desktop cover. On a phone the cover is
    // a third as tall, so the same pixels would tear them off the photograph;
    // they keep the lift in proportion, read afresh on every resize.
    const lift = (px) => () => px * (window.innerWidth < 1024 ? 0.5 : 1);

    layer(image, { yPercent: 6 });
    layer(q('.ach__float--years'), { y: lift(-26) });
    layer(q('.ach__float--stages'), { y: lift(-52) });

    return () => release();
  }, []);

  const toCurriculum = (event) => {
    event.preventDefault();
    scrollTo('#curriculum');
  };

  return (
    <section ref={scope} className="ach" aria-labelledby="academics-title">
      <div className="wrap">
        <header className="ach__head">
          <div className="ach__title-wrap">
            <h1 className="ach__title" id="academics-title">
              <span className="ach__line">
                <span>A strong foundation for every</span>
              </span>{' '}
              <span className="ach__line">
                <span>
                  student&rsquo;s <em className="ed-em">future.</em>
                </span>
              </span>
            </h1>
            <Star />
          </div>
        </header>

        <div className="ach__stage">
          <div className="ach__frame">
            <img
              src={resolve(PHOTO, 1800)}
              srcSet={resolveSet(PHOTO, [800, 1200, 1800, 2600]) || undefined}
              sizes="(max-width: 1480px) 92vw, 1320px"
              alt={PHOTO.alt}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              style={{ '--ach-focus': PHOTO.focus }}
            />

            <div className="ach__notch">
              <a className="ach__cta" href={`${ROUTES.academics}#curriculum`} onClick={toCurriculum}>
                <span className="ach__cta-icon" aria-hidden="true">
                  <svg className="ach__cta-arrow" viewBox="0 0 16 16" width="14" height="14">
                    <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" />
                  </svg>
                </span>
                <span className="ach__cta-label">Explore the curriculum</span>
              </a>
            </div>
          </div>

          {FIGURES.map((figure) => (
            <div className={`ach__float ach__float--${figure.id}`} key={figure.id}>
              <StatCard {...figure} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
