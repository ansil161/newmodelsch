import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { reduced, rise } from '@/lib/motion';
import { Figure } from './Figure';

/* ==========================================================================
   STICKY STORY - a chapter that holds while its evidence changes
   --------------------------------------------------------------------------
   One photograph stays on screen. The reader scrolls through a column of
   panels beside it, and the photograph changes as each panel takes over.

   IT IS STICKY, NOT PINNED. THAT IS DELIBERATE.

   The obvious build is ScrollTrigger `pin: true` on the whole section, and
   this component was that build first. Pinning is wrong here for three
   reasons that only show up in use:

     - A pin inserts a spacer and takes the section out of flow. Every image
       that lazy-loads below it then re-measures the pin, and on a page with
       ten thousand pixels of photography the spacer visibly jitters.
     - A pin captures the scroll. A parent who scrolls past a chapter they do
       not care about has to scroll through all six panels to leave it, and on
       a trackpad that is genuinely several seconds of being held.
     - A pin has to be disabled on mobile, which means the mobile layout is a
       second layout rather than the same one narrower.

   `position: sticky` gives the same reading experience, costs no spacer, and
   degrades to an ordinary stacked column the moment the viewport is too short
   to hold it. The only JavaScript here is what decides which frame is showing.

   THE FRAMES ARE ALL MOUNTED, STACKED, AND CROSS-FADED.

   Swapping one <img> src would flash on every change. All of them are in the
   DOM at once, absolutely positioned in the same box; the active one is
   opaque and very slightly larger. Only the first is eager - the rest lazy-
   load as the reader approaches them, which is why the stack is affordable.
   ========================================================================== */

export interface StoryPanel {
  id: string;
  /** The oversized numeral. '01', '02'. */
  index?: string;
  /** Small line above the title: a stage, an age band, a year. */
  kicker?: string;
  title: ReactNode;
  body: ReactNode;
  /** The one concrete fact that makes the panel checkable. */
  proof?: ReactNode;
  photo: Photo;
}

interface StickyStoryProps {
  panels: StoryPanel[];
  /** Which side the photograph sits on. Alternate it between sections. */
  media?: 'left' | 'right';
  /** The shape of the sticky frame. */
  shape?: 'arch' | 'blob' | 'frame';
  /** Whether to display the counter under the photo. */
  showCounter?: boolean;
  className?: string;
  id?: string;
}

export function StickyStory({
  panels,
  media = 'right',
  shape = 'frame',
  showCounter = true,
  className = '',
  id,
}: StickyStoryProps) {
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);

  const scope = useGsapScope<HTMLDivElement>((_, el) => {
    const items = gsap.utils.toArray<HTMLElement>('.sticky-story__panel', el);
    const frames = gsap.utils.toArray<HTMLElement>('.sticky-story__frame', el);

    items.forEach((panel, i) => {
      rise(panel.querySelectorAll<HTMLElement>('[data-lift]'), {
        trigger: panel,
        y: 24,
        stagger: 0.06,
      });

      // The midpoint of the viewport is the handover line. A panel owns the
      // photograph from the moment its top crosses it until the next panel's
      // top does - which is the same rule going up and coming down, so the
      // sequence cannot end up one out of step after a fast scroll reversal.
      ScrollTrigger.create({
        trigger: panel,
        start: 'top 55%',
        end: 'bottom 55%',
        onToggle: (self) => {
          if (!self.isActive) return;
          activeRef.current = i;
          setActive(i);
        },
      });
    });

    if (reduced() || !frames.length) return;

    // The frames are driven imperatively rather than by a React class swap:
    // a state change re-renders nine <img> elements to move one opacity, and
    // GSAP is already the thing holding the timeline.
    const paint = (index: number) => {
      frames.forEach((frame, i) => {
        gsap.to(frame, {
          autoAlpha: i === index ? 1 : 0,
          scale: i === index ? 1 : 1.045,
          duration: 0.75,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      });
    };

    gsap.set(frames, { autoAlpha: 0, scale: 1.045 });
    gsap.set(frames[0], { autoAlpha: 1, scale: 1 });

    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: () => paint(activeRef.current),
    });

    return () => st.kill();
  }, [panels]);

  return (
    <div
      ref={scope}
      id={id}
      className={`sticky-story sticky-story--${media} ${className}`.trim()}
    >
      <div className="sticky-story__media">
        <div className="sticky-story__stack">
          {panels.map((panel, i) => (
            <div
              key={panel.id}
              className="sticky-story__frame"
              // The stack is decorative to assistive tech: each panel already
              // describes its own evidence in words, and reading nine alt
              // texts in a row would be nine interruptions.
              aria-hidden="true"
            >
              <Figure
                photo={panel.photo}
                width={720}
                sizes="(max-width: 900px) 90vw, 42vw"
                shape={shape}
                ratio="portrait"
                eager={i === 0}
                decorative
              />
            </div>
          ))}
          {showCounter ? (
            <p className="sticky-story__counter meta" aria-hidden="true">
              <span>{String(active + 1).padStart(2, '0')}</span>
              <i />
              <span>{String(panels.length).padStart(2, '0')}</span>
            </p>
          ) : null}
        </div>
      </div>

      <ol className="sticky-story__panels">
        {panels.map((panel, i) => (
          <li
            className={`sticky-story__panel${i === active ? ' is-active' : ''}`}
            key={panel.id}
            id={panel.id}
          >
            {panel.index ? (
              <span className="sticky-story__index" aria-hidden="true">
                {panel.index}
              </span>
            ) : null}

            <div className="sticky-story__text">
              {panel.kicker ? (
                <p className="meta" data-lift>
                  {panel.kicker}
                </p>
              ) : null}
              <h3 className="ed-h2 sticky-story__title" data-lift>
                {panel.title}
              </h3>
              <p className="body-text" data-lift>
                {panel.body}
              </p>
              {panel.proof ? (
                <p className="sticky-story__proof" data-lift>
                  {panel.proof}
                </p>
              ) : null}

              {/* The narrow layout's own photograph. Rendered here rather than
                  duplicated from the stack above, and hidden on desktop by the
                  stylesheet - so the browser downloads exactly one of the two. */}
              <div className="sticky-story__inline" data-lift>
                <Figure
                  photo={panel.photo}
                  width={640}
                  sizes="90vw"
                  shape={shape === 'arch' ? 'arch' : 'frame'}
                  ratio="landscape"
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
