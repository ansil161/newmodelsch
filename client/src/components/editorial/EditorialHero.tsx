import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { count, draw, drift, reduced, settle } from '@/lib/motion';
import { onStage, stageOpen } from '@/lib/stage';
import { Icon } from '@/components/common/Icon';
import { Figure } from './Figure';
import { Sticker } from './primitives';

/* ==========================================================================
   EDITORIAL HERO - the opening composition
   --------------------------------------------------------------------------
   Oversized type on the left, one large photograph on the right, and three or
   four small figures floating in the space between them.

   IT IS NOT A FULL-BLEED PHOTOGRAPH WITH A HEADLINE ON TOP.

   That is the default for a school, and it costs the two things this hero
   needs most: the headline can only ever be as loud as the photograph's
   quietest corner, and the statistics have nowhere to go but a bar underneath.
   Splitting the screen lets the type be genuinely large and lets the figures
   sit *in* the composition instead of below it.

   THE ENTRANCE, IN ORDER

     0.00  the sticker
     0.15  the headline, line by line from under its own mask
     0.35  the photograph unmasks from the bottom edge while the image inside
           it settles from 1.06 to 1
     0.75  the highlighter is drawn
     0.85  the figures, the buttons and the scroll cue rise together

   The photograph starting *before* the headline has finished is deliberate.
   Waiting for a complete headline makes the picture read as a second event;
   overlapping them makes the whole screen read as one arrival.

   WHEN IT PLAYS IS NOT THE SAME QUESTION AS WHEN IT IS BUILT.

   On a first visit the brand intro is holding an ivory sheet over this
   composition while React mounts it. Playing on mount would spend the whole
   two-second arrival behind that sheet and hand the visitor a finished hero
   the instant it lifted. So the timeline is built paused whenever the stage
   is closed and released by `onStage` as the sheet opens - the headline
   arrives *into* the reveal, which is the entire point of it. On any load
   without a transition the stage is already open and `onStage` plays it
   synchronously, so nothing about the ordinary case changes.

   AFTER THE ENTRANCE, THE PHOTOGRAPH DRIFTS.

   A small parallax on scroll - eighty pixels over the whole hero. It is the
   only motion left running, and it exists so the first scroll gesture is
   answered by something rather than by the page simply leaving.
   ========================================================================== */

interface HeroAction {
  label: string;
  to?: string;
  href?: string;
  variant?: 'primary' | 'sun' | 'secondary';
}

export interface HeroFigure {
  value: string;
  label: string;
}

interface EditorialHeroProps {
  sticker?: string;
  /**
   * The headline, as an array of lines. It is an array rather than a string
   * because where the lines break is a composition decision on this site -
   * `text-wrap: balance` is right for a paragraph and wrong for a statement
   * whose second line is supposed to start on a particular word.
   */
  title: ReactNode[];
  lead?: ReactNode;
  question?: string;
  photo: Photo;
  /** The small crop that overlaps the main frame's corner. */
  inset?: Photo;
  figures?: HeroFigure[];
  actions?: HeroAction[];
  /** Text of the scroll cue at the foot. */
  cue?: string;
  className?: string;
}

