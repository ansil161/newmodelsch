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

  const scope = useGsapScope((_, el) => {
    const track = trackRef.current;
    const viewport = el.querySelector('.etl__viewport');
    const axis = el.querySelector('.etl__axis');
    const fill = el.querySelector('.etl__axis-fill');
    if (!track || !viewport || !axis || !fill) return;

    const span = () => Math.max(0, track.scrollWidth - viewport.clientWidth);

    // The axis fill is written straight to the element rather than through
    // React state: it changes on every scroll frame, and a re-render of the
    // whole strip per frame is the one cost this section cannot afford.
    const setFill = gsap.quickSetter(fill, 'scaleX');
    setFill(0);

    // The same queries the stylesheet asks, in the same words, and re-asked
    // live: a tablet turned from portrait to landscape needs the pin built
    // then, or the later milestones are unreachable in a clipped viewport.
    const mm = gsap.matchMedia(el);

    // `wide` is never read, but it has to be here: matchMedia only runs the
    // callback while at least one condition matches, and a wide screen with
    // motion matches neither of the other two.
    mm.add(
      {
        narrow: '(max-width: 899px)',
        wide: '(min-width: 900px)',
        reduce: '(prefers-reduced-motion: reduce)',
      },
      ({ conditions }) => {
        const { narrow, reduce } = conditions;

        /* ---------------------------------------------------------- the pin
           A wide screen with motion: the section holds and the axis travels
           under a fixed reading line, scrubbed by the page's own scroll. */
        if (!narrow && !reduce) {
          ScrollTrigger.create({
            trigger: el,
            start: 'top top',
            // The travel is the real overflow plus a beat at each end, so the
            // first milestone is readable before the axis starts moving and the
            // last one does not fly off as the pin releases.
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
          // record, so it has to be cleared by hand or the strip inherits it.
          return () => {
            gsap.set(track, { clearProps: 'transform' });
            setFill(0);
          };
        }

        /* --------------------------------------------------------- the strip
           A phone, a portrait tablet, or anyone who has asked for less motion:
           the stylesheet makes this a native swipe strip. The concept is the
           same one - an axis filled to wherever the reader has got to - read
           from the strip's own scroll position instead of the page's.

           The axis sits inside the scroller, so left alone it would scroll
           away with the entries. Held against the scroll by a transform, it
           stays under the reader exactly as it does on the pinned layout,
           with the ticks travelling across it. */
        const sync = () => {
          const max = span();
          const left = viewport.scrollLeft;
          gsap.set(axis, { x: left });
          setFill(max ? left / max : 1);
        };
        sync();
        viewport.addEventListener('scroll', sync, { passive: true });
        window.addEventListener('resize', sync);

        // A lazy photograph inside a horizontal scroller only starts loading
        // once it is swiped into view, so every swipe would land on a blank
        // frame. As the section approaches, the rest of the strip is asked
        // for, so the photographs are there before the thumb is.
        ScrollTrigger.create({
          trigger: el,
          start: 'top bottom+=50%',
          once: true,
          onEnter: () => {
            track.querySelectorAll('img[loading="lazy"]').forEach((img) => {
              img.loading = 'eager';
            });
          },
        });

        // The entrance: a scaled-down version of the travel itself. The first
        // milestones slide in along the axis as the section arrives, so the
        // strip announces that it moves before a thumb has touched it.
        //
        // The entries' contents move, never the entries: they are the snap
        // points, and a transformed snap point drags the strip's resting
        // position along with it.
        if (!reduce) {
          const entries = gsap.utils.toArray('.etl__entry', track);
          const parts = entries.flatMap((entry, i) =>
            [...entry.children].map((child, j) => ({ child, delay: i * 0.09 + j * 0.05 })),
          );
          gsap.from(
            parts.map((p) => p.child),
            {
              x: 44,
              autoAlpha: 0,
              duration: 0.9,
              ease: 'power3.out',
              stagger: (i) => parts[i].delay,
              clearProps: 'transform,opacity,visibility',
              scrollTrigger: { trigger: viewport, start: 'top 85%', once: true },
            },
          );
        }

        return () => {
          viewport.removeEventListener('scroll', sync);
          window.removeEventListener('resize', sync);
          gsap.set(axis, { clearProps: 'transform' });
          setFill(0);
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
                      sizes="(max-width: 900px) 78vw, 26vw"
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
            <span className="etl__axis-fill" />
          </div>
        </div>

        {/* The gesture the layout actually answers to: the page's scroll
            while pinned, a swipe on the strip otherwise. */}
        <p className="etl__cue meta" aria-hidden="true">
          <span className="etl__cue-pin">Scroll to travel forward</span>
          <span className="etl__cue-strip">Swipe to travel forward</span>
        </p>
      </div>
    </section>
  );
}
