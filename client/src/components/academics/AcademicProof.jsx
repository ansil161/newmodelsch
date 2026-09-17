import { ACADEMIC_PROOF } from '@/constants';
import { everydayImages, resolve, resolveSet, studentImages } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { count, lines, reduced, rise } from '@/lib/motion';
import './academic-proof.css';

/* ==========================================================================
   05 - ACADEMIC PROOF
   --------------------------------------------------------------------------
   The four figures the whole sequence produces, set as a spread rather than
   a scoreboard: the statement across the top, two photographs standing side
   by side, and a column of copy that ends in the figures themselves.

   THE COMPOSITION

     A near-square photograph and a tall one share a baseline - the short one
     sits down on the tall one's foot, which is what stops two pictures side
     by side reading as a gallery. The copy column beside them runs a lead, a
     button, a hairline, and then the four figures in two pairs, each one a
     number, what it counts, and where it comes from.

   THE MOTION, AND WHAT EACH PIECE IS FOR

     arrival     the statement comes up line by line, the photographs rise,
                 the copy follows. The hairline draws itself across, and the
                 figures come up under it and count from zero to their real
                 value, one after another. All of it waits for the section:
                 nothing runs on page load.
     scrolling   the columns come apart slightly while the page is moving and
                 settle back together when it stops. The near photograph
                 trails by up to ~30px, the copy by half that, and the tall
                 photograph gives a couple of per cent of its height. At rest
                 they are exactly aligned, so a reader who stops to read never
                 sees anything out of place. Measured off the reference, not
                 invented: a velocity-driven offset, not a positional
                 parallax.

   Every animated property has one owner. The `.ac-proof__shot` and
   `.ac-proof__text` wrappers take the scroll offset; the `.ac-proof__frame`
   and `[data-proof-in]` elements inside them take the arrival. GSAP leaves an
   inline transform on anything it has animated, so two gestures on one
   element would overwrite each other.
   ========================================================================== */

/* The tall frame is the classroom at work, the short one a student reading -
   neither is used anywhere else on this page, and the ask below it has its
   own lesson photographs. */
const TALL = everydayImages.classroom;
const NEAR = studentImages[6];

/* Wide enough for the columns to stand side by side, and motion allowed. On a
   phone the page's scroll belongs to the thumb, and columns sliding apart
   under it read as lag rather than as depth. */
const DESYNC = '(min-width: 1024px) and (prefers-reduced-motion: no-preference)';

/** Pixels of offset per px/s of scroll velocity, and the ceiling. */
const NEAR_GAIN = 0.012;
const NEAR_MAX = 30;
const TEXT_GAIN = 0.006;
const TEXT_MAX = 15;
/** The tall frame's give: 2.5% of its height at a brisk scroll. */
const SQUEEZE_MAX = 0.025;
const SQUEEZE_AT = 1500;
/** How long the columns take to come back together once the page stops. */
const SETTLE = 0.55;

