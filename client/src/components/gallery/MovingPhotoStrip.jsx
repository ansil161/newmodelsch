import { useRef } from 'react';
import { MOMENT_PHOTOS } from '@/constants/gallery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { Draggable, ScrollTrigger, gsap } from '@/lib/gsap';
import { reduced, rise } from '@/lib/motion';
import { Mark, SectionHead } from '@/components/editorial';
import { useLightbox } from './PhotoLightbox';
import { PhotoTile } from './PhotoTile';

/* ==========================================================================
   SMALL MOMENTS. BIG MEMORIES. - the moving strip
   --------------------------------------------------------------------------
   A row of captioned photographs that travels slowly and never ends. Frames
   keep their own proportions and step between three heights, so it reads as
   a line of prints pinned along a wall rather than a logo carousel.

   HOW IT MOVES
     - The set is rendered twice and the track wraps at the halfway point, so
       the loop has no seam and no jump.
     - It only advances while the section is on screen.
     - A fast scroll past it lends it a little speed, which decays.
     - It eases to a stop under the pointer and while anything inside it has
       keyboard focus, and a focused photograph is brought into view.
     - It can be dragged with a mouse or swiped with a thumb. A drag never
       counts as a click, so letting go does not open the viewer.

   With reduced motion none of this is built: the strip is a plain
   horizontally scrollable row.
   ========================================================================== */

const pad = (n) => String(n).padStart(2, '0');

export function MovingPhotoStrip() {
  const open = useLightbox();
  const dragged = useRef(false);

  const scope = useGsapScope((_, el) => {
    const viewport = el.querySelector('.gal-strip__viewport');
    const track = el.querySelector('.gal-strip__track');
    if (!viewport || !track) return;

    rise(el.querySelectorAll('.gal-strip__item'), {
      trigger: viewport,
      y: 48,
      stagger: 0.04,
    });

    if (reduced()) return;
    el.classList.add('is-moving');

    const BASE = 0.6; // px per 60fps frame
    const pace = { v: 1 };
    let x = 0;
    let boost = 0;
    let dragging = false;
    let inView = false;

    const place = () => {
      const half = track.scrollWidth / 2;
      if (half > 0) x = gsap.utils.wrap(-half, 0, x);
      gsap.set(track, { x });
    };

    const tick = (_time, delta) => {
      if (dragging || !inView) return;
      boost *= 0.94;
      x -= (BASE * pace.v + boost) * (delta / 16.67);
      place();
    };
    gsap.ticker.add(tick);

    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => {
        inView = self.isActive;
      },
      onUpdate: (self) => {
        boost = Math.max(boost, Math.min(4, Math.abs(self.getVelocity()) / 500));
      },
    });

    const slow = () => gsap.to(pace, { v: 0, duration: 0.7, ease: 'power2.out', overwrite: true });
    const resume = () => gsap.to(pace, { v: 1, duration: 1.1, ease: 'power2.inOut', overwrite: true });

    const onEnter = (e) => e.pointerType === 'mouse' && slow();
    const onLeave = (e) => e.pointerType === 'mouse' && resume();
    const onFocusIn = (e) => {
      slow();
      const item = e.target.closest('.gal-strip__item');
      if (item) {
        x = -(item.offsetLeft - viewport.clientWidth * 0.12);
        place();
      }
    };
    const onFocusOut = (e) => {
      if (!viewport.contains(e.relatedTarget)) resume();
    };

    viewport.addEventListener('pointerenter', onEnter);
    viewport.addEventListener('pointerleave', onLeave);
    viewport.addEventListener('focusin', onFocusIn);
    viewport.addEventListener('focusout', onFocusOut);

    let pressX = 0;
    let startX = 0;
    let clickTimer = 0;
    const proxy = document.createElement('div');
    const drag = Draggable.create(proxy, {
      trigger: viewport,
      type: 'x',
      minimumMovement: 6,
      dragClickables: true,
      allowContextMenu: true,
      onPress() {
        window.clearTimeout(clickTimer);
        dragged.current = false;
        pressX = this.pointerX;
        startX = x;
      },
      onDragStart() {
        dragged.current = true;
        dragging = true;
      },
      onDrag() {
        x = startX + (this.pointerX - pressX);
        place();
      },
      onRelease() {
        dragging = false;
        // Held just past the click that follows pointerup, so a drag that
        // ends over a photograph does not also open it.
        clickTimer = window.setTimeout(() => {
          dragged.current = false;
        }, 60);
      },
    })[0];

    return () => {
      gsap.ticker.remove(tick);
      st.kill();
      drag?.kill();
      window.clearTimeout(clickTimer);
      viewport.removeEventListener('pointerenter', onEnter);
      viewport.removeEventListener('pointerleave', onLeave);
      viewport.removeEventListener('focusin', onFocusIn);
      viewport.removeEventListener('focusout', onFocusOut);
      el.classList.remove('is-moving');
    };
  }, []);

  return (
    <section ref={scope} className="section gal-strip ground-cloth">
      <div className="wrap gal-strip__head">
        <SectionHead
          sticker="04 · Moments"
          stickerTone="ink"
          stickerTilt={-1.8}
          title={
            <>
              Small moments. <Mark>Big memories.</Mark>
            </>
          }
        />
        <p className="gal-strip__hint meta" aria-hidden="true">
          Drag or swipe<span className="gal-strip__hint-hover"> · hover to pause</span>
        </p>
      </div>

      <div
        className="gal-strip__viewport"
        role="region"
        aria-label="A moving strip of everyday school photographs"
      >
        <ul className="gal-strip__track">
          {[0, 1].map((copy) =>
            MOMENT_PHOTOS.map((photo, i) => (
              <li
                className={`gal-strip__item gal-strip__item--${i % 3}`}
                key={`${copy}-${photo.id}`}
                aria-hidden={copy === 1 || undefined}
              >
                <PhotoTile
                  photo={photo}
                  width={560}
                  sizes="(max-width: 900px) 64vw, 28vw"
                  shape="frame"
                  tabIndex={copy === 1 ? -1 : undefined}
                  onOpen={() => {
                    if (!dragged.current) open(MOMENT_PHOTOS, i, 'Small moments. Big memories.');
                  }}
                />
                <p className="gal-strip__cap">
                  <span className="meta">No. {pad(i + 1)}</span>
                  <span className="gal-strip__cap-text">{photo.caption}</span>
                </p>
              </li>
            )),
          )}
        </ul>
      </div>
    </section>
  );
}
