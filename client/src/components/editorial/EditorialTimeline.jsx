import { useRef, useState } from 'react';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { Figure } from './Figure';

export function EditorialTimeline({
  entries,
  children,
  className = '',
  id,
}) {
  const trackRef = useRef(null);
  const [progress, setProgress] = useState(0);

  const scope = useGsapScope((_, el) => {
    const track = trackRef.current;
    const viewport = el.querySelector('.etl__viewport');
    if (!track || !viewport) return;

    if (reduced() || window.matchMedia('(max-width: 900px)').matches) {
      // The narrow layout is a snap-scrolling strip, built entirely in CSS.
      // Report full progress so the axis rule is drawn rather than left empty.
      setProgress(1);
      return;
    }

    const span = () => Math.max(0, track.scrollWidth - viewport.clientWidth);

    const st = ScrollTrigger.create({
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
        setProgress(self.progress);
      },
    });

    return () => st.kill();
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
            <span className="etl__axis-fill" style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>

        <p className="etl__cue meta" aria-hidden="true">
          Scroll to travel forward
        </p>
      </div>
    </section>
  );
}
