import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FEATURED_STORIES, categoryLabel, eventHref, plural } from '@/constants/gallery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { gsap } from '@/lib/gsap';
import { drift, reduced, rise, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Mark, SectionHead } from '@/components/editorial';
import { useLightbox } from './PhotoLightbox';
import { PhotoTile } from './PhotoTile';

/* ==========================================================================
   ONE MOMENT, MANY STORIES - the featured event
   --------------------------------------------------------------------------
   One event at a time, set as a spread: the lead photograph with a date
   stamp pressed onto its corner, the title and the story beside it, and
   three prints from the same day laid under the text.

   Four stories share the spread. Choosing another wipes the new lead
   photograph across the old one from the right - both frames stay in the
   DOM, stacked, so the old picture is still there underneath while the new
   one is drawn over it rather than the frame blinking empty - and the text
   and prints re-set themselves after it.
   ========================================================================== */

const pad = (n) => String(n).padStart(2, '0');

export function FeaturedMemory() {
  const open = useLightbox();
  const [active, setActive] = useState(0);
  const [previous, setPrevious] = useState(0);
  const rootRef = useRef(null);
  /* The story last animated to. A "has mounted" flag is not enough: StrictMode
     runs layout effects twice on mount, and the second run would play the
     switch transition on arrival. */
  const played = useRef(0);

  const story = FEATURED_STORIES[active];

  const scope = useGsapScope((_, el) => {
    rootRef.current = el;
    const body = el.querySelector('.gal-feat__body');
    unmask(el.querySelector('.gal-feat__visual'), { trigger: body, from: 'left' });
    rise(el.querySelectorAll('.gal-feat__pick'), { trigger: body, y: 16, stagger: 0.06 });
    rise(el.querySelectorAll('.gal-feat__text > *'), { trigger: body, y: 22, delay: 0.25 });
    rise(el.querySelectorAll('.gal-feat__print'), { trigger: body, y: 50, delay: 0.45, stagger: 0.1 });
    drift(el.querySelector('.gal-feat__stamp'), -70, { trigger: el });
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (played.current === active) return;
    played.current = active;
    const el = rootRef.current;
    if (!el || reduced()) return;

    const main = el.querySelector(`.gal-feat__main[data-index="${active}"]`);
    const tl = gsap.timeline();
    if (main) {
      tl.fromTo(main, { clipPath: 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.05, ease: 'power4.inOut' }, 0)
        .fromTo(main.querySelector('img'), { scale: 1.18 }, { scale: 1, duration: 1.5, ease: 'power3.out' }, 0);
    }
    tl.fromTo(el.querySelectorAll('.gal-feat__text > *'), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.06, ease: 'power3.out' }, 0.25)
      .fromTo(el.querySelectorAll('.gal-feat__print'), { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.08, ease: 'power3.out' }, 0.4)
      .fromTo(el.querySelector('.gal-feat__stamp'), { scale: 0.6, rotate: -30 }, { scale: 1, rotate: 0, duration: 0.8, ease: 'back.out(1.6)' }, 0.55);

    return () => {
      tl.kill();
    };
  }, [active]);

  if (!story) return null;

  const choose = (i) => {
    if (i === active) return;
    setPrevious(active);
    setActive(i);
  };

  const { year, event } = story;
  const [day, month, yr] = event.date.split(' ');
  const prints = event.photos.slice(1, 4);

  return (
    <section ref={scope} id="featured" className="section gal-feat ground-paper">
      <div className="wrap">
        <SectionHead
          sticker="05 · Featured story"
          stickerTone="coral"
          stickerTilt={2}
          title={
            <>
              One moment, many <Mark>stories.</Mark>
            </>
          }
          className="gal-feat__head"
        />

        <div className="gal-feat__body">
          <div className="gal-feat__visual">
            {FEATURED_STORIES.map((s, i) => (
              <div
                key={`${s.year.id}-${s.event.id}`}
                data-index={i}
                className={`gal-feat__main${i === active ? ' is-active' : ''}${i === previous && i !== active ? ' is-previous' : ''}`}
                aria-hidden={i !== active || undefined}
              >
                <PhotoTile
                  photo={s.event.cover}
                  width={1100}
                  sizes="(max-width: 900px) 92vw, 48vw"
                  shape="blob-2"
                  ratio="portrait"
                  label={categoryLabel(s.event.category)}
                  tabIndex={i === active ? undefined : -1}
                  onOpen={() => open(s.event.photos, 0, s.event.title)}
                />
              </div>
            ))}

            <p className="gal-feat__stamp" aria-hidden="true">
              <b>{day}</b>
              <span>
                {month?.slice(0, 3)} {yr}
              </span>
            </p>
          </div>

          <div className="gal-feat__side">
            <ol className="gal-feat__picks" aria-label="Featured stories">
              {FEATURED_STORIES.map((s, i) => (
                <li key={`${s.year.id}-${s.event.id}`} className="gal-feat__pick">
                  <button
                    type="button"
                    className={`gal-feat__pick-btn${i === active ? ' is-on' : ''}`}
                    aria-pressed={i === active}
                    onClick={() => choose(i)}
                  >
                    <span className="gal-feat__pick-num">{pad(i + 1)}</span>
                    <span className="gal-feat__pick-title">{s.event.title}</span>
                    <span className="gal-feat__pick-year">{s.year.title}</span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="gal-feat__text" aria-live="polite">
              <p className="meta">
                {year.title} · {categoryLabel(event.category)} ·{' '}
                {plural(event.photos.length, 'photograph')}
              </p>
              <h3 className="ed-h1 gal-feat__title">{event.title}</h3>
              <p className="gal-feat__date">
                <Icon name="calendar" size={16} />
                <time>{event.date}</time>
                {event.venue ? <span> · {event.venue}</span> : null}
              </p>
              <p className="gal-feat__quote">“{event.description}”</p>
              <p className="gal-feat__story">{event.story}</p>
              <div className="gal-feat__actions">
                <Link className="btn btn-sun" to={eventHref(year, event)}>
                  <span className="btn__label">
                    Explore story
                    <Icon name="arrowUpRight" size={16} />
                  </span>
                </Link>
              </div>
            </div>

            <div className="gal-feat__prints">
              {prints.map((photo, k) => (
                <div className={`gal-feat__print gal-feat__print--${k}`} key={`${event.id}-${photo.id}`}>
                  <PhotoTile
                    photo={photo}
                    width={360}
                    sizes="(max-width: 900px) 30vw, 12vw"
                    shape="frame"
                    ratio="square-ar"
                    onOpen={() => open(event.photos, k + 1, event.title)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
