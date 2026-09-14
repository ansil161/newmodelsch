import { Link } from 'react-router-dom';
import { GALLERY_TOTALS, GALLERY_YEARS, plural, yearHref, yearPhotoCount } from '@/constants/gallery';
import type { GalleryYear } from '@/constants/gallery';
import { resolve } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { grow, rise, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Figure, Mark, SectionHead } from '@/components/editorial';

/* ==========================================================================
   EVERY YEAR LEAVES A MARK - the archive of years
   --------------------------------------------------------------------------
   Four school years along a timeline, set on navy so the section reads as
   the page turned over to the archive.

   EACH YEAR IS A STACK OF PRINTS, NOT A CARD.

   Behind every cover sit two more photographs from that year, squared up
   under it. Hover or focus a year and the stack fans open - the prints
   swing out from under the cover - because a year is not one picture, it is
   a pile of them, and that is the thing the card is inviting you to open.

   The current year is set larger and carries the only filled node on the
   line. The frames step up and down against the line so the four read as a
   sequence in time rather than a row of equal tiles, and the line itself is
   drawn by the reader's scroll.
   ========================================================================== */

export function YearArchive() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const track = el.querySelector<HTMLElement>('.gal-years__track');
    if (!track) return;
    rise(el.querySelectorAll<HTMLElement>('.gal-year'), { trigger: track, y: 64, stagger: 0.12 });
    unmask(el.querySelectorAll<HTMLElement>('.gal-year__cover'), { trigger: track, stagger: 0.12 });
    grow(el.querySelector<HTMLElement>('.gal-years__line-fill'), {
      axis: 'x',
      trigger: track,
      end: 'bottom 60%',
    });
    rise(el.querySelectorAll<HTMLElement>('.gal-year__node'), {
      trigger: track,
      y: 0,
      delay: 0.4,
      stagger: 0.14,
    });
  }, []);

  return (
    <section ref={scope} id="archive" className="section section--navy on-navy gal-years">
      <div className="wrap">
        <div className="gal-years__head">
          <SectionHead
            sticker="03 · The archive"
            stickerTilt={2.2}
            title={
              <>
                Every year leaves a <Mark kind="underline">mark.</Mark>
              </>
            }
            lead="Step into the memories that shaped each school year."
          />
          <p className="gal-years__total meta">
            {plural(GALLERY_TOTALS.years, 'year')} · {plural(GALLERY_TOTALS.events, 'event')} ·{' '}
            {plural(GALLERY_TOTALS.photos, 'photograph')}
          </p>
        </div>

        <ol className="gal-years__track">
          {GALLERY_YEARS.map((year, i) => (
            <YearCard key={year.id} year={year} index={i} />
          ))}
          <li className="gal-years__line" aria-hidden="true">
            <span className="gal-years__line-fill" />
          </li>
        </ol>
      </div>
    </section>
  );
}

export function YearCard({ year, index }: { year: GalleryYear; index: number }) {
  const current = index === 0;
  const prints = year.events.filter((e) => e.cover.id !== year.cover.id).slice(0, 2);

  return (
    <li className={`gal-year gal-year--${index}${current ? ' is-current' : ''}`}>
      <Link to={yearHref(year)} className="gal-year__link" data-cursor="Open">
        <div className="gal-year__visual">
          <div className="gal-year__stack" aria-hidden="true">
            {prints.map((ev, k) => (
              <span className={`gal-year__print gal-year__print--${k}`} key={ev.id}>
                <img src={resolve(ev.cover, 420)} alt="" loading="lazy" decoding="async" />
              </span>
            ))}
          </div>

          <Figure
            photo={year.cover}
            width={current ? 760 : 560}
            sizes={current ? '(max-width: 900px) 80vw, 30vw' : '(max-width: 900px) 72vw, 22vw'}
            shape="frame"
            ratio="portrait"
            hover
            decorative
            className="gal-year__cover"
          >
            <span className="gal-year__over">
              {current ? <span className="gal-year__badge">This year</span> : null}
              <span className="gal-year__sub">{year.subtitle}</span>
            </span>
          </Figure>
        </div>

        <span className="gal-year__meta">
          <span className="gal-year__title">{year.title}</span>
          <span className="gal-year__stats">
            {plural(year.events.length, 'event')} · {plural(yearPhotoCount(year), 'photograph')}
          </span>
          <span className="gal-year__arrow" aria-hidden="true">
            <Icon name="arrowUpRight" size={18} />
          </span>
        </span>
      </Link>
      <span className="gal-year__node" aria-hidden="true" />
    </li>
  );
}
