import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { GalleryPhoto } from '@/constants/gallery';
import { resolve, resolveSet } from '@/constants/imagery';
import { gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import { Icon } from '@/components/common/Icon';

/* ==========================================================================
   PHOTO LIGHTBOX
   --------------------------------------------------------------------------
   The one place a photograph is shown uncropped. Every tile on the gallery
   pages crops to its slot; the viewer lays the original file into the screen
   with `object-fit: contain`, so a portrait stays a portrait.

   A provider owns it, so a section never renders its own copy: it calls
   `useLightbox()` with the set it belongs to and the index that was clicked,
   and the counter, the arrows and the swipe all run over that set.

   WHAT IT HAS TO GET RIGHT
     - Focus moves in on open, is trapped while open, and returns to the tile
       that opened it on close.
     - Escape closes; the arrow keys, Home and End move; a horizontal swipe
       moves on a touchscreen.
     - The page underneath does not scroll - Lenis is stopped as well as the
       document locked, because Lenis would otherwise keep consuming wheel
       events behind the overlay.
     - The neighbours are preloaded, so the next photograph is already there.
   ========================================================================== */

type OpenLightbox = (photos: GalleryPhoto[], index: number, title?: string) => void;

const LightboxContext = createContext<OpenLightbox>(() => {});

export const useLightbox = () => useContext(LightboxContext);

interface LightboxState {
  photos: GalleryPhoto[];
  index: number;
  title?: string;
  opener: HTMLElement | null;
}

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LightboxState | null>(null);

  const open = useCallback<OpenLightbox>((photos, index, title) => {
    if (!photos.length) return;
    setState({
      photos,
      index: Math.max(0, Math.min(index, photos.length - 1)),
      title,
      opener: document.activeElement as HTMLElement | null,
    });
  }, []);

  return (
    <LightboxContext.Provider value={open}>
      {children}
      {state ? <PhotoLightbox {...state} onClose={() => setState(null)} /> : null}
    </LightboxContext.Provider>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

function PhotoLightbox({
  photos,
  index: startIndex,
  title,
  opener,
  onClose,
}: LightboxState & { onClose: () => void }) {
  const [index, setIndex] = useState(startIndex);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const direction = useRef(0);
  const closing = useRef(false);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const { stop, start } = useSmoothScroll();

  const count = photos.length;
  const photo = photos[index];

  const go = useCallback(
    (next: number) => {
      if (count < 2) return;
      const wrapped = (next + count) % count;
      direction.current = next > index ? 1 : -1;
      setLoaded(false);
      setIndex(wrapped);
    },
    [count, index],
  );

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const root = rootRef.current;
    if (!root || reduced()) {
      onClose();
      return;
    }
    gsap
      .timeline({ onComplete: onClose })
      .to(root.querySelector('.gal-lb__frame'), { y: 24, scale: 0.97, autoAlpha: 0, duration: 0.32, ease: 'power2.in' }, 0)
      .to(root.querySelectorAll('.gal-lb__bar, .gal-lb__nav, .gal-lb__thumbs'), { autoAlpha: 0, duration: 0.2 }, 0)
      .to(root, { autoAlpha: 0, duration: 0.36, ease: 'power2.inOut' }, 0.08);
  }, [onClose]);

  /* Open: lock the page, move focus in, play the entrance. Close: undo all
     of it and hand focus back to the tile that opened the viewer. */
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('is-locked');
    stop();
    rootRef.current?.focus();

    const root = rootRef.current;
    if (root && !reduced()) {
      gsap
        .timeline()
        .from(root, { autoAlpha: 0, duration: 0.4, ease: 'power2.out' }, 0)
        .from(root.querySelector('.gal-lb__frame'), { y: 36, scale: 0.95, autoAlpha: 0, duration: 0.7, ease: 'power3.out' }, 0.08)
        .from(root.querySelectorAll('.gal-lb__bar > *, .gal-lb__nav, .gal-lb__thumbs'), { y: 10, autoAlpha: 0, duration: 0.5, stagger: 0.05 }, 0.2);
    }

    return () => {
      html.classList.remove('is-locked');
      start();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [opener, start, stop]);

  /* Keyboard. Tab is trapped by cycling between the first and last control. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        go(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        go(count - 1);
      } else if (e.key === 'Tab' && rootRef.current) {
        const focusable = rootRef.current.querySelectorAll<HTMLElement>('button:not([disabled])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === rootRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, count, go, index]);

  /* Each change of photograph: slide the new one in from the side it came
     from, preload both neighbours, and keep the active thumbnail in view. */
  useEffect(() => {
    const img = imageRef.current;
    if (img && direction.current && !reduced()) {
      gsap.fromTo(
        img,
        { x: direction.current * 60, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.55, ease: 'power3.out' },
      );
    }

    [index - 1, index + 1].forEach((i) => {
      const neighbour = photos[(i + count) % count];
      if (neighbour) new Image().src = resolve(neighbour, 1600);
    });

    const strip = thumbsRef.current;
    const active = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    if (strip && active) {
      strip.scrollTo({
        left: active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2,
        behavior: reduced() ? 'auto' : 'smooth',
      });
    }
  }, [count, index, photos]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId || !imageRef.current) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > Math.abs(e.clientY - s.y)) {
      gsap.set(imageRef.current, { x: dx * 0.6 });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      go(index + (dx < 0 ? 1 : -1));
    } else if (imageRef.current) {
      gsap.to(imageRef.current, { x: 0, duration: 0.35, ease: 'power3.out' });
    }
  };

  if (!photo) return null;

  return createPortal(
    <div
      ref={rootRef}
      className="gal-lb"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Photo viewer: ${title}` : 'Photo viewer'}
      tabIndex={-1}
      data-lenis-prevent
    >
      <div className="gal-lb__bar">
        <p className="gal-lb__count" aria-live="polite">
          <span className="sr-only">Photograph </span>
          <b>{pad(index + 1)}</b>
          <span aria-hidden="true"> / </span>
          <span className="sr-only"> of </span>
          {pad(count)}
        </p>
        {title ? <p className="gal-lb__title">{title}</p> : <span />}
        <button type="button" className="gal-lb__btn gal-lb__close" onClick={close}>
          <Icon name="close" size={20} />
          <span className="sr-only">Close photo viewer</span>
        </button>
      </div>

      <div
        className="gal-lb__stage"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <figure className="gal-lb__frame">
          <img
            ref={imageRef}
            key={photo.id}
            className={`gal-lb__img${loaded ? ' is-loaded' : ''}`}
            src={resolve(photo, 1600)}
            srcSet={resolveSet(photo, [800, 1200, 1600, 2200]) || undefined}
            sizes="(max-width: 900px) 100vw, 86vw"
            alt={photo.alt}
            onLoad={() => setLoaded(true)}
            draggable={false}
            style={photo.ratio ? { aspectRatio: photo.ratio } : undefined}
          />
          <figcaption className="gal-lb__caption">
            {photo.caption ? <b>{photo.caption}</b> : null}
            <span>{photo.alt}</span>
          </figcaption>
        </figure>
      </div>

      {count > 1 ? (
        <>
          <button type="button" className="gal-lb__btn gal-lb__nav gal-lb__nav--prev" onClick={() => go(index - 1)}>
            <Icon name="arrowLeft" size={20} />
            <span className="sr-only">Previous photograph</span>
          </button>
          <button type="button" className="gal-lb__btn gal-lb__nav gal-lb__nav--next" onClick={() => go(index + 1)}>
            <Icon name="arrowRight" size={20} />
            <span className="sr-only">Next photograph</span>
          </button>

          <div className="gal-lb__thumbs" ref={thumbsRef}>
            {photos.map((p, i) => (
              <button
                type="button"
                key={`${p.id}-${i}`}
                className="gal-lb__thumb"
                aria-current={i === index}
                onClick={() => go(i)}
                tabIndex={-1}
              >
                <img src={resolve(p, 120)} alt="" loading="lazy" draggable={false} />
                <span className="sr-only">Show photograph {i + 1}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>,
    document.body,
  );
}