export function EditorialHero({
  sticker,
  title,
  lead,
  question,
  photo,
  inset,
  figures = [],
  actions = [],
  cue = 'Scroll',
  className = '',
}: EditorialHeroProps) {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const head = el.querySelector<HTMLElement>('.hero__title');
    const frame = el.querySelector<HTMLElement>('.hero__frame');
    const image = el.querySelector<HTMLElement>('.hero__frame img');
    const insetEl = el.querySelector<HTMLElement>('.hero__inset');

    if (reduced()) {
      // Nothing is hidden in CSS, so there is genuinely nothing to do here.
      return;
    }

    const tl = gsap.timeline({ paused: !stageOpen(), defaults: { ease: 'power4.out' } });

    tl.from('.hero__tag', { y: 16, autoAlpha: 0, duration: 0.7 }, 0);

    if (head) {
      // The hero is the one place `lines()` is not driven by a ScrollTrigger:
      // it is already in view, so waiting for a scroll position means waiting
      // forever.
      const split = el.querySelectorAll<HTMLElement>('.hero__line > span');
      tl.from(split, { yPercent: 118, duration: 1.25, stagger: 0.085 }, 0.15);
    }

    if (frame) {
      tl.from(
        frame,
        { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.3, ease: 'power4.inOut' },
        0.35,
      );
      if (image) tl.from(image, { scale: 1.07, duration: 1.9 }, 0.35);
    }

    if (insetEl) tl.from(insetEl, { scale: 0.7, autoAlpha: 0, duration: 0.9, ease: 'back.out(1.5)' }, 0.95);

    tl.from('.hero__fig', { y: 22, autoAlpha: 0, duration: 0.8, stagger: 0.09 }, 0.85)
      .from('.hero__tail > *', { y: 20, autoAlpha: 0, duration: 0.8, stagger: 0.08 }, 0.85)
      .from('.hero__cue', { y: 14, autoAlpha: 0, duration: 0.8 }, 1.1);

    draw(el, { trigger: el, delay: 0.9, start: 'top bottom' });
    count(el.querySelectorAll<HTMLElement>('.hero__fig-value'), {
      trigger: el,
      start: 'top bottom',
      delay: 1,
    });

    if (image) drift(image, 80, { trigger: el });
    if (insetEl) drift(insetEl, -46, { trigger: el });

    const teardowns = Array.from(el.querySelectorAll<HTMLElement>('.btn')).map((b) => settle(b));
    const release = onStage(() => tl.play());

    return () => {
      // Unsubscribing first: a queued callback holding a killed timeline is a
      // leak with the stage watchdog's fuse on it.
      release();
      tl.kill();
      teardowns.forEach((fn) => fn?.());
    };
  }, []);

  return (
    <section ref={scope} className={`hero ${className}`.trim()}>
      <div className="hero__inner wrap">
        <div className="hero__type">
          {sticker ? (
            <div className="hero__tag">
              <Sticker tone="sun" tilt={-2.4}>
                {sticker}
              </Sticker>
            </div>
          ) : null}

          <h1 className="hero__title ed-hero">
            {title.map((line, i) => (
              // Each line is its own mask. Done in markup rather than with
              // SplitText because the breaks are authored, and a re-split on
              // resize would fight them.
              <span className="hero__line" key={i}>
                <span>{line}</span>
              </span>
            ))}
          </h1>

          <div className="hero__tail">
            {question ? <p className="hero__question meta">{question}</p> : null}
            {lead ? <p className="lead hero__lead">{lead}</p> : null}

            {actions.length ? (
              <div className="hero__actions">
                {actions.map((action) => {
                  const cls = `btn btn-${action.variant ?? 'primary'}`;
                  const inner = (
                    <span className="btn__label">
                      {action.label}
                      <Icon name="arrowRight" size={17} />
                    </span>
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
            ) : null}
          </div>
        </div>

        <div className="hero__media">
          <div className="hero__frame">
            <Figure
              photo={photo}
              width={1100}
              widths={[640, 1100, 1600]}
              sizes="(max-width: 900px) 92vw, 46vw"
              shape="frame"
              ratio="free"
              eager
              className="hero__fig-main"
            />
          </div>

          {inset ? (
            <div className="hero__inset">
              <Figure
                photo={inset}
                width={340}
                widths={[340, 620]}
                sizes="(max-width: 900px) 34vw, 15vw"
                shape="round"
                ratio="square-ar"
                decorative
              />
            </div>
          ) : null}

          {figures.length ? (
            <ul className="hero__figs">
              {figures.map((figure) => (
                <li className="hero__fig" key={figure.label}>
                  <span className="stat-num hero__fig-value">{figure.value}</span>
                  <span className="hero__fig-label">{figure.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <p className="hero__cue meta" aria-hidden="true">
        <span>{cue}</span>
        <i />
      </p>
    </section>
  );
}
