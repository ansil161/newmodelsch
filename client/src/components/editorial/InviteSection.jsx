import { Link } from 'react-router-dom';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap, SplitText } from '@/lib/gsap';
import { drift, playOnScroll, reduced, settle } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Hand } from './Hand';
import './invite.css';

/**
 * The one word in a headline that is written rather than set. A child of the
 * headline, so it wraps with it and is read as part of the sentence; the
 * swash under it is drawn, and hidden from assistive tech.
 *
 * `tone` exists for the community stories section on the home page, which is
 * the one spread on the site set in blue rather than in the school yellow.
 * The hand is the same hand; only the ink changes.
 */
export function Script({ children, tone = 'sun' }) {
  return (
    <span className={tone === 'sun' ? 'script' : 'script script--blue'}>
      {children}
      <Hand kind="swash" tone={tone} className="script__swash" />
    </span>
  );
}

/* The offset each print is slid in from, by the side it enters on. Small on
   purpose: the print should look placed, not thrown. */
const ENTRY = {
  left: [-48, 14],
  right: [48, 14],
  top: [12, -44],
  bottom: [-10, 48],
};

export function InviteSection({
  id,
  eyebrow,
  year,
  title,
  lead,
  children,
  actions,
  footnote,
  footIcon = 'arrowRight',
  collage,
  side = 'left',
  bleed = false,
  className = '',
}) {
  const scope = useGsapScope((_, el) => {
    const plate = el.querySelector('.clg');
    const heading = el.querySelector('.invite__title');

    // The button is magnetic, as every primary ask on the site is.
    const teardowns = Array.from(el.querySelectorAll('.invite__cta')).map((b) =>
      settle(b, 0.24),
    );

    // Parallax. Every item in the paste-up drifts at its own depth, so the
    // collage separates into layers as the reader passes it - the lead least,
    // the smallest prints most, which is what puts them nearest.
    el.querySelectorAll('.clg__item').forEach((item) => {
      const depth = Number(item.dataset.depth ?? 0);
      if (depth) drift(item, depth, { trigger: plate ?? el });
    });

    if (reduced()) return () => teardowns.forEach((fn) => fn?.());

    /* ------------------------------------------------------------------
       The copy. Triggered on the headline rather than the column, because
       on a phone the column is `display: contents` and has no box.
       ------------------------------------------------------------------ */
    const copy = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });

    copy.from(el.querySelectorAll('[data-in="eyebrow"]'), { y: 16, autoAlpha: 0, duration: 0.7 });

    const figure = el.querySelector('.invite__year-fig');
    if (figure) {
      copy.from(figure, { yPercent: 34, autoAlpha: 0, duration: 1.2, ease: 'expo.out' }, 0.06);
    }

    // The headline rises line by line, unmasked - the handwritten word hangs
    // below the baseline, and a line mask would clip its tail. The split is
    // reverted the moment it lands, so the headline goes back to reflowing
    // as one piece of text.
    let split;
    if (heading) {
      split = new SplitText(heading, { type: 'lines', linesClass: 'invite__line' });
      copy.from(
        split.lines,
        {
          yPercent: 55,
          autoAlpha: 0,
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.1,
          onComplete: () => split?.revert(),
        },
        0.14,
      );
    }

    copy.from(el.querySelectorAll('[data-in="copy"]'), { y: 18, autoAlpha: 0, duration: 0.85, stagger: 0.08 }, 0.5);

    // The swash under the handwritten word, and under the year. They land
    // after the headline has settled: someone marking a sentence after
    // writing it, not part of the same motion.
    draw(copy, el.querySelectorAll('.invite__copy [data-stroke]'), 1.0);
    playOnScroll(copy, { trigger: heading ?? el, start: 'top 86%' });

    /* ------------------------------------------------------------------
       The collage, on its own trigger - on a phone it sits a screen below
       the headline, and should arrive when it is actually reached.
       ------------------------------------------------------------------ */
    if (plate) {
      const paste = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });

      paste.from(plate.querySelectorAll('.clg__mark--brush'), {
        autoAlpha: 0,
        scale: 0.94,
        duration: 1.4,
        ease: 'power2.out',
      }, 0);

      // The lead: rises a little and settles from 1.05, so it reads as the
      // photograph being set down rather than faded up.
      const lead = plate.querySelector('.clg__photo--main .clg__enter');
      const leadImage = plate.querySelector('.clg__photo--main img');
      if (lead) paste.from(lead, { y: 44, autoAlpha: 0, duration: 1.2 }, 0.05);
      if (leadImage) paste.fromTo(leadImage, { scale: 1.05 }, { scale: 1, duration: 1.8, ease: 'power2.out' }, 0.05);

      // The prints, each from its own side with a little extra tilt that
      // unwinds as it lands - a hand putting it down, not a slide transition.
      plate.querySelectorAll('.clg__photo--print').forEach((print, i) => {
        const [x, y] = ENTRY[print.dataset.from ?? 'bottom'] ?? ENTRY.bottom;
        paste.from(
          print.querySelector('.clg__enter'),
          { x, y, rotation: i % 2 ? 5 : -5, autoAlpha: 0, duration: 1.15 },
          0.38 + i * 0.12,
        );
      });

      draw(paste, plate.querySelectorAll('.clg__mark:not(.clg__mark--brush) [data-stroke]'), 0.9);

      // The handwriting is written on, left to right, rather than faded.
      const ink = plate.querySelectorAll('.clg__ink');
      if (ink.length) {
        paste.fromTo(
          ink,
          { clipPath: 'inset(-30% 100% -40% -8%)' },
          { clipPath: 'inset(-30% -8% -40% -8%)', duration: 0.8, ease: 'power2.inOut', stagger: 0.18 },
          1.25,
        );
      }

      playOnScroll(paste, { trigger: plate, start: 'top 82%' });
    }

    return () => {
      teardowns.forEach((fn) => fn?.());
      split?.revert();
    };
  }, []);

  const classes = ['invite', 'ground-paper', `invite--${side}`, bleed ? 'invite--bleed' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <section ref={scope} id={id} className={classes}>
      <div className="wrap invite__grid">
        <div className="invite__copy">
          {year ? (
            <div className="invite__year" data-in="eyebrow">
              <p className="invite__eyebrow">{year.label}</p>
              <p className="invite__year-fig">
                {year.figure}
                <Hand kind="swash" className="invite__year-swash" />
              </p>
            </div>
          ) : (
            <p className="invite__eyebrow" data-in="eyebrow">
              {eyebrow}
            </p>
          )}

          <h2 className="invite__title">{title}</h2>

          {lead ? (
            <p className="invite__lead" data-in="copy">
              {lead}
            </p>
          ) : null}

          {children ? (
            <div className="invite__extra" data-in="copy">
              {children}
            </div>
          ) : null}

          <div className="invite__actions" data-in="copy">
            {actions.map((action, i) => {
              const primary = i === 0;
              const icon = action.icon ?? 'arrowRight';
              const cls = primary ? 'btn btn-sun invite__cta' : 'invite__link';
              const inner = primary ? (
                <span className="btn__label">
                  {action.label}
                  <Icon name={icon} size={17} />
                </span>
              ) : (
                <>
                  {action.label}
                  <Icon name={icon} size={15} />
                </>
              );
              return action.to ? (
                <Link className={cls} to={action.to} key={action.label}>
                  {inner}
                </Link>
              ) : (
                <a className={cls} href={action.href} key={action.label}>
                  {inner}
                </a>
              );
            })}
          </div>

          {footnote ? (
            <p className="invite__foot" data-in="copy">
              <span className="invite__foot-icon" aria-hidden="true">
                <Icon name={footIcon} size={14} />
              </span>
              <span>{footnote}</span>
            </p>
          ) : null}
        </div>

        <div className="invite__media">{collage}</div>
      </div>
    </section>
  );
}

/** Runs a set of `pathLength="1"` strokes from undrawn to drawn. */
function draw(tl, strokes, at) {
  if (!strokes.length) return;
  tl.fromTo(
    strokes,
    { strokeDasharray: 1, strokeDashoffset: 1 },
    { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut', stagger: 0.14 },
    at,
  );
}
