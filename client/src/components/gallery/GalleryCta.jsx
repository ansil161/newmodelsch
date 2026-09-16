import { Link } from 'react-router-dom';
import { GALLERY_YEARS, yearHref } from '@/constants/gallery';
import { resolve } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { draw, drift, lines, reduced, rise, settle } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Mark, Sticker } from '@/components/editorial';

/* ==========================================================================
   THE CLOSE - "There are more stories to discover."
   --------------------------------------------------------------------------
   The statement sits in the middle of a table of scattered prints - one
   cover from every event not already featured above - each at its own angle
   and each drifting at its own depth as the page scrolls, so the last screen
   feels like the archive has been tipped out onto the desk.

   The button goes to the newest year, which is where the archive starts; the
   year chips under it go straight to the others.
   ========================================================================== */

const SCATTER = GALLERY_YEARS.flatMap((y) => y.events.map((e) => e.cover))
  .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i)
  .filter((_, i) => i % 3 === 1)
  .slice(0, 6);

export function GalleryCta() {
  const scope = useGsapScope((_, el) => {
    const title = el.querySelector('.gal-cta__title');
    const revert = title ? lines(title, { trigger: el }) : undefined;
    draw(el, { trigger: el, delay: 0.7 });
    rise(el.querySelectorAll('.gal-cta__tag, .gal-cta__lead, .gal-cta__actions, .gal-cta__years'), {
      trigger: el,
      y: 20,
      delay: 0.3,
    });

    el.querySelectorAll('[data-depth]').forEach((node) => {
      drift(node, Number(node.dataset.depth), { trigger: el });
    });

    if (!reduced()) {
      gsap.from(el.querySelectorAll('.gal-cta__print'), {
        autoAlpha: 0,
        scale: 0.85,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: { trigger: el, start: 'top 75%', once: true },
      });
    }

    const button = el.querySelector('.gal-cta__btn');
    const unsettle = button ? settle(button) : undefined;
    return () => {
      unsettle?.();
      revert?.();
    };
  }, []);

  const latest = GALLERY_YEARS[0];

  return (
    <section ref={scope} className="section gal-cta">
      <div className="gal-cta__scatter" aria-hidden="true">
        {SCATTER.map((photo, i) => (
          <span className={`gal-cta__print gal-cta__print--${i}`} key={photo.id}>
            <span className="gal-cta__print-inner" data-depth={[120, -80, 160, -120, 90, -60][i]}>
              <img src={resolve(photo, 360)} alt="" loading="lazy" decoding="async" />
            </span>
          </span>
        ))}
      </div>

      <div className="wrap gal-cta__inner">
        <div className="gal-cta__tag">
          <Sticker tone="ink" tilt={-2}>
            The complete archive
          </Sticker>
        </div>
        <h2 className="ed-h1 gal-cta__title">
          There are more stories to <Mark>discover.</Mark>
        </h2>
        <p className="lead gal-cta__lead">
          Explore the celebrations, achievements, friendships, and everyday moments captured
          throughout the school years.
        </p>
        {latest ? (
          <div className="gal-cta__actions">
            <Link className="btn btn-primary gal-cta__btn" to={yearHref(latest)}>
              <span className="btn__label">
                Explore the archive
                <Icon name="arrowRight" size={16} />
              </span>
            </Link>
          </div>
        ) : null}
        <ul className="gal-cta__years" aria-label="Browse by academic year">
          {GALLERY_YEARS.map((year) => (
            <li key={year.id}>
              <Link className="chip gal-cta__year" to={yearHref(year)}>
                {year.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
