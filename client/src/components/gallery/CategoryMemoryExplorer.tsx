import { useRef, useState } from 'react';
import { GALLERY_CATEGORIES, plural } from '@/constants/gallery';
import type { GalleryCategory } from '@/constants/gallery';
import { resolve } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { gsap } from '@/lib/gsap';
import { reduced, rise, unmask } from '@/lib/motion';
import { Mark, SectionHead } from '@/components/editorial';
import { useLightbox } from './PhotoLightbox';
import { PhotoTile } from './PhotoTile';

/* ==========================================================================
   THROUGH DIFFERENT EYES - the category explorer
   --------------------------------------------------------------------------
   Seven ways of looking at the same school. Choosing one does not filter a
   grid; it re-curates a spread.

   THE TRANSITION IS TWO HALVES, AND REACT SITS BETWEEN THEM.

     OUT   the current prints are clipped away, each toward a different edge,
           while the pictures inside them lean in slightly - a table being
           cleared. The text lifts out with them.
     SWAP  only once the table is clear does the new category render. The
           composition also changes shape: the large frame moves between the
           left, the right and the centre, so the layout itself is part of
           what changed rather than only the pictures.
     IN    the new prints are laid down edge by edge and settle from a slight
           zoom, and the new title and lead rise into place.

   A second choice made mid-transition is not queued behind the first: the
   running timeline is killed and the swap goes straight to the latest
   choice. Hovering or focusing a category starts loading its photographs, so
   by the time it is chosen they are usually already in the cache.
   ========================================================================== */

const pad = (n: number) => String(n).padStart(2, '0');
const CELLS = 'abcde';

/* The edge each cell leaves by and arrives from. Opposite on the way in, so
   the new print covers the space the old one uncovered. */
const OUT = ['inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 100%)', 'inset(100% 0% 0% 0%)', 'inset(0% 100% 0% 0%)'];
const IN = ['inset(100% 0% 0% 0%)', 'inset(0% 100% 0% 0%)', 'inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 100%)'];

const preloaded = new Set<string>();
function preload(category: GalleryCategory) {
  if (preloaded.has(category.id)) return;
  preloaded.add(category.id);
  category.photos.slice(0, CELLS.length).forEach((p, i) => {
    new Image().src = resolve(p, i === 0 ? 900 : 560);
  });
}

