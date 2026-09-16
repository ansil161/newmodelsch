import { Link } from 'react-router-dom';
import {
  GALLERY_YEARS,
  categoryLabel,
  eventHref,
  plural,
  yearHref,
  yearPhotoCount,
} from '@/constants/gallery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { rise, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Figure } from '@/components/editorial';

const ROWS = [
  [7, 5],
  [4, 4, 4],
  [5, 7],
];
const REMAINDER = { 1: [12], 2: [7, 5] };

const VARIANT = {
  12: { variant: 'full', ratio: 'wide', width: 1100, sizes: '(max-width: 900px) 92vw, 56vw' },
  7: { variant: 'feature', ratio: 'wide', width: 1000, sizes: '(max-width: 900px) 92vw, 52vw' },
  5: { variant: 'tall', ratio: 'portrait', width: 720, sizes: '(max-width: 900px) 92vw, 36vw' },
  4: { variant: 'third', ratio: 'landscape', width: 620, sizes: '(max-width: 900px) 92vw, 28vw' },
};

function layout(events) {
  const rows = [];
  let i = 0;
  let r = 0;
  while (i < events.length) {
    const left = events.length - i;
    let template = ROWS[r % ROWS.length];
    if (left < template.length) template = REMAINDER[left] ?? template.slice(0, left);
    rows.push(template.map((span, k) => ({ event: events[i + k], span })));
    i += template.length;
    r += 1;
  }
  return rows;
}

export function EventGrid({ year }) {
  const scope = useGsapScope((_, el) => {
    el.querySelectorAll('.gal-ev').forEach((card) => {
      unmask(card.querySelector('.gal-ev__media .fig'), { trigger: card });
      rise(card.querySelectorAll('.gal-ev__text > *'), { trigger: card, y: 18, delay: 0.25, stagger: 0.06 });
    });
    rise(el.querySelectorAll('.gal-evs__head > *'), { y: 20 });
  }, [year.id]);

  return (
    <section ref={scope} className="section gal-evs" aria-labelledby="gal-evs-title">
      <div className="wrap">
        <div className="gal-evs__head">
          <h2 id="gal-evs-title" className="ed-h1">
            The year, <span className="ed-em">event by event.</span>
          </h2>
          <p className="meta">
            {plural(year.events.length, 'event')} · {plural(yearPhotoCount(year), 'photograph')} · in
            the order they happened
          </p>
        </div>

        <div className="gal-evs__rows">
          {layout(year.events).map((row, r) => (
            <div className={`gal-evs__row gal-evs__row--${row.length}`} key={r}>
              {row.map(({ event, span }, k) => (
                <EventCard key={event.id} year={year} event={event} span={span} index={k} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EventCard({
  year,
  event,
  span,
  index = 0,
}) {
  const v = VARIANT[span] ?? VARIANT[4];

  return (
    <article
      className={`gal-ev gal-ev--${v.variant}${index === 1 ? ' gal-ev--drop' : ''}`}
      style={{ '--span': span }}
    >
      <Link to={eventHref(year, event)} className="gal-ev__link" data-cursor="Open">
        <div className="gal-ev__media">
          <Figure
            photo={event.cover}
            width={v.width}
            sizes={v.sizes}
            shape="frame"
            ratio={v.ratio}
            hover
            decorative
          >
            <span className="gal-ev__count" aria-hidden="true">
              <Icon name="camera" size={14} />
              {event.photos.length}
            </span>
          </Figure>
        </div>

        <div className="gal-ev__text">
          <p className="gal-ev__meta">
            <time className="meta">{event.date}</time>
            <span className="gal-ev__cat">{categoryLabel(event.category)}</span>
          </p>
          <h3 className="gal-ev__title">{event.title}</h3>
          <p className="gal-ev__desc">{event.description}</p>
          <span className="gal-ev__cta">
            View gallery · {plural(event.photos.length, 'photograph')}
            <Icon name="arrowRight" size={15} />
          </span>
        </div>
      </Link>
    </article>
  );
}

/* --------------------------------------------------------------------------
   YEAR PAGER - the neighbouring years, at the foot of a year page
   -------------------------------------------------------------------------- */

export function YearPager({ year }) {
  const i = GALLERY_YEARS.findIndex((y) => y.id === year.id);
  const newer = i > 0 ? GALLERY_YEARS[i - 1] : undefined;
  const older = i >= 0 && i < GALLERY_YEARS.length - 1 ? GALLERY_YEARS[i + 1] : undefined;

  const scope = useGsapScope((_, el) => {
    rise(el.querySelectorAll('.gal-pager__item'), { y: 30, stagger: 0.1 });
  }, [year.id]);

  if (!newer && !older) return null;

  return (
    <nav ref={scope} className="gal-pager wrap" aria-label="Other academic years">
      {[
        { y: older, label: 'An earlier year', dir: 'prev' },
        { y: newer, label: 'A later year', dir: 'next' },
      ].map(({ y, label, dir }) =>
        y ? (
          <Link key={dir} to={yearHref(y)} className={`gal-pager__item gal-pager__item--${dir}`} data-cursor="Open">
            <Figure photo={y.cover} width={360} sizes="160px" shape="frame" ratio="square-ar" hover decorative />
            <span className="gal-pager__text">
              <span className="meta">{label}</span>
              <span className="gal-pager__title">{y.title}</span>
              <span className="gal-pager__sub">{y.subtitle}</span>
            </span>
            <Icon name={dir === 'prev' ? 'arrowLeft' : 'arrowRight'} size={20} />
          </Link>
        ) : (
          <span key={dir} className="gal-pager__item gal-pager__item--empty" aria-hidden="true" />
        ),
      )}
    </nav>
  );
}