export function AcProof() {
  const scope = useGsapScope((_ctx, root) => {
    const body = root.querySelector('.ac-proof__body');
    const stats = root.querySelector('.ac-proof__stats');
    const rule = root.querySelector('.ac-proof__rule');

    /* ------------------------------------------------------------------
       Arrival
       ------------------------------------------------------------------ */
    const title = root.querySelector('.ac-proof__title');
    if (title) lines(title, { trigger: root, start: 'top 78%' });

    if (body) {
      rise(body.querySelectorAll('.ac-proof__frame'), {
        trigger: body,
        start: 'top 82%',
        y: 40,
        stagger: 0.12,
      });
      rise(body.querySelectorAll('[data-proof-in]'), {
        trigger: body,
        start: 'top 82%',
        y: 22,
        stagger: 0.08,
        delay: 0.22,
      });
    }

    if (rule && !reduced()) {
      gsap.from(rule, {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 1.2,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: rule, start: 'top 90%', once: true },
      });
    }

    if (stats) {
      rise(stats.querySelectorAll('.ac-proof__stat'), {
        trigger: stats,
        start: 'top 86%',
        y: 18,
        stagger: 0.12,
      });

      /* The figures count from zero, in reading order, and land exactly on
         the authored value. `fromZero` writes the zero the moment this is
         built, so the finished number is never glimpsed and then snatched
         back; the real value is in the markup for assistive technology the
         whole time. */
      count(stats.querySelectorAll('.ac-proof__num'), {
        trigger: stats,
        start: 'top 86%',
        delay: 0.18,
        stagger: 0.14,
        duration: 2.2,
        ease: 'power3.out',
        fromZero: true,
      });
    }

    /* ------------------------------------------------------------------
       Scrolling - the columns come apart and settle
       ------------------------------------------------------------------ */
    const mm = gsap.matchMedia(root);

    mm.add(DESYNC, () => {
      const near = root.querySelector('.ac-proof__shot--near');
      const tall = root.querySelector('.ac-proof__shot--tall');
      const text = root.querySelector('.ac-proof__text');
      if (!near || !tall || !text) return;

      const tween = { duration: SETTLE, ease: 'power3.out' };
      const nearY = gsap.quickTo(near, 'y', tween);
      const textY = gsap.quickTo(text, 'y', tween);
      const tallSqueeze = gsap.quickTo(tall, 'scaleY', tween);
      const clamp = (max, n) => gsap.utils.clamp(-max, max, n);

      const settle = () => {
        nearY(0);
        textY(0);
        tallSqueeze(1);
      };

      /* A trigger only reports while the page moves, so the return to rest
         is scheduled on every report and cancelled by the next one: it runs
         only once the reports stop. */
      let rest = null;

      ScrollTrigger.create({
        trigger: root,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const v = self.getVelocity();
          // Positive velocity is the page moving up; the columns trail it.
          nearY(clamp(NEAR_MAX, v * NEAR_GAIN));
          textY(clamp(TEXT_MAX, v * TEXT_GAIN));
          tallSqueeze(1 - SQUEEZE_MAX * Math.min(1, Math.abs(v) / SQUEEZE_AT));
          rest?.kill();
          rest = gsap.delayedCall(0.1, settle);
        },
        onLeave: settle,
        onLeaveBack: settle,
      });

      return () => {
        rest?.kill();
        gsap.set([near, text, tall], { clearProps: 'transform' });
      };
    });

    return () => mm.revert();
  }, []);

  return (
    <section
      ref={scope}
      className="section ac-proof ground-cloth"
      id="academic-proof"
      aria-labelledby="ac-proof-title"
    >
      <div className="wrap">
        <h2 className="ac-proof__title" id="ac-proof-title">
          What the whole sequence produces.
        </h2>

        <div className="ac-proof__body">
          <div className="ac-proof__shot ac-proof__shot--near">
            <div className="ac-proof__frame">
              <img
                src={resolve(NEAR, 720)}
                srcSet={resolveSet(NEAR, [360, 540, 720, 960])}
                sizes="(max-width: 1023px) 46vw, 28vw"
                alt={NEAR.alt}
                width={720}
                height={735}
                loading="lazy"
                decoding="async"
                style={NEAR.focus ? { objectPosition: NEAR.focus } : undefined}
              />
            </div>
          </div>

          <div className="ac-proof__shot ac-proof__shot--tall">
            <div className="ac-proof__frame">
              <img
                src={resolve(TALL, 720)}
                srcSet={resolveSet(TALL, [360, 540, 720, 960])}
                sizes="(max-width: 1023px) 46vw, 28vw"
                alt={TALL.alt}
                width={720}
                height={1000}
                loading="lazy"
                decoding="async"
                style={TALL.focus ? { objectPosition: TALL.focus } : undefined}
              />
            </div>
          </div>

          <div className="ac-proof__text">
            <p className="ac-proof__lead" data-proof-in>
              Board preparation happens inside school hours. No family is expected to buy an
              evening class to reach these figures.
            </p>

            {/* A div, not the link itself: `rise` moves it, and a transform
                on an inline box does nothing. */}
            <div className="ac-proof__action" data-proof-in>
              <a className="ac-proof__cta" href="#achievements">
                See the record
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    d="M3.5 10h12.5M11 5l5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>

            <span className="ac-proof__rule" aria-hidden="true" />

            {/* The label is the term and the figure is its value, so a
                screen reader hears "Board pass rate, 100%, twelve consecutive
                years". The counting number is hidden from it - mid-count it
                is a wrong number - and the real one is read instead. */}
            <dl className="ac-proof__stats">
              {ACADEMIC_PROOF.map((point) => (
                <div className="ac-proof__stat" key={point.id}>
                  <dt className="ac-proof__label">{point.label}</dt>
                  <dd className="ac-proof__figure">
                    <span className="sr-only">{point.value}</span>
                    <span className="ac-proof__num" aria-hidden="true">
                      {point.value}
                    </span>
                  </dd>
                  <dd className="ac-proof__detail">{point.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
