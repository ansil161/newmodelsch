import { STUDENT_LIFE_HERO } from '@/constants';
import { lifeHeroImages, resolve, resolveSet } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { count, playOnScroll, reduced } from '@/lib/motion';
import { onStage, stageOpen } from '@/lib/stage';
import { Icon } from '@/components/common/Icon';
import './hero.css';

/* ==========================================================================
   STUDENT LIFE - THE COVER (`.slh`)
   --------------------------------------------------------------------------
   One indigo panel and three cards under it, read as a single spread.

   The panel carries the claim: an oversized, uppercase statement on the left,
   a crowd of students on the right feathered into the indigo rather than
   boxed beside it, four small labels pinned around them, and a compact pill
   and play control at its foot.

   The cards carry the evidence, each on its own surface so three different
   kinds of thing read as different: charcoal for the figures, pale paper for
   the film, lime for the invitation into the strands. The widths are uneven
   on purpose - the widest card is the one that leads somewhere.

   The lime is this page's one accent and appears nowhere else on the site.

   Everything is visible without JavaScript. The entrance is one timeline,
   held while a page transition covers the screen (see `lib/stage.js`), and
   the cards follow it on wide screens or arrive on scroll on narrow ones.
   Scroll moves the photograph and the labels a few pixels at different
   speeds; the type never moves.
   ========================================================================== */

const WIDE = '(min-width: 1100px)';

