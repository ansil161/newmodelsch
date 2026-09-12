import type { ReactNode } from 'react';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { count, draw, drift, reduced } from '@/lib/motion';
import { onStage, stageOpen } from '@/lib/stage';
import { Figure } from './Figure';
import { Sticker } from './primitives';
import type { StatItem } from './StatReveal';

/* ==========================================================================
   PAGE COVER - the opening of an interior page
   --------------------------------------------------------------------------
   One photograph, edge to edge, with the chapter named across the foot of it
   and a rule of facts underneath.

   IT IS A COVER, NOT A HERO. THE DIFFERENCE IS THAT IT DOES NOT ARGUE.

   The homepage hero splits the screen so the type can be as loud as the
   picture, because the homepage has to make a case to somebody who arrived by
   accident. An interior page does not: a reader on /academics has already
   decided to read about academics, and the opening screen's whole job is to
   name what they are about to read and set the temperature. So the type is
   one line, the argument goes underneath in a single paragraph, and the
   photograph gets the screen.

   THE FACTS RULE IS THE PART THAT EARNS ITS PLACE.

   Four figures on a hairline beneath the fold line - acres, classrooms,
   volumes, laboratories. It gives a parent something concrete in the first
   screen without making them read for it, and it is the one piece of
   furniture every interior page shares, so the six pages read as one
   publication.
   ========================================================================== */

interface PageCoverProps {
  sticker: string;
  /** One line, occasionally two. Not a paragraph. */
  title: ReactNode;
  /** The question this page owns, set small in mono above the lead. */
  question?: string;
  lead?: ReactNode;
  photo: Photo;
  facts?: readonly StatItem[];
  /** Set when the photograph is light enough that white type would fail. */
  tone?: 'light' | 'dark';
  className?: string;
}

export function PageCover({
  sticker,
  title,
  question,
  lead,
  photo,
  facts,
  tone = 'dark',
  className = '',
}: PageCoverProps) {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const image = el.querySelector<HTMLElement>('.cover__media img');
    if (image) drift(image, 90, { trigger: el });

    draw(el, { trigger: el, delay: 0.8, start: 'top bottom' });
    count(el.querySelectorAll<HTMLElement>('.cover__fact-value'), {
      trigger: el,
      start: 'top bottom',
      delay: 0.7,
    });

    if (reduced()) return;

    // Built paused while a page transition is covering the viewport, and
    // released as the sheet opens, so the cover arrives with the reveal
    // instead of behind it. See `lib/stage.ts`.
    const tl = gsap.timeline({ paused: !stageOpen(), defaults: { ease: 'power4.out' } });
    tl.from('.cover__media', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.4, ease: 'power4.inOut' }, 0)
      .from(image, { scale: 1.08, duration: 2 }, 0)
      .from('.cover__tag', { y: 18, autoAlpha: 0, duration: 0.7 }, 0.35)
      .from('.cover__title > span > span', { yPercent: 118, duration: 1.15, stagger: 0.08 }, 0.45)
      .from('.cover__body > *', { y: 20, autoAlpha: 0, duration: 0.8, stagger: 0.08 }, 0.8)
      .from('.cover__fact', { y: 18, autoAlpha: 0, duration: 0.8, stagger: 0.07 }, 0.95);

    const release = onStage(() => tl.play());
    return () => {
      release();
      tl.kill();
    };
  }, []);

  return (
    <section ref={scope} className={`cover cover--${tone} ${className}`.trim()}>
      {/* The plate is nested inside the frame rather than being a sibling of
          it. As a sibling its `bottom` resolved against the whole section -
          which includes the facts rule underneath - and the title landed
          below the photograph instead of on its foot. */}
      <div className="cover__top">
        <div className="cover__media">
          <Figure photo={photo} width={2000} sizes="100vw" shape="square" ratio="free" eager decorative />
          <span className="cover__scrim" aria-hidden="true" />
        </div>

        <div className="cover__plate">
          <div className="cover__tag">
            <Sticker tone="sun" tilt={-2.4}>
              {sticker}
            </Sticker>
          </div>

          <h1 className="cover__title ed-hero">
            <span>
              <span>{title}</span>
            </span>
          </h1>
        </div>
      </div>

      <div className="cover__under wrap">
        <div className="cover__body">
          {question ? <p className="cover__question meta">{question}</p> : null}
          {lead ? <p className="lead cover__lead">{lead}</p> : null}
        </div>

        {facts?.length ? (
          <dl className="cover__facts">
            {facts.map((fact) => (
              <div className="cover__fact" key={fact.label}>
                <dt className="sr-only">{fact.label}</dt>
                <dd>
                  <span className="stat-num cover__fact-value">{fact.value}</span>
                  <span className="cover__fact-label" aria-hidden="true">
                    {fact.label}
                  </span>
                  {fact.detail ? <span className="cover__fact-detail">{fact.detail}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