export function CategoryMemoryExplorer() {
  const open = useLightbox();
  const [selected, setSelected] = useState(0);
  const [shown, setShown] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const running = useRef<gsap.core.Timeline | null>(null);
  const target = useRef(0);
  const shownRef = useRef(0);
  const mounted = useRef(false);

  const category = GALLERY_CATEGORIES[shown];

  const scope = useGsapScope<HTMLElement>((_, el) => {
    const grid = gridRef.current;
    rise(el.querySelectorAll<HTMLElement>('.gal-cat__ctl'), {
      trigger: el.querySelector('.gal-cat__controls'),
      y: 14,
      stagger: 0.045,
    });
    if (grid) {
      unmask(grid.querySelectorAll<HTMLElement>('.gal-cat__cell'), { trigger: grid, stagger: 0.09 });
      rise(textRef.current?.children ?? [], { trigger: grid, y: 18, delay: 0.2 });
    }
  }, []);

  const parts = () => {
    const grid = gridRef.current;
    return {
      cells: grid ? Array.from(grid.querySelectorAll<HTMLElement>('.gal-cat__cell')) : [],
      images: grid ? Array.from(grid.querySelectorAll<HTMLElement>('.gal-cat__cell img')) : [],
      text: textRef.current ? Array.from(textRef.current.children) : [],
    };
  };

  const playIn = () => {
    const { cells, images, text } = parts();
    const tl = gsap.timeline({
      onComplete: () => {
        running.current = null;
        gsap.set(cells, { clearProps: 'clipPath' });
      },
    });
    tl.fromTo(
      cells,
      { clipPath: (i: number) => IN[i % IN.length] },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.95, ease: 'power4.inOut', stagger: 0.07 },
    )
      .fromTo(images, { scale: 1.14 }, { scale: 1, duration: 1.3, ease: 'power3.out', stagger: 0.07 }, 0)
      .fromTo(text, { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out', stagger: 0.06 }, 0.2);
    running.current = tl;
  };

  /* The second half: runs after React has committed the new category. */
  useIsomorphicLayoutEffect(() => {
    shownRef.current = shown;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!reduced()) playIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const select = (i: number) => {
    setSelected(i);
    target.current = i;
    preload(GALLERY_CATEGORIES[i]);

    if (reduced()) {
      setShown(i);
      return;
    }
    if (i === shownRef.current && !running.current) return;

    running.current?.kill();
    const { cells, images, text } = parts();
    const tl = gsap.timeline({
      onComplete: () => {
        running.current = null;
        if (target.current === shownRef.current) playIn();
        else setShown(target.current);
      },
    });
    tl.to(cells, { clipPath: (k: number) => OUT[k % OUT.length], duration: 0.5, ease: 'power3.in', stagger: 0.045 })
      .to(images, { scale: 1.08, duration: 0.5, ease: 'power2.in', stagger: 0.045 }, 0)
      .to(text, { y: -16, autoAlpha: 0, duration: 0.32, ease: 'power2.in', stagger: 0.03 }, 0);
    running.current = tl;
  };

  const visible = category.photos.slice(0, CELLS.length);
  const more = category.photos.length - visible.length;

  return (
    <section ref={scope} id="eyes" className="section section--sand gal-cat">
      <div className="wrap">
        <SectionHead
          sticker="02 · Through different eyes"
          stickerTilt={-2.4}
          title={
            <>
              The school, through different <Mark kind="underline">eyes.</Mark>
            </>
          }
          lead="Explore the many sides of life at our school."
          className="gal-cat__head"
        />

        <div className="gal-cat__body">
          <div className="gal-cat__side">
            <div className="gal-cat__controls" role="group" aria-label="Choose a category of photographs">
              {GALLERY_CATEGORIES.map((c, i) => (
                <button
                  type="button"
                  key={c.id}
                  className={`gal-cat__ctl${i === selected ? ' is-on' : ''}`}
                  aria-pressed={i === selected}
                  aria-controls="gal-cat-panel"
                  onClick={() => select(i)}
                  onPointerEnter={() => preload(c)}
                  onFocus={() => preload(c)}
                >
                  <span className="gal-cat__ctl-num" aria-hidden="true">
                    {pad(i + 1)}
                  </span>
                  <span className="gal-cat__ctl-label">{c.label}</span>
                  <span className="gal-cat__ctl-thumb" aria-hidden="true">
                    <img src={resolve(c.photos[0], 96)} alt="" loading="lazy" />
                  </span>
                </button>
              ))}
            </div>

            <div className="gal-cat__text" ref={textRef} aria-live="polite">
              <p className="meta">
                {category.label} · {plural(category.photos.length, 'photograph')}
              </p>
              <h3 className="ed-h2 gal-cat__title">{category.title}</h3>
              <p className="gal-cat__lead">{category.lead}</p>
              <p className="gal-cat__note" aria-hidden="true">
                {category.note}
              </p>
            </div>
          </div>

          <div
            id="gal-cat-panel"
            ref={gridRef}
            className={`gal-cat__grid gal-cat__grid--v${shown % 3}`}
          >
            {visible.map((photo, i) => (
              <div className={`gal-cat__cell gal-cat__cell--${CELLS[i]}`} key={`${category.id}-${photo.id}`}>
                <PhotoTile
                  photo={photo}
                  width={i === 0 ? 900 : 560}
                  sizes={i === 0 ? '(max-width: 900px) 92vw, 36vw' : '(max-width: 900px) 46vw, 18vw'}
                  label={i === visible.length - 1 && more > 0 ? `+${more} more` : category.label}
                  onOpen={() => open(category.photos, i, category.label)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