export function SlHero() {
  const scope = useGsapScope((self, el) => {
    // `count` reads the finished figure from the text. A first pass torn down
    // mid-count (StrictMode, HMR) would leave a partial number for the next
    // pass to read, so put the authored figure back first.
    const counters = el.querySelectorAll('.slh__stat-value[data-count]');
    counters.forEach((node) => {
      node.textContent = node.dataset.count;
    });

    if (reduced()) return;

    const wide = window.matchMedia(WIDE).matches;

    const tl = gsap.timeline({ paused: !stageOpen(), defaults: { ease: 'power3.out' } });
    tl.fromTo(
      '.slh__panel',
      { clipPath: 'inset(3% 1.5% 3% 1.5% round 40px)' },
      { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1.3, ease: 'power4.inOut', clearProps: 'clipPath' },
      0,
    )
      .from('.slh__plane', { xPercent: 10, autoAlpha: 0, duration: 1.8, stagger: 0.14, ease: 'power2.out' }, 0.2)
      .from('.slh__visual', { x: 90, autoAlpha: 0, duration: 1.5 }, 0.25)
      .from('.slh__visual img', { scale: 1.16, duration: 2.2, ease: 'power2.out' }, 0.25)
      .from('.slh__eyebrow', { y: 12, autoAlpha: 0, duration: 0.8 }, 0.45)
      .from('.slh__line > span', { yPercent: 105, duration: 1.15, ease: 'power4.out', stagger: 0.1 }, 0.5)
      .from('.slh__face', { scale: 0.5, autoAlpha: 0, duration: 0.7, stagger: 0.06 }, 1.05)
      .from('.slh__lead, .slh__actions > *', { y: 16, autoAlpha: 0, duration: 0.8, stagger: 0.07 }, 0.9)
      .from('.slh__pill', { y: 18, scale: 0.94, autoAlpha: 0, duration: 0.9, stagger: 0.12 }, 1.1);

    // Built when the stage opens rather than now, so a card that enters on
    // scroll cannot fire behind a transition that is still covering it.
    const cards = () =>
      self.add(() => {
        el.querySelectorAll('.slh__card').forEach((card, i) => {
          const t = gsap.timeline(wide ? { delay: 0.85 + i * 0.12 } : { paused: true });

          t.from(card, {
            y: 40,
            autoAlpha: 0,
            duration: 1,
            ease: 'power3.out',
            // The resting transform belongs to the stylesheet's hover.
            clearProps: 'transform,opacity,visibility',
          });

          const art = card.querySelector('.slh__card-art img');
          if (art) t.from(art, { scale: 1.12, duration: 1.6, ease: 'power2.out' }, 0);

          const waves = card.querySelectorAll('.slh__waves path');
          if (waves.length) {
            t.fromTo(
              waves,
              { strokeDashoffset: 1 },
              { strokeDashoffset: 0, duration: 1.8, stagger: 0.15, ease: 'power2.inOut' },
              0.2,
            );
          }

          if (!wide) playOnScroll(t, { trigger: card, start: 'top 90%' });
        });
      });

    count(counters, {
      trigger: el,
      start: 'top bottom',
      delay: wide ? 1.5 : 0.4,
      stagger: 0.15,
      fromZero: true,
    });

    // Scroll: depth rather than motion. The photograph lags, the labels part
    // at their own speeds, the planes slide a little.
    const scrub = (target, vars) =>
      gsap.to(target, {
        ...vars,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true },
      });
    scrub('.slh__visual img', { y: 70 });
    scrub('.slh__pill-slot--a', { y: -34 });
    scrub('.slh__pill-slot--b', { y: -56 });
    scrub('.slh__pill-slot--c', { y: -22 });
    scrub('.slh__pill-slot--d', { y: -44 });
    scrub('.slh__plane--a', { xPercent: -5 });
    scrub('.slh__card-art', { y: -18 });

    const release = onStage(() => {
      tl.play();
      cards();
    });
    return () => {
      release();
      tl.kill();
    };
  }, []);

  const { eyebrow, titleLines, lead, cta, film, pills, motion, media, world } = STUDENT_LIFE_HERO;
  const { lead: leadPhoto, bench, field, faces } = lifeHeroImages;
  const last = titleLines.length - 1;

  return (
    <section ref={scope} className="slh" aria-labelledby="slh-title">
      <div className="slh__inner">
        <div className="slh__panel">
          <div className="slh__planes" aria-hidden="true">
            <span className="slh__plane slh__plane--a" />
            <span className="slh__plane slh__plane--b" />
          </div>

          <div className="slh__stage">
            <figure className="slh__visual">
              <img
                src={resolve(leadPhoto, 1400)}
                srcSet={resolveSet(leadPhoto, [640, 960, 1400, 1900])}
                sizes="(max-width: 699px) 100vw, 58vw"
                alt={leadPhoto.alt}
                style={{ objectPosition: leadPhoto.focus }}
                width={1400}
                height={1100}
                fetchPriority="high"
                decoding="async"
              />
            </figure>

            <ul className="slh__pills" aria-label="Part of every day here">
              {pills.map((pill) => (
                <li className={`slh__pill-slot slh__pill-slot--${pill.slot}`} key={pill.label}>
                  <span className={`slh__pill${pill.accent ? ' slh__pill--accent' : ''}`}>
                    <span className="slh__pill-icon" aria-hidden="true">
                      <Icon name={pill.icon} size={13} />
                    </span>
                    {pill.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* The cut corner: the one hard angle in a spread of rounded
              shapes. Wide screens only. */}
          <span className="slh__notch" aria-hidden="true" />

          <div className="slh__copy">
            <p className="slh__eyebrow">
              <span className="slh__eyebrow-dot" aria-hidden="true" />
              {eyebrow}
            </p>

            <h1 id="slh-title" className="slh__title">
              {titleLines.map((line, i) => (
                <span className="slh__line" key={line}>
                  <span>
                    {line}
                    {i === last ? (
                      <span className="slh__faces" aria-hidden="true">
                        {faces.map((face) => (
                          <span className="slh__face" key={face.id}>
                            <img
                              src={resolve(face, 160)}
                              alt=""
                              style={{ objectPosition: face.focus, transformOrigin: face.focus }}
                              width={160}
                              height={160}
                              decoding="async"
                            />
                          </span>
                        ))}
                        <span className="slh__face slh__face--plus">
                          <Icon name="plus" size={18} />
                        </span>
                      </span>
                    ) : null}
                  </span>
                </span>
              ))}
            </h1>
          </div>

          <div className="slh__foot">
            <p className="slh__lead">{lead}</p>

            <div className="slh__actions">
              <a className="slh__cta" href={cta.hash}>
                <span>{cta.label}</span>
                <span className="slh__cta-icon" aria-hidden="true">
                  <Icon name="arrowRight" size={16} />
                </span>
              </a>
              <a className="slh__play" href={film.hash} aria-label={film.label}>
                <Icon name="play" size={18} />
              </a>
              <span className="slh__play-note" aria-hidden="true">
                Four students,
                <br />
                on film
              </span>
            </div>
          </div>
        </div>

        <div className="slh__cards">
          <article className="slh__card slh__card--motion">
            <p className="slh__card-label">
              <span aria-hidden="true" />
              {motion.label}
            </p>
            <p className="slh__card-title">{motion.title}</p>

            <dl className="slh__stats">
              {motion.stats.map((stat) => (
                <div className="slh__stat" key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd className="slh__stat-value" data-count={stat.value}>
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </article>

          <article className="slh__card slh__card--media">
            <a className="slh__card-play" href={film.hash} aria-label={film.label}>
              <Icon name="play" size={16} />
            </a>

            <figure className="slh__card-art">
              <img
                src={resolve(bench, 900)}
                srcSet={resolveSet(bench, [480, 720, 900, 1200])}
                sizes="(max-width: 699px) 92vw, (max-width: 1099px) 46vw, 24vw"
                alt={bench.alt}
                style={{ objectPosition: bench.focus }}
                width={900}
                height={700}
                loading="lazy"
                decoding="async"
              />
            </figure>

            <p className="slh__card-caption">{media.caption}</p>
          </article>

          <article className="slh__card slh__card--world">
            <p className="slh__card-title slh__card-title--lg">
              {world.titleLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </p>

            <svg className="slh__waves" viewBox="0 0 600 300" preserveAspectRatio="none" aria-hidden="true">
              <path pathLength="1" d="M-10 196C80 150 150 238 250 196S420 120 610 168" />
              <path pathLength="1" d="M-10 222C96 190 170 262 280 218S450 150 610 196" />
              <path pathLength="1" d="M-10 170C70 118 160 206 240 166S400 90 610 136" />
            </svg>

            <figure className="slh__card-art slh__card-art--arch">
              <img
                src={resolve(field, 900)}
                srcSet={resolveSet(field, [480, 720, 900, 1200])}
                sizes="(max-width: 699px) 60vw, (max-width: 1099px) 40vw, 22vw"
                alt={field.alt}
                style={{ objectPosition: field.focus }}
                width={900}
                height={900}
                loading="lazy"
                decoding="async"
              />
            </figure>

            <ul className="slh__strands">
              {world.links.map((link) => (
                <li key={link.hash}>
                  <a href={link.hash} aria-label={link.label} title={link.label}>
                    <Icon name={link.icon} size={19} />
                  </a>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
