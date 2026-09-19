import { useRef } from 'react';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { Figure } from './Figure';

export function EditorialTimeline({
  entries,
  children,
  className = '',
  id,
}) {
  const trackRef = useRef(null);
  const fillRef = useRef(null);

  const scope = useGsapScope((_, el) => {
    const track = trackRef.current;
    const fill = fillRef.current;
    const viewport = el.querySelector('.etl__viewport');
    const axis = el.querySelector('.etl__axis');
    if (!track || !fill || !viewport || !axis) return;

    const span = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
    // Written straight to the element: the fill moves on every scroll frame,
    // and a React state update per frame would re-render the whole strip.
    const setFill = (p) => gsap.set(fill, { scaleX: gsap.utils.clamp(0, 1, p) });

    // The same queries the stylesheet asks, in the same words, and re-asked
    // live: a tablet turned from portrait (a snap strip) to landscape (a
    // clipped stage) needs the pin built then, or the later milestones are
    // unreachable.
    const mm = gsap.matchMedia(el);

    /* WIDE: the reader scrolls, the years travel past a pinned stage and the
       axis fills behind them. */
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
      setFill(0);
      ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        // The travel is the real overflow plus a beat at each end, so the first
        // milestone is readable before the axis starts moving and the last one
        // does not fly off as the pin releases.
        end: () => `+=${span() + window.innerHeight * 0.5}`,
        pin: true,
        scrub: 0.9,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          gsap.set(track, { x: -span() * self.progress });
          setFill(self.progress);
        },
      });

      // The scrubbed offset is set from a callback, outside the context's
      // record, so it has to be cleared by hand or the narrow strip would
      // inherit it.
      return () => gsap.set(track, { clearProps: 'transform' });
    });

    /* NARROW (and any reader who asked for less motion): the same journey,
       framed for a thumb. A pin that hijacks a phone's vertical scroll to move
       sideways fights the hand, so the strip is native and swiped - but the
       story is kept: the axis is drawn under every tick and fills to wherever
       the reader has swiped to, and, motion allowing, the years arrive in
       order as the section comes up. */
    mm.add(
      {
        strip: '(max-width: 899px), (prefers-reduced-motion: reduce)',
        still: '(prefers-reduced-motion: reduce)',
      },
      (context) => {
        const { strip, still } = context.conditions;
        if (!strip) return undefined;
        const items = gsap.utils.toArray('.etl__entry', track);
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return undefined;

        // The axis spans the whole run of years, from the first tick to the
        // last, so it scrolls with them rather than ending at the screen edge.
        const run = () => last.offsetLeft + last.offsetWidth - first.offsetLeft;
        const measure = () => {
          gsap.set(axis, { right: 'auto', width: run() });
          onSwipe();
        };
        // "Reached" is the far edge of what is on screen, so on arrival the
        // axis is already drawn under the milestones the reader can see.
        const onSwipe = () => {
          const seen = viewport.scrollLeft + viewport.clientWidth - first.offsetLeft;
          setFill(seen / Math.max(1, run()));
        };

        const ro = new ResizeObserver(measure);
        ro.observe(track);
        viewport.addEventListener('scroll', onSwipe, { passive: true });
        measure();

        // The entrance: each year rises onto the axis in turn, and the axis
        // draws itself out to meet them.
        if (!still) {
          gsap
            .timeline({ scrollTrigger: { trigger: viewport, start: 'top 82%', once: true } })
            .from(fill, { scaleX: 0, duration: 1.1, ease: 'power2.out' }, 0)
            .from(
              items,
              { y: 28, autoAlpha: 0, duration: 0.8, stagger: 0.09, ease: 'power3.out' },
              0.1,
            );
        }

        return () => {
          ro.disconnect();
          viewport.removeEventListener('scroll', onSwipe);
          gsap.set(axis, { clearProps: 'right,width' });
        };
      },
    );

    return () => mm.revert();
  }, [entries]);

  return (
    <section ref={scope} id={id} className={`etl ${className}`.trim()}>
      <div className="etl__inner">
        {children ? <div className="etl__head">{children}</div> : null}

        <div className="etl__viewport">
          <ol className="etl__track" ref={trackRef}>
            {entries.map((entry) => (
              <li
                className={`etl__entry${entry.major ? ' etl__entry--major' : ''}`}
                key={entry.id}
              >
                {/* The tick on the axis. The axis itself is the rule below. */}
                <span className="etl__tick" aria-hidden="true" />

                <span className="etl__year">{entry.year}</span>

                {entry.photo ? (
                  <div className="etl__media">
                    <Figure
                      photo={entry.photo}
                      width={460}
                      sizes="(max-width: 899px) 78vw, 26vw"
                      shape="frame"
                      ratio="landscape"
                      note={entry.note}
                    />
                  </div>
                ) : null}

                <h3 className="etl__title fn-h4">{entry.title}</h3>
                {entry.body ? <p className="etl__body">{entry.body}</p> : null}
              </li>
            ))}
          </ol>

          {/* The axis. Drawn under the ticks, and filled to wherever the
              reader has got to. */}
          <div className="etl__axis" aria-hidden="true">
            <span className="etl__axis-fill" ref={fillRef} />
          </div>
        </div>

        <p className="etl__cue meta" aria-hidden="true">
          <span className="etl__cue-pin">Scroll to travel forward</span>
          <span className="etl__cue-strip">Swipe to travel forward</span>
        </p>
      </div>
    </section>
  );
}
