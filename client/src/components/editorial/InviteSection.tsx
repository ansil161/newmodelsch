import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap, SplitText } from '@/lib/gsap';
import { drift, reduced, settle } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import type { IconName } from '@/components/common/Icon';
import { Hand } from './Hand';
import './invite.css';

/* ==========================================================================
   INVITE SECTION - the spread that closes a page
   --------------------------------------------------------------------------
   Four pages end on an invitation - come and visit, come and apply - and all
   four used to end on the same dark band with a photograph behind the type.
   This replaces it with a spread: the headline on one side, and on the other
   a collage of ordinary school days, pasted up and written on.

   The difference is the argument. A band says "here is a button". A spread
   says "this is what an ordinary Tuesday looks like - come and see it", and
   the photographs do the persuading so the copy does not have to.

   ONE SYSTEM, FOUR COMPOSITIONS

   The section owns the type, the button, the order things arrive in and the
   ground they sit on. The composition - which photograph leads, what lies
   over it, where the pen went - is a `Collage` the page passes in, so each
   spread keeps its own identity without a stylesheet of its own.

   THE HIERARCHY IS FIXED

     eyebrow      a small pill: the section's label
     headline     the serif statement, with one word written by hand
     lead         the supporting paragraph, in slate rather than ink
     extras       anything the invitation needs - visit times, say
     actions      one pill button, and at most one quiet link
     footnote     a deadline, a phone number, a caveat

   One handwritten word per headline. It is the loudest thing on the spread
   and it stops meaning anything the second time.
   ========================================================================== */

export interface InviteAction {
  label: string;
  /** An internal route. Use `href` for a phone number or an external link. */
  to?: string;
  href?: string;
  /** Defaults to an arrow. */
  icon?: IconName;
}

interface InviteSectionProps {
  id?: string;
  /** The small label above the headline. */
  eyebrow?: ReactNode;
  /**
   * Sets the eyebrow as a display line instead - a small label over a large
   * figure. For the admissions spread, where the year is the news.
   */
  year?: { label: string; figure: string };
  title: ReactNode;
  lead?: ReactNode;
  /** Anything between the lead and the actions. */
  children?: ReactNode;
  /** The first is the pill button; any after it are quiet text links. */
  actions: InviteAction[];
  footnote?: ReactNode;
  footIcon?: IconName;
  /** The `Collage` for this spread. */
  collage: ReactNode;
  /** Which side the copy sits on. */
  side?: 'left' | 'right';
  /** The collage runs off the right edge of the viewport. */
  bleed?: boolean;
  className?: string;
}

/**
 * The one word in a headline that is written rather than set. A child of the
 * headline, so it wraps with it and is read as part of the sentence; the
 * swash under it is drawn, and hidden from assistive tech.
 *
 * `tone` exists for the community stories section on the home page, which is
 * the one spread on the site set in blue rather than in the school yellow.
 * The hand is the same hand; only the ink changes.
 */
export function Script({ children, tone = 'sun' }: { children: ReactNode; tone?: 'sun' | 'blue' }) {
  return (
    <span className={tone === 'sun' ? 'script' : 'script script--blue'}>
      {children}
      <Hand kind="swash" tone={tone} className="script__swash" />
    </span>
  );
}

/* The offset each print is slid in from, by the side it enters on. Small on
   purpose: the print should look placed, not thrown. */
const ENTRY: Record<string, [number, number]> = {
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
}: InviteSectionProps) {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const plate = el.querySelector<HTMLElement>('.clg');
    const heading = el.querySelector<HTMLElement>('.invite__title');

    // The button is magnetic, as every primary ask on the site is.
    const teardowns = Array.from(el.querySelectorAll<HTMLElement>('.invite__cta')).map((b) =>
      settle(b, 0.24),
    );

    // Parallax. Every item in the paste-up drifts at its own depth, so the
    // collage separates into layers as the reader passes it - the lead least,
    // the smallest prints most, which is what puts them nearest.
    el.querySelectorAll<HTMLElement>('.clg__item').forEach((item) => {
      const depth = Number(item.dataset.depth ?? 0);
      if (depth) drift(item, depth, { trigger: plate ?? el });
    });

    if (reduced()) return () => teardowns.forEach((fn) => fn?.());

    /* ------------------------------------------------------------------
       The copy. Triggered on the headline rather than the column, because
       on a phone the column is `display: contents` and has no box.
       ------------------------------------------------------------------ */
    const copy = gsap.timeline({
      defaults: { ease: 'power3.out' },
      scrollTrigger: { trigger: heading ?? el, start: 'top 86%', once: true },
    });

    copy.from(el.querySelectorAll('[data-in="eyebrow"]'), { y: 16, autoAlpha: 0, duration: 0.7 });

    const figure = el.querySelector('.invite__year-fig');
    if (figure) {
      copy.from(figure, { yPercent: 34, autoAlpha: 0, duration: 1.2, ease: 'expo.out' }, 0.06);
    }

    // The headline rises line by line, unmasked - the handwritten word hangs
    // below the baseline, and a line mask would clip its tail. The split is
    // reverted the moment it lands, so the headline goes back to reflowing
    // as one piece of text.
    let split: SplitText | undefined;
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

    /* ------------------------------------------------------------------
       The collage, on its own trigger - on a phone it sits a screen below
       the headline, and should arrive when it is actually reached.
       ------------------------------------------------------------------ */
    if (plate) {
      const paste = gsap.timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: { trigger: plate, start: 'top 82%', once: true },
      });

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
      plate.querySelectorAll<HTMLElement>('.clg__photo--print').forEach((print, i) => {
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
    }

    return () => {
      teardowns.forEach((fn) => fn?.());
      split?.revert();
    };
  }, []);

  const classes = ['invite', `invite--${side}`, bleed ? 'invite--bleed' : '', className]
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
function draw(tl: gsap.core.Timeline, strokes: NodeListOf<Element>, at: number) {
  if (!strokes.length) return;
  tl.fromTo(
    strokes,
    { strokeDasharray: 1, strokeDashoffset: 1 },
    { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut', stagger: 0.14 },
    at,
  );
}
