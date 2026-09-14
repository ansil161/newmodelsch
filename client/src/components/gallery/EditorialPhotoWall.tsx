import { GLIMPSE_PHOTOS } from '@/constants/gallery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { drift, rise, unmask } from '@/lib/motion';
import { Mark, SectionHead } from '@/components/editorial';
import type { FigureRatio, FigureShape } from '@/components/editorial';
import { useLightbox } from './PhotoLightbox';
import { PhotoTile } from './PhotoTile';

/* ==========================================================================
   A GLIMPSE OF SCHOOL LIFE - the editorial wall
   --------------------------------------------------------------------------
   Six photographs set as a magazine spread, not a grid. Two columns of
   unequal width, each built from frames of different proportion, so no two
   edges line up by accident:

     LEFT (5/12)    the heading, a tall arched frame, and a stack of a square
                    and a landscape beside it
     RIGHT (7/12)   the lead photograph, then a wide frame and a portrait
                    dropped below the line

   Every frame keeps an aspect ratio, so the spread holds its shape before a
   single file has loaded. Each one prints in from a different edge as it
   reaches the viewport, and the whole wall opens as one set in the viewer.
   ========================================================================== */

interface Slot {
  key: string;
  shape: FigureShape;
  ratio: FigureRatio;
  width: number;
  sizes: string;
  from: 'bottom' | 'top' | 'left' | 'right';
}

const SLOTS: Slot[] = [
  { key: 'a', shape: 'blob-2', ratio: 'landscape', width: 1000, sizes: '(max-width: 900px) 92vw, 52vw', from: 'bottom' },
  { key: 'b', shape: 'arch', ratio: 'tall', width: 560, sizes: '(max-width: 900px) 52vw, 22vw', from: 'bottom' },
  { key: 'c', shape: 'frame', ratio: 'square-ar', width: 420, sizes: '(max-width: 900px) 38vw, 15vw', from: 'right' },
  { key: 'd', shape: 'frame', ratio: 'wide', width: 700, sizes: '(max-width: 900px) 92vw, 30vw', from: 'left' },
  { key: 'e', shape: 'frame', ratio: 'portrait', width: 480, sizes: '(max-width: 900px) 44vw, 20vw', from: 'top' },
  { key: 'f', shape: 'blob', ratio: 'landscape', width: 420, sizes: '(max-width: 900px) 44vw, 15vw', from: 'right' },
];

export function EditorialPhotoWall() {
  const open = useLightbox();

  const scope = useGsapScope<HTMLElement>((_, el) => {
    el.querySelectorAll<HTMLElement>('.gal-wall__slot').forEach((slot) => {
      unmask(slot, { from: (slot.dataset.from as Slot['from']) ?? 'bottom' });
    });
    rise(el.querySelectorAll<HTMLElement>('.gal-wall__note'), { y: 16 });
    drift(el.querySelector('.gal-wall__slot--a .gal-tile__fig img'), 60, { trigger: el });
  }, []);

  const tile = (i: number) => {
    const slot = SLOTS[i];
    const photo = GLIMPSE_PHOTOS[i];
    if (!photo) return null;
    return (
      <div className={`gal-wall__slot gal-wall__slot--${slot.key}`} data-from={slot.from}>
        <PhotoTile
          photo={photo}
          width={slot.width}
          sizes={slot.sizes}
          shape={slot.shape}
          ratio={slot.ratio}
          label={photo.label}
          onOpen={() => open(GLIMPSE_PHOTOS, i, 'A glimpse of school life')}
        />
      </div>
    );
  };

  return (
    <section ref={scope} id="glimpse" className="section gal-wall">
      <div className="wrap gal-wall__grid">
        <div className="gal-wall__col gal-wall__col--left">
          <SectionHead
            sticker="01 · Everyday"
            stickerTilt={2}
            size="h1"
            title={
              <>
                A glimpse of <Mark>school life</Mark>
              </>
            }
            lead="The moments between the milestones."
            className="gal-wall__head"
          />

          <p className="gal-wall__note" aria-hidden="true">
            nothing on this wall was posed
          </p>

          <div className="gal-wall__pair">
            {tile(1)}
            <div className="gal-wall__stack">
              {tile(2)}
              {tile(5)}
            </div>
          </div>
        </div>

        <div className="gal-wall__col gal-wall__col--right">
          {tile(0)}
          <div className="gal-wall__row">
            {tile(3)}
            {tile(4)}
          </div>
        </div>
      </div>
    </section>
  );
}
