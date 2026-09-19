import { Link } from 'react-router-dom';
import { categoryLabel, eventHref, plural } from '@/constants/gallery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { SplitText, gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { onStage, stageOpen } from '@/lib/stage';
import { Icon } from '@/components/common/Icon';
import { Figure, Sticker } from '@/components/editorial';
import { useLightbox } from './PhotoLightbox';

/* ==========================================================================
   EVENT HEADER - the wall label of an exhibition
   --------------------------------------------------------------------------
   Title, date, place and a paragraph, set the way a gallery sets the card
   beside the first picture in a room, with the button that starts the
   slideshow from the first photograph.
   ========================================================================== */

export function EventHeader({ year, event }) {
  const open = useLightbox();

  const scope = useGsapScope((_, el) => {
    if (reduced()) return;
    const title = el.querySelector('.gal-ehead__title');
    const split = title ? new SplitText(title, { type: 'lines', mask: 'lines', linesClass: 'split-line' }) : null;

    const tl = gsap.timeline({ paused: !stageOpen(), defaults: { ease: 'power4.out' } });
    tl.from('.gal-ehead__tag > *', { y: 14, autoAlpha: 0, duration: 0.6, stagger: 0.08 }, 0)
      .from(split?.lines ?? [], { yPercent: 118, duration: 1.1, stagger: 0.09 }, 0.1)
      .from('.gal-ehead__label > *', { y: 20, autoAlpha: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' }, 0.45)
      .from('.gal-ehead__thumb', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'power4.inOut' }, 0.3);

    // The split exists for the entrance only. Put the title back once it has
    // played, so a later resize or rotation re-wraps real text rather than
    // leaving stale lines to wrap again inside their own clipping masks.
    tl.eventCallback('onComplete', () => split?.revert());

    const release = onStage(() => tl.play());
    return () => {
      release();
      tl.kill();
      split?.revert();
    };
  }, [event.id]);

  const index = year.events.findIndex((e) => e.id === event.id);
  const next = year.events[index + 1];

  return (
    <header ref={scope} className="gal-ehead wrap">
      <div className="gal-ehead__main">
        <div className="gal-ehead__tag">
          <Sticker tone="blue" tilt={-2}>
            {categoryLabel(event.category)}
          </Sticker>
          <span className="meta">
            {year.title} · Event {String(index + 1).padStart(2, '0')} of {String(year.events.length).padStart(2, '0')}
          </span>
        </div>
        <h1 className="ed-hero gal-ehead__title">{event.title}</h1>
      </div>

      <div className="gal-ehead__label">
        <dl className="gal-ehead__facts">
          <div>
            <dt>Date</dt>
            <dd>
              <time>{event.date}</time>
            </dd>
          </div>
          {event.venue ? (
            <div>
              <dt>Venue</dt>
              <dd>{event.venue}</dd>
            </div>
          ) : null}
          <div>
            <dt>Collection</dt>
            <dd>{plural(event.photos.length, 'photograph')}</dd>
          </div>
        </dl>

        <p className="gal-ehead__quote">{event.description}</p>
        <p className="body-text">{event.story}</p>

        <div className="gal-ehead__actions">
          <button type="button" className="btn btn-primary" onClick={() => open(event.photos, 0, event.title)}>
            <span className="btn__label">
              View as slideshow
              <Icon name="play" size={14} />
            </span>
          </button>
          {next ? (
            <Link className="link" to={eventHref(year, next)}>
              Next: {next.title}
              <Icon name="arrowRight" size={15} />
            </Link>
          ) : null}
        </div>
      </div>

      <Figure
        photo={event.cover}
        width={420}
        sizes="(max-width: 900px) 40vw, 16vw"
        shape="arch"
        ratio="portrait"
        eager
        decorative
        className="gal-ehead__thumb"
      />
    </header>
  );
}

/* --------------------------------------------------------------------------
   EVENT PAGER - the next and previous event, at the foot of an event page
   -------------------------------------------------------------------------- */

export function EventPager({ year, event }) {
  const i = year.events.findIndex((e) => e.id === event.id);
  const prev = year.events[i - 1];
  const next = year.events[i + 1];
  if (!prev && !next) return null;

  return (
    <nav className="gal-pager wrap" aria-label={`More from ${year.title}`}>
      {[
        { e: prev, label: 'Previous event', dir: 'prev' },
        { e: next, label: 'Next event', dir: 'next' },
      ].map(({ e, label, dir }) =>
        e ? (
          <Link key={dir} to={eventHref(year, e)} className={`gal-pager__item gal-pager__item--${dir}`} data-cursor="Open">
            <Figure photo={e.cover} width={360} sizes="160px" shape="frame" ratio="square-ar" hover decorative />
            <span className="gal-pager__text">
              <span className="meta">{label}</span>
              <span className="gal-pager__title">{e.title}</span>
              <span className="gal-pager__sub">{e.date}</span>
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
