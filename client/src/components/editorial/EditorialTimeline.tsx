import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { Figure } from './Figure';

/* ==========================================================================
   EDITORIAL TIMELINE - history, travelling sideways
   --------------------------------------------------------------------------
   The school's story from 1962 to today, laid on a horizontal axis that the
   reader's vertical scroll drives.

   THIS ONE IS PINNED, AND IT IS ONE OF ONLY TWO THAT ARE.

   The pinned scroll-hijack is the strongest device on the site, so the rule
   is that the horizontal axis has to *mean* something before it is allowed.
   Here it means time. Scrolling forward moves forward through six decades,
   which is the one case where converting one axis into the other is not a
   trick - it is the correct diagram, and a vertical version of it would be a
   list of dates.

   WHAT THE PIN IS CAREFUL ABOUT

     invalidateOnRefresh   the travel distance is measured from the track's
                           real width, which changes when a font swaps or a
                           photograph loads. Without this the last milestone
                           ends up unreachable.
     anticipatePin         removes the one-frame jump as the pin engages.
     the end is derived    `+=` the actual overflow, not a magic number, so
                           adding a milestone does not need the scroll length
                           re-tuned by hand.

   BELOW 900px IT IS NOT PINNED AT ALL. It becomes a snap-scrolling strip a
   thumb can flick, because a scroll hijack on a phone fights the browser's
   own gesture handling and loses.

   THE YEAR IS THE GRAPHIC.

   Each milestone leads with its year set at display scale, and the years are
   the only thing on the axis that never varies in treatment - so a reader
   skimming sideways is reading a row of dates with material hung off them,
   which is what an archive looks like.
   ========================================================================== */

export interface TimelineEntry {
  id: string;
  year: string;
  title: ReactNode;
  body?: ReactNode;
  /** A short annotation pinned under the entry - a note in the margin. */
  note?: string;
  photo?: Photo;
  /** Marks the entry as one of the two or three the eye should stop on. */
  major?: boolean;
}

interface EditorialTimelineProps {
  entries: TimelineEntry[];
  /** Sits in the gutter above the axis, and stays put while the axis moves. */
  children?: ReactNode;
  className?: string;
  id?: string;
}

export function EditorialTimeline({
  entries,
  children,
  className = '',
  id,
}: EditorialTimelineProps) {
  const trackRef = useRef<HTMLOListElement>(null);
  const [progress, setProgress] = useState(0);

  const scope = useGsapScope<HTMLElement>((_, el) => {
    const track = trackRef.current;
    const viewport = el.querySelector<HTMLElement>('.etl__viewport');
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
