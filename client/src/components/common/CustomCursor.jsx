import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import './CustomCursor.css';

/* ==========================================================================
   CURSOR
   --------------------------------------------------------------------------
   A small ring that follows the pointer and grows into a labelled disc over
   things that do something.

   IT NEVER REPLACES THE SYSTEM CURSOR.

   The usual build hides the real pointer and draws a div in its place, and it
   is always worse: the div lags by a frame, it disappears over an iframe or a
   native control, it survives a route change and gets stranded, and a person
   who has set a large or high-contrast pointer in their OS loses it. This one
   sits *behind* the real cursor, which stays visible and stays exactly where
   the operating system put it. The ring is an annotation, not a replacement.

   IT ONLY EXISTS FOR A FINE POINTER.

   Guarded on `(hover: hover) and (pointer: fine)`, so it never mounts on a
   touch device, where it would follow the last tap around the screen like a
   ghost. It also does not mount under reduced motion.

   THE LABEL COMES FROM THE PAGE, NOT FROM A LIST HERE.

   Any element carrying `data-cursor="View"` sets the label while the pointer
   is over it. That keeps the vocabulary - View, Explore, Drag, Play - owned by
   the sections that mean it, and means adding a new one is an attribute
   rather than an edit to this file.
   ========================================================================== */

export function CustomCursor() {
  const ring = useRef(null);
  const label = useRef(null);

  useEffect(() => {
    if (reduced()) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const el = ring.current;
    const text = label.current;
    if (!el || !text) return;

    // quickTo rather than a tween per frame: one interpolator, reused, which
    // is the difference between this costing nothing and this costing a
    // measurable slice of the frame budget on a long page.
    const x = gsap.quickTo(el, 'x', { duration: 0.38, ease: 'power3.out' });
    const y = gsap.quickTo(el, 'y', { duration: 0.38, ease: 'power3.out' });

    let visible = false;

    const onMove = (e) => {
      if (!visible) {
        visible = true;
        gsap.to(el, { autoAlpha: 1, duration: 0.3 });
      }
      x(e.clientX);
      y(e.clientY);
    };

    const onLeave = () => {
      visible = false;
      gsap.to(el, { autoAlpha: 0, duration: 0.25 });
    };

    /* One delegated listener rather than a listener per interactive element.
       The page has several hundred of those and they come and go with every
       route change; delegation means nothing has to be re-bound. */
    const onOver = (e) => {
      const target = e.target?.closest(
        '[data-cursor], a, button, [role="button"]',
      );

      if (!target) {
        el.dataset.state = '';
        text.textContent = '';
        return;
      }

      const cue = target.dataset.cursor;
      if (cue) {
        el.dataset.state = 'label';
        text.textContent = cue;
      } else {
        el.dataset.state = 'active';
        text.textContent = '';
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div className="cursor" ref={ring} aria-hidden="true">
      <span className="cursor__label" ref={label} />
    </div>
  );
}
