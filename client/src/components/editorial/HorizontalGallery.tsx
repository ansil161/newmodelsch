import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { Draggable, ScrollTrigger, gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { Figure } from './Figure';

/* ==========================================================================
   HORIZONTAL GALLERY - the photo wall
   --------------------------------------------------------------------------
   A strip of photographs of deliberately unequal size that travels sideways.
   It is the site's answer to a gallery grid, and it exists because a masonry
   grid of captioned photographs is a room where images go to be looked at
   instead of understood.

   TWO BEHAVIOURS, CHOSEN BY VIEWPORT RATHER THAN BY PROP

     WIDE      the strip is dragged. Not pinned - see below.
     NARROW    native overflow scrolling with snap points, which is what a
               thumb already knows how to do.

   WHY IT DRAGS RATHER THAN PINNING THE PAGE

   The pinned version - convert vertical scroll into horizontal travel - is
   the more impressive device, and this component was that first. It is used
   exactly twice on this site now, on the heritage timeline and the campus
   explorer, where the horizontal axis carries meaning (time, and a walk
   through a building). Here it does not: this is a wall of photographs in no
   particular order, and capturing a parent's scroll for four screens to show
   them ten pictures they did not ask to see is a toll booth.

   So it drags, it scrolls with a shift-wheel, it has arrow keys, and it moves
   a little on its own as the page scrolls past - enough to advertise that it
   moves, not enough to take anything over.

   THE ARROW KEYS ARE NOT DECORATION.

   A drag-only strip is unreachable by keyboard, which would put a tenth of
   the site's photography behind a mouse. The track is focusable, the arrow
   keys page it, and the focus ring is real.
   ========================================================================== */

export interface GalleryFrame {
  photo: Photo;
  /** Frames are deliberately unequal - that is what makes it read as a wall. */
  size?: 'sm' | 'md' | 'lg' | 'tall';
  shape?: 'frame' | 'arch' | 'blob' | 'round' | 'square';
  caption?: string;
  meta?: string;
}

interface HorizontalGalleryProps {
  frames: GalleryFrame[];
  /** Sits above the strip, inside the gutter. */
  children?: ReactNode;
  /** The contextual cursor label. */
  cue?: string;
  className?: string;
  id?: string;
}

const WIDTHS: Record<string, number> = { sm: 300, md: 420, lg: 560, tall: 380 };

export function HorizontalGallery({
  frames,
  children,
  cue = 'Drag',
  className = '',
  id,
}: HorizontalGalleryProps) {
  const trackRef = useRef<HTMLUListElement>(null);

  const scope = useGsapScope<HTMLDivElement>((_, el) => {
    const track = trackRef.current;
    const viewport = el.querySelector<HTMLElement>('.hgal__viewport');
    if (!track || !viewport) return;

    const span = () => Math.max(0, track.scrollWidth - viewport.clientWidth);

    if (reduced() || window.matchMedia('(max-width: 900px)').matches) {
      // The stylesheet already makes this an overflow-scroll strip with snap
      // points. Building a disabled Draggable here would only add a resize
      // listener that does nothing.
      return;
    }

    const setX = gsap.quickTo(track, 'x', { duration: 0.6, ease: 'power3.out' });
    let x = 0;

    const to = (next: number) => {
      x = gsap.utils.clamp(-span(), 0, next);
      setX(x);
    };

    const drag = Draggable.create(track, {
      type: 'x',
      // Recomputed on every drag start rather than captured once, because
      // the span changes as photographs load in.
      bounds: { minX: -span(), maxX: 0 },
      onPressInit() {
        this.applyBounds({ minX: -span(), maxX: 0 });
      },
      inertia: false,
      dragResistance: 0.06,
      cursor: 'none',
      onDrag() {
        x = this.x;
      },
      onThrowUpdate() {
        x = this.x;
      },
    })[0];

    // A shift-wheel over the strip pages it, which is the gesture a trackpad
    // user will try first.
    const onWheel = (e: WheelEvent) => {
      const lateral = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!lateral && !e.shiftKey) return;
      e.preventDefault();
      to(x - (lateral ? e.deltaX : e.deltaY));
      gsap.set(track, { x });
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });

    const onKey = (e: KeyboardEvent) => {
      const step = viewport.clientWidth * 0.7;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        to(x - step);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        to(x + step);
      } else if (e.key === 'Home') {
        e.preventDefault();
        to(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        to(-span());
      }
    };
    viewport.addEventListener('keydown', onKey);

    // The idle drift. The strip eases a fraction of its own span as the
    // section crosses the viewport, so a reader who never touches it still
    // sees that it is a thing that moves.
    const idle = gsap.fromTo(
      track,
      { x: 0 },
      {
        x: () => -Math.min(span(), viewport.clientWidth * 0.28),
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.2,
          // The drift stops owning the position the instant a person does.
          onUpdate: (self) => {
            if (drag?.isDragging) self.disable(false);
          },
        },
      },
    );

    return () => {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('keydown', onKey);
      drag?.kill();
      idle.scrollTrigger?.kill();
      idle.kill();
      ScrollTrigger.refresh();
    };
  }, [frames]);

  return (
    <section ref={scope} id={id} className={`hgal ${className}`.trim()}>
      {children ? <div className="hgal__head wrap">{children}</div> : null}

      <div
        className="hgal__viewport"
        tabIndex={0}
        role="region"
        aria-label="Photographs from around the school. Use the left and right arrow keys to move through them."
        data-cue={cue}
      >
        <ul className="hgal__track" ref={trackRef}>
          {frames.map((frame, i) => (
            <li
              className={`hgal__item hgal__item--${frame.size ?? 'md'}`}
              key={`${frame.photo.id}-${i}`}
            >
              <Figure
                photo={frame.photo}
                width={WIDTHS[frame.size ?? 'md']}
                sizes="(max-width: 900px) 72vw, 30vw"
                shape={frame.shape ?? 'frame'}
                ratio={frame.size === 'tall' ? 'tall' : frame.size === 'lg' ? 'wide' : 'landscape'}
              />
              {frame.caption ? (
                <div className="hgal__cap">
                  <span className="hgal__cap-title">{frame.caption}</span>
                  {frame.meta ? <span className="meta">{frame.meta}</span> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
