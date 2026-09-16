import { useId } from 'react';
import { ABOUT_HERO } from '@/constants';
import { resolve, resolveSet } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { count, reduced } from '@/lib/motion';
import { onStage, stageOpen } from '@/lib/stage';
import { Icon } from '@/components/common/Icon';
import './about-hero.css';

/* ==========================================================================
   ABOUT - THE COVER
   --------------------------------------------------------------------------
   An editorial spread on white: the statement on the left with the school's
   plain facts under it, an architectural collage of two arched photographs
   with a seal and a caption on the right, and the school in four
   open-bordered figures across the foot.

   Everything is visible without JavaScript. The entrance is one timeline,
   held while a page transition covers the screen (see `lib/stage.js`).
   Scroll adds at most ~20px of drift to the pictures and ornaments and turns
   the seal a little; the text and the figures never move.
   ========================================================================== */

export function AboutCover() {
  const sealId = useId().replace(/:/g, '');

  const scope = useGsapScope((_, el) => {
    if (reduced()) return;

    const tl = gsap.timeline({ paused: !stageOpen(), defaults: { ease: 'power3.out' } });
    tl.from('.ah__eyebrow', { y: 14, autoAlpha: 0, duration: 0.8 }, 0.1)
      .from('.ah__line > span', { yPercent: 115, duration: 1.2, ease: 'power4.out', stagger: 0.12 }, 0.25)
      .fromTo(
        '.ah__underline path',
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' },
        1.05,
      )
      .from('.ah__lead', { y: 16, autoAlpha: 0, duration: 0.9 }, 0.75)
      .from('.ah__facts li, .ah__link', { y: 14, autoAlpha: 0, duration: 0.8, stagger: 0.07 }, 0.95)
      .from('.ah__plate', { autoAlpha: 0, duration: 1.4 }, 0.3)
      .from(
        '.ah__main-frame',
        { clipPath: 'circle(0% at 50% 70%)', duration: 1.6, ease: 'power3.inOut', clearProps: 'clipPath' },
        0.35,
      )
      .from('.ah__main-frame img', { scale: 1.12, duration: 2.2, ease: 'power2.out' }, 0.35)
      .from('.ah__main-ring', { autoAlpha: 0, duration: 1.2 }, 1.1)
      .from('.ah__inset', { y: 40, autoAlpha: 0, duration: 1.2 }, 0.9)
      .from('.ah__seal', { autoAlpha: 0, rotate: -40, scale: 0.85, duration: 1.3 }, 1.15)
      .from('.ah__caption', { x: -12, autoAlpha: 0, duration: 0.9 }, 1.4)
      .from(
        '.ah__script',
        { clipPath: 'inset(0% 100% 0% 0%)', duration: 1.4, ease: 'power2.inOut', clearProps: 'clipPath' },
        1.35,
      )
      .from('.ah__ornament', { autoAlpha: 0, scale: 0.6, duration: 0.8, stagger: 0.1 }, 1.4)
      .from('.ah__stats-rule', { scaleX: 0, transformOrigin: 'left center', duration: 1.2, ease: 'power3.inOut' }, 0.9)
      .from('.ah__stats-head > span', { y: 10, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, 1.0)
      .from('.ah__stat', { y: 28, autoAlpha: 0, duration: 0.9, stagger: 0.12 }, 1.1);

    // `count` reads the finished figure from the text. A first pass torn down
    // mid-count (StrictMode, HMR) would leave a partial number behind for the
    // next pass to read, so put the authored figure back first.
    const counters = el.querySelectorAll('.ah__stat-value[data-count]');
    counters.forEach((node) => {
      node.textContent = node.dataset.count;
    });
    count(counters, {
      trigger: el,
      start: 'top bottom',
      delay: 1.3,
      stagger: 0.12,
      fromZero: true,
    });

    // Scroll: the pictures and the ornaments part a little, at different
    // speeds, and the seal turns. Depth rather than motion.
    const scrub = (target, vars) =>
      gsap.to(target, {
        ...vars,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true },
      });
    scrub('.ah__main', { y: -12 });
    scrub('.ah__inset-drift', { y: -22 });
    scrub('.ah__script-drift', { y: -16 });
    scrub('.ah__plate', { y: 14 });
    scrub('.ah__ornaments', { y: 10 });
    scrub('.ah__seal-text', { rotate: 90 });

    const release = onStage(() => tl.play());
    return () => {
      release();
      tl.kill();
    };
  }, []);

  const { eyebrow, titleLines, lead, facts, link, script, seal, caption, main, inset, statsHead, stats } =
    ABOUT_HERO;

  return (
    <section ref={scope} className="ah" aria-labelledby="about-hero-title">
      <div className="ah__backdrop" aria-hidden="true" />

      <div className="ah__inner">
        <div className="ah__top">
          <div className="ah__text">
            <p className="ah__eyebrow">
              <span className="ah__eyebrow-rule" aria-hidden="true" />
              {eyebrow}
            </p>

            <h1 id="about-hero-title" className="ah__title">
              {titleLines.map((line) => (
                <span className="ah__line" key={line.text + (line.em ?? '')}>
                  <span>
                    {line.text}
                    {line.em ? (
                      <em className="ah__em">
                        {line.em}
                        <svg className="ah__underline" viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true">
                          <path d="M3 11.5C62 4.5 150 3 297 8.5" pathLength="1" />
                        </svg>
                      </em>
                    ) : null}
                  </span>
                </span>
              ))}
            </h1>

            <p className="ah__lead">{lead}</p>

            <ul className="ah__facts">
              {facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>

            <a className="ah__link" href={link.hash}>
              <span>{link.label}</span>
              <span className="ah__link-icon" aria-hidden="true">
                <Icon name="arrowDown" size={16} />
              </span>
            </a>
          </div>

          <div className="ah__collage">
            <span className="ah__plate" aria-hidden="true" />

            <div className="ah__ornaments" aria-hidden="true">
              <span className="ah__ornament ah__ornament--star" />
              <span className="ah__ornament ah__ornament--plus" />
              <svg className="ah__ornament ah__ornament--arc" viewBox="0 0 200 200" fill="none">
                <path d="M4 196C4 90 90 4 196 4" />
              </svg>
            </div>

            <figure className="ah__main">
              <span className="ah__main-ring" aria-hidden="true" />
              <div className="ah__main-frame">
                <img
                  src={resolve(main, 1200)}
                  srcSet={resolveSet(main, [640, 900, 1200, 1600])}
                  sizes="(max-width: 767px) 80vw, 36vw"
                  alt={main.alt}
                  style={{ objectPosition: main.focus }}
                  width={1200}
                  height={900}
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
            </figure>

            <div className="ah__inset-drift">
              <figure className="ah__inset">
                <div className="ah__inset-frame">
                  <img
                    src={resolve(inset, 560)}
                    srcSet={resolveSet(inset, [360, 560, 800])}
                    sizes="(max-width: 767px) 38vw, 16vw"
                    alt={inset.alt}
                    style={{ objectPosition: inset.focus }}
                    width={560}
                    height={760}
                    decoding="async"
                  />
                </div>
              </figure>
            </div>

            <div className="ah__seal" aria-hidden="true">
              <svg className="ah__seal-text" viewBox="0 0 120 120">
                <defs>
                  <path id={sealId} d="M60 60m-45 0a45 45 0 1 1 90 0a45 45 0 1 1-90 0" />
                </defs>
                <text>
                  <textPath href={`#${sealId}`} textLength="282">
                    {seal}
                  </textPath>
                </text>
              </svg>
              <span className="ah__seal-core">
                <Icon name="landmark" size={20} />
              </span>
            </div>

            <p className="ah__caption">
              <span className="ah__caption-rule" aria-hidden="true" />
              {caption}
            </p>

            <div className="ah__script-drift" aria-hidden="true">
              <p className="ah__script">
                {script.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </p>
            </div>
          </div>
        </div>

        <div className="ah__stats-head">
          <span>{statsHead.label}</span>
          <span className="ah__stats-rule" aria-hidden="true" />
          <span>{statsHead.aside}</span>
        </div>

        <ul className="ah__stats" aria-label={statsHead.label}>
          {stats.map((stat, i) => (
            <li className={`ah__stat ah__stat--${stat.tone}`} key={stat.label}>
              <span className="ah__stat-wash" aria-hidden="true" />
              <span className="ah__stat-badge" aria-hidden="true">
                <Icon name={stat.icon} size={18} />
              </span>
              <span className="ah__stat-index" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="ah__stat-figure">
                <span className="ah__stat-value" data-count={stat.count ? stat.value : undefined}>
                  {stat.value}
                </span>
                <span className="ah__stat-label">{stat.label}</span>
              </p>
              <p className="ah__stat-detail">{stat.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
