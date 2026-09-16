import { SAFETY_MEASURES } from '@/constants';
import { safetyImages } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import { Icon } from '@/components/common/Icon';
import { Figure } from '@/components/editorial';
import './safety.css';

/* ==========================================================================
   05 - SAFETY & WELLBEING
   --------------------------------------------------------------------------
   One composed scene rather than a heading followed by six boxes: the claim
   on the left, a photograph laid on two paper shapes on the right with a gold
   arc drawn around it, and the six measures underneath as cards that each
   carry their own evidence in a curved slice of photograph.

   HOW IT MOVES, AND WHY IT IS ONE TIMELINE

   There is exactly one reveal and it is scrubbed by the reader's scroll. It
   starts as the section's top edge comes into view and finishes as the card
   grid reaches the upper-middle of the screen, so whatever part of the scene
   is on screen is the part that is resolving.

     - the claim, the photograph, the paper shapes, the arc and the note all
       settle on overlapping ranges in the first third, as one gesture
     - the grid arrives in the last third as a single object: all six cards
       rise and decompress together, on the same tween, with no stagger. A
       card-by-card entrance turns six policies into a queue to be waited for.

   After that only a few pixels of parallax remain - the photograph inside its
   frame, the arc, the note, and the slices inside the cards - so the scene
   breathes while it is read and the text itself stays still.

   Phones get two short one-shot fades instead: no scrub, no parallax. With
   reduced motion, or with JavaScript off, the section is simply finished.

   Hover effects use the CSS `translate` and `scale` properties, not
   `transform`, so they compose with the transforms GSAP writes inline
   instead of being overwritten by them.
   ========================================================================== */

const DESKTOP = '(min-width: 900px) and (prefers-reduced-motion: no-preference)';
const MOBILE = '(max-width: 899.98px) and (prefers-reduced-motion: no-preference)';

function buildMotion(scope) {
  const mm = gsap.matchMedia(scope);
  const q = gsap.utils.selector(scope);

  mm.add(DESKTOP, () => {
    const measures = scope.querySelector('.sw__measures');
    const grid = scope.querySelector('.sw__grid');
    const arc = scope.querySelector('.sw__ring-arc');
    const underline = scope.querySelector('.sw__hand-line path');
    if (!measures || !grid) return;

    const settle = { ease: 'power2.out' };

    // The end is measured against the wrapper rather than the grid, because
    // the grid itself is moved by this timeline and a trigger that moves
    // measures its own offset into the answer.
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: scope,
        start: 'top 80%',
        endTrigger: measures,
        end: 'top 62%',
        scrub: true,
      },
    });

    tl.from(q('.sw__eyebrow'), { y: 18, autoAlpha: 0, duration: 0.2, ...settle }, 0)
      .from(q('.sw__title'), { y: 44, autoAlpha: 0, duration: 0.26, ...settle }, 0.03)
      .from(q('.sw__lead'), { y: 28, autoAlpha: 0, duration: 0.24, ...settle }, 0.06)
      .from(q('.sw__cta'), { y: 18, autoAlpha: 0, duration: 0.22, ...settle }, 0.09)
      .fromTo(
        q('.sw__photo'),
        { scale: 0.94, autoAlpha: 0 },
        { scale: 1, autoAlpha: 1, duration: 0.3, ...settle },
        0.02,
      )
      .from(q('.sw__shape--left'), { x: -28, autoAlpha: 0, duration: 0.3, ...settle }, 0.05)
      .from(q('.sw__shape--right'), { x: 28, autoAlpha: 0, duration: 0.3, ...settle }, 0.05)
      .from(q('.sw__hand'), { y: 14, autoAlpha: 0, duration: 0.2, ...settle }, 0.16)
      .from(q('.sw__scroll'), { y: -12, autoAlpha: 0, duration: 0.2, ...settle }, 0.18);

    if (arc) {
      const len = arc.getTotalLength();
      tl.fromTo(
        arc,
        { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: 0.26, ease: 'power1.inOut' },
        0.08,
      );
    }
    tl.from(
      q('.sw__ring-dot'),
      { scale: 0, autoAlpha: 0, transformOrigin: '50% 50%', duration: 0.06 },
      0.32,
    );

    if (underline) {
      const len = underline.getTotalLength();
      tl.fromTo(
        underline,
        { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: 0.1, ease: 'power1.inOut' },
        0.26,
      );
    }

    // The grid, as one object: one tween for the block, one for all six
    // cards' compression, both on the same position.
    tl.from(grid, { y: 56, autoAlpha: 0, duration: 0.34, ...settle }, 0.66).from(
      q('.sw-card'),
      { scaleY: 0.955, transformOrigin: '50% 100%', duration: 0.34, ...settle },
      0.66,
    );

    /* Parallax. Every one of these moves a property the reveal above does not
       touch - `yPercent` where the reveal moved `y`, or an element the reveal
       left alone - so the two never fight over a value. */
    const across = (trigger) => ({
      trigger,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
    });

    gsap.fromTo(q('.sw__photo img'), { y: -18 }, { y: 18, ease: 'none', scrollTrigger: across(scope) });
    gsap.fromTo(q('.sw__ring'), { y: -10 }, { y: 14, ease: 'none', scrollTrigger: across(scope) });
    gsap.fromTo(q('.sw__title'), { yPercent: 5 }, { yPercent: -5, ease: 'none', scrollTrigger: across(scope) });
    gsap.fromTo(q('.sw__hand'), { yPercent: 10 }, { yPercent: -10, ease: 'none', scrollTrigger: across(scope) });
    gsap.fromTo(q('.sw__shape--right'), { yPercent: -3 }, { yPercent: 3, ease: 'none', scrollTrigger: across(scope) });
    gsap.fromTo(q('.sw__shape--left'), { yPercent: 4 }, { yPercent: -4, ease: 'none', scrollTrigger: across(scope) });
    gsap.fromTo(q('.sw-card__fig img'), { y: -8 }, { y: 8, ease: 'none', scrollTrigger: across(measures) });
  });

  mm.add(MOBILE, () => {
    const visual = scope.querySelector('.sw__visual');
    const measures = scope.querySelector('.sw__measures');

    gsap.from(q('.sw__copy > *'), {
      y: 22,
      autoAlpha: 0,
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.05,
      scrollTrigger: { trigger: scope, start: 'top 78%', once: true },
    });

    if (visual) {
      gsap.from(q('.sw__photo, .sw__shape, .sw__hand'), {
        y: 24,
        autoAlpha: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: visual, start: 'top 82%', once: true },
      });
    }

    if (measures) {
      gsap.from(q('.sw__grid'), {
        y: 32,
        autoAlpha: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: measures, start: 'top 85%', once: true },
      });
    }
  });

  return () => mm.revert();
}

