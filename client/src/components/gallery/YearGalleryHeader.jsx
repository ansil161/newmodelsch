import { NavLink } from 'react-router-dom';
import { GALLERY_CATEGORIES, GALLERY_YEARS, plural, yearHref, yearPhotoCount } from '@/constants/gallery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { SplitText, gsap } from '@/lib/gsap';
import { drift, reduced } from '@/lib/motion';
import { onStage, stageOpen } from '@/lib/stage';
import { Sticker } from '@/components/editorial';
import { useLightbox } from './PhotoLightbox';
import { PhotoTile } from './PhotoTile';

/* ==========================================================================
   YEAR GALLERY HEADER - the cover of one year's album
   --------------------------------------------------------------------------
   The academic year set at the largest size the site has, because on this
   page the year is the title. The year's own line sits under it in the
   italic, the facts beside the introduction, and then one wide photograph
   with a switcher to the other years pinned to its foot.
   ========================================================================== */

export function YearGalleryHeader({ year }) {
  const open = useLightbox();
  const photos = year.events.flatMap((e) => e.photos);
  const coverIndex = Math.max(0, photos.findIndex((p) => p.id === year.cover.id));
  const categories = new Set(year.events.map((e) => e.category)).size;

  const scope = useGsapScope((_, el) => {
    drift(el.querySelector('.gal-yhead__media .gal-tile__fig img'), 80, { trigger: el.querySelector('.gal-yhead__media') });
    if (reduced()) return;

    const title = el.querySelector('.gal-yhead__title');
    const split = title ? new SplitText(title, { type: 'chars', charsClass: 'split-char' }) : null;

    const tl = gsap.timeline({ paused: !stageOpen(), defaults: { ease: 'power4.out' } });
    tl.from('.gal-yhead__tag > *', { y: 14, autoAlpha: 0, duration: 0.6, stagger: 0.08 }, 0)
      .from(split?.chars ?? [], { yPercent: 70, autoAlpha: 0, duration: 1, stagger: 0.05 }, 0.1)
      .from('.gal-yhead__sub', { y: 24, autoAlpha: 0, duration: 0.9 }, 0.45)
      .from('.gal-yhead__row > *', { y: 20, autoAlpha: 0, duration: 0.8, stagger: 0.1 }, 0.6)
      .from('.gal-yhead__media', { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.3, ease: 'power4.inOut' }, 0.5)
      .from('.gal-yhead__media img', { scale: 1.12, duration: 1.8, ease: 'power3.out' }, 0.5)
      .from('.gal-yhead__years', { y: 16, autoAlpha: 0, duration: 0.7 }, 1.2);

    const release = onStage(() => tl.play());
    return () => {
      release();
      tl.kill();
      split?.revert();
    };
  }, [year.id]);

  return (
    <header ref={scope} className="gal-yhead">
      <div className="wrap">
        <div className="gal-yhead__tag">
          <Sticker tilt={-2.2}>Academic year</Sticker>
          <span className="meta">{year.span}</span>
        </div>

        <h1 className="ed-mega gal-yhead__title">
          <span className="sr-only">Gallery, academic year </span>
          {year.title}
        </h1>
        <p className="ed-h2 gal-yhead__sub">
          <span className="ed-em">{year.subtitle}.</span>
        </p>

        <div className="gal-yhead__row">
          <p className="lead gal-yhead__intro">{year.intro}</p>
          <dl className="gal-yhead__facts">
            <div>
              <dt>Events</dt>
              <dd className="stat-num">{year.events.length}</dd>
            </div>
            <div>
              <dt>Photographs</dt>
              <dd className="stat-num">{yearPhotoCount(year)}</dd>
            </div>
            <div>
              <dt>Categories</dt>
              <dd className="stat-num">
                {categories}
                <small>/{GALLERY_CATEGORIES.length}</small>
              </dd>
            </div>
          </dl>
        </div>

        <div className="gal-yhead__media">
          <PhotoTile
            photo={year.cover}
            width={1800}
            sizes="(max-width: 900px) 100vw, 88vw"
            shape="frame"
            ratio="cinema"
            label={plural(photos.length, 'photograph')}
            eager
            onOpen={() => open(photos, coverIndex, year.title)}
          />

          <nav className="gal-yhead__years" aria-label="Academic years">
            {GALLERY_YEARS.map((y) => (
              <NavLink
                key={y.id}
                to={yearHref(y)}
                end
                className={({ isActive }) => `gal-yhead__year${isActive ? ' is-current' : ''}`}
              >
                {y.title}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
