import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { grow, reduced, rise } from '@/lib/motion';
import { Figure } from './Figure';

/**
 * The curve. A gentle S that rises and falls twice across five stops, so no
 * two adjacent portraits sit at the same height - which is the entire reason
 * for drawing a path rather than a rule.
 */
const CURVE =
  'M 40 210 C 220 90, 340 90, 500 180 S 780 320, 940 200 S 1220 80, 1360 170';

export function JourneyPath({ stops, children, className = '', id }) {
  const scope = useGsapScope((_, el) => {
    const path = el.querySelector('.jpath__line');
    if (path) grow(path, { trigger: el, svg: true, end: 'bottom 70%' });

    const items = gsap.utils.toArray('.jpath__stop', el);
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
    const nib = el.querySelector('.jpath__nib');
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
            <li className="jpath__stop" key={stop.id} style={{ '--i': i }}>
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