export function SlSafety() {
  const scope = useGsapScope((_, el) => buildMotion(el), []);
  const { scrollTo } = useSmoothScroll();

  // Through Lenis rather than a native anchor jump, which would leave Lenis
  // and every ScrollTrigger on the page measuring a stale scroll position.
  const toMeasures = (event) => {
    event.preventDefault();
    scrollTo('#safety-measures', -104);
    document.getElementById('safety-measures')?.focus({ preventScroll: true });
  };

  return (
    <section ref={scope} className="section sw" id="safety" aria-labelledby="sw-title">
      <div className="wrap">
        <div className="sw__intro">
          <div className="sw__copy">
            <p className="sw__eyebrow">
              <span className="sw__num">05</span>
              <span className="sw__rule" aria-hidden="true" />
              <span>Safety &amp; wellbeing</span>
            </p>

            <h2 className="sw__title" id="sw-title">
              The policy, <em>in full.</em>
            </h2>

            <p className="sw__lead">
              Six measures, stated as they are written. Where something is deliberately not done -
              cameras in classrooms, for instance - that is stated too.
            </p>

            <a className="sw__cta" href="#safety-measures" onClick={toMeasures}>
              <span className="sw__cta-rule" aria-hidden="true" />
              <span>Explore our safety framework</span>
              <Icon name="arrowRight" size={16} className="sw__cta-arrow" />
            </a>
          </div>

          <div className="sw__visual">
            <div className="sw__stage">
              <span className="sw__shape sw__shape--left" aria-hidden="true" />
              <span className="sw__shape sw__shape--right" aria-hidden="true" />

              <Figure
                photo={safetyImages.feature}
                width={480}
                widths={[360, 480, 720, 960]}
                sizes="(max-width: 699px) 68vw, (max-width: 899px) 330px, 300px"
                shape="square"
                ratio="free"
                className="sw__photo"
              />

              {/* Drawn in the stage's own coordinates, so the arc stays wrapped
                  round the photograph at every width the stage scales to. */}
              <svg className="sw__ring" viewBox="0 0 640 520" aria-hidden="true" focusable="false">
                <path className="sw__ring-arc" d="M200 50 A175 175 0 0 1 452 230" />
                <circle className="sw__ring-dot" cx="452" cy="230" r="5" />
              </svg>

              <p className="sw__hand">
                Safe
                <br />
                today.
                <br />
                Strong
                <br />
                tomorrow.
                <svg className="sw__hand-line" viewBox="0 0 120 16" aria-hidden="true" focusable="false">
                  <path d="M4 13C38 8 78 4 116 2" />
                </svg>
              </p>
            </div>

            <a className="sw__scroll" href="#safety-measures" onClick={toMeasures}>
              <span className="sw__scroll-line" aria-hidden="true" />
              <span className="sw__scroll-text">
                Scroll
                <br />
                down
              </span>
              <Icon name="arrowDown" size={16} />
            </a>
          </div>
        </div>

        <div className="sw__measures" id="safety-measures" tabIndex={-1}>
          <ul className="sw__grid" aria-label="The six safety measures">
            {SAFETY_MEASURES.map((measure, i) => {
              const photo = safetyImages.measures[measure.id];
              return (
                <li className="sw-card" key={measure.id}>
                  <div className="sw-card__inner">
                    <div className="sw-card__body">
                      <div className="sw-card__head">
                        <span className="sw-card__badge" aria-hidden="true">
                          <Icon name={measure.icon} size={18} />
                        </span>
                        <span className="sw-card__num">{String(i + 1).padStart(2, '0')}</span>
                      </div>
                      <h3 className="sw-card__title">{measure.title}</h3>
                      <p className="sw-card__desc">{measure.description}</p>
                      <span className="sw-card__arrow" aria-hidden="true">
                        <Icon name="arrowRight" size={18} />
                      </span>
                    </div>

                    {photo ? (
                      <div className="sw-card__media" aria-hidden="true">
                        <span className="sw-card__echo" />
                        <Figure
                          photo={photo}
                          width={380}
                          widths={[240, 380, 560, 760]}
                          sizes="(max-width: 559px) 92vw, 200px"
                          shape="square"
                          ratio="free"
                          className="sw-card__fig"
                          decorative
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
