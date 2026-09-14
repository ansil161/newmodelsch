import { useMemo } from 'react';
import type { GalleryPhoto } from '@/constants/gallery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { useLightbox } from './PhotoLightbox';
import { PhotoTile } from './PhotoTile';

/* ==========================================================================
   PHOTO MASONRY - the exhibition wall of one event
   --------------------------------------------------------------------------
   Every photograph at its real proportions; nothing is cropped to fit.

   COLUMNS ARE PACKED IN SCRIPT, NOT BY `column-count`.
   CSS columns fill top-to-bottom, one column at a time, so photograph 2
   lands under photograph 1 and the visual order stops matching the order the
   viewer counts through. Here each photograph goes into whichever column is
   currently shortest - measured from the ratios in the data, before a single
   file loads - which keeps the order reading across the page.

   Photographs print in as they reach the viewport, in small batches, so a
   long event does not build a trigger per image.
   ========================================================================== */

const pad = (n: number) => String(n).padStart(2, '0');

export function PhotoMasonry({ photos, title }: { photos: GalleryPhoto[]; title: string }) {
  const open = useLightbox();
  const wide = useMediaQuery('(min-width: 1100px)');
  const mid = useMediaQuery('(min-width: 560px)');
  const count = wide ? 3 : mid ? 2 : 1;

  const columns = useMemo(() => {
    const heights = new Array<number>(count).fill(0);
    const out = Array.from({ length: count }, () => [] as { photo: GalleryPhoto; index: number }[]);
    photos.forEach((photo, index) => {
      const shortest = heights.indexOf(Math.min(...heights));
      out[shortest].push({ photo, index });
      heights[shortest] += 1 / (photo.ratio ?? 4 / 3) + 0.12;
    });
    return out;
  }, [photos, count]);

  const scope = useGsapScope<HTMLDivElement>((_, el) => {
    if (reduced()) return;
    const items = gsap.utils.toArray<HTMLElement>(el.querySelectorAll('.gal-mason__item'));
    gsap.set(items, { clipPath: 'inset(100% 0% 0% 0%)', y: 40 });

    const triggers = ScrollTrigger.batch(items, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => {
        gsap.to(batch, {
          clipPath: 'inset(0% 0% 0% 0%)',
          y: 0,
          duration: 1.1,
          ease: 'power4.out',
          stagger: 0.09,
          onComplete: () => gsap.set(batch, { clearProps: 'clipPath' }),
        });
      },
    });

    return () => triggers.forEach((t) => t.kill());
  }, [count, photos]);

  return (
    <div ref={scope} className={`gal-mason gal-mason--${count}`}>
      {columns.map((column, c) => (
        <div className="gal-mason__col" key={c}>
          {column.map(({ photo, index }) => (
            <figure className="gal-mason__item" key={`${photo.id}-${index}`}>
              <PhotoTile
                photo={photo}
                width={count === 1 ? 900 : 700}
                sizes={count === 3 ? '(max-width: 1480px) 30vw, 440px' : count === 2 ? '46vw' : '92vw'}
                shape="frame"
                onOpen={() => open(photos, index, title)}
              />
              <figcaption className="gal-mason__cap">
                <span className="meta">{pad(index + 1)}</span>
                <span>{photo.caption ?? photo.alt}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      ))}
    </div>
  );
}
