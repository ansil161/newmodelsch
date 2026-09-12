import type { ReactNode } from 'react';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { grow, reduced, rise } from '@/lib/motion';
import { Figure } from './Figure';

/* ==========================================================================
   JOURNEY PATH - thirteen years, drawn as one line
   --------------------------------------------------------------------------
   A hand-drawn line that runs the length of the section with the stages hung
   off it. The line is drawn by the reader's own scroll.

   WHY A LINE AND NOT FIVE CARDS

   The claim this section makes is that the stages are *continuous* - that a
   child does not restart at Class 6. Five cards in a row make exactly the
   opposite claim: five discrete things, equally weighted, in a container
   each. The line is the argument, and the stages are annotations on it.

   THE LINE IS DRAWN, NOT REVEALED.

   `grow(..., { svg: true })` animates the stroke's dash offset against scroll
   position, so the line extends from its start as the reader descends. The
   stages fade in as the line reaches them - which is why their triggers are
   offset down the section rather than all firing at its top.

   IT IS A REAL LIST UNDERNEATH.

   The SVG is decorative and hidden from assistive technology; the stages are
   an ordered list with real headings. A screen reader gets "1. Admissions,
   2. Foundation" rather than a description of a squiggle.

   THE NARROW LAYOUT DROPS THE CURVE.

   Below 900px the path becomes a straight vertical rule down the left margin
   with the stages stacked against it. Same idea, same continuity, no attempt
   to squeeze a 1400-unit viewBox into 360 pixels.
   ========================================================================== */

export interface JourneyStop {
  id: string;
  /** 'Step 01', 'Classes 1-5' - what stage of the thirteen years this is. */
  stage: string;
  label: ReactNode;
  detail: ReactNode;
  photo: Photo;
}

interface JourneyPathProps {
  stops: JourneyStop[];
  children?: ReactNode;
  className?: string;
  id?: string;
}

/**
 * The curve. A gentle S that rises and falls twice across five stops, so no
 * two adjacent portraits sit at the same height - which is the entire reason
 * for drawing a path rather than a rule.
 */
const CURVE =
  'M 40 210 C 220 90, 340 90, 500 180 S 780 320, 940 200 S 1220 80, 1360 170';

export function JourneyPath({ stops, children, className = '', id }: JourneyPathProps) {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const path = el.querySelector<SVGPathElement>('.jpath__line');
    if (path) grow(path, { trigger: el, svg: true, end: 'bottom 70%' });

    const items = gsap.utils.toArray<HTMLElement>('.jpath__stop', el);
    items.forEach((item, i) => {
      rise(item, {
        trigger: el,
        // Offset down the section so each stage lands roughly as the line
        // reaches it rather than all five arriving together.
        start: `top ${74 - i * 5}%`,
        y: 26,
      });
    });

    if (reduced() || !path) return;

    // The pen nib: a dot that rides the head of the line while it is drawn.
    const nib = el.querySelector<SVGCircleElement>('.jpath__nib');
    if (!nib) return;
    const length = path.getTotalLength();
    const move = { p: 0 };
    const tween = gsap.to(move, {
      p: 1,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 72%', end: 'bottom 70%', scrub: 0.7 },
      onUpdate: () => {
        const point = path.getPointAtLength(length * move.p);
        gsap.set(nib, { attr: { cx: point.x, cy: point.y }, autoAlpha: move.p > 0.01 ? 1 : 0 });
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [stops]);

  return (
    <section ref={scope} id={id} className={`jpath ${className}`.trim()}>
      {children ? <div className="jpath__head wrap">{children}</div> : null}

      <div className="jpath__stage wrap">
        <svg
          className="jpath__svg"
          viewBox="0 0 1400 400"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {/* The ghost of the whole path, so the reader can see where it goes
              before they have drawn it. */}
          <path className="jpath__ghost" d={CURVE} />
          <path className="jpath__line" d={CURVE} />
          <circle className="jpath__nib" r="7" cx="40" cy="210" />
        </svg>

        <ol className="jpath__stops">
          {stops.map((stop, i) => (
            <li className="jpath__stop" key={stop.id} style={{ '--i': i } as React.CSSProperties}>
              <Figure
                photo={stop.photo}
                width={260}
                widths={[260, 480]}
                sizes="(max-width: 900px) 30vw, 13vw"
                shape="round"
                ratio="square-ar"
                hover
                className="jpath__face"
              />
              <p className="jpath__stage-name meta">{stop.stage}</p>
              <h3 className="jpath__label fn-h4">{stop.label}</h3>
              <p className="jpath__detail">{stop.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
