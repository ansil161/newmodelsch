import { GALLERY_TOTALS, HERO_PHOTOS } from '@/constants/gallery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { SplitText, gsap } from '@/lib/gsap';
import { drift, reduced } from '@/lib/motion';
import { onStage, stageOpen } from '@/lib/stage';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import { Icon } from '@/components/common/Icon';
import { Sticker } from '@/components/editorial';
import { useLightbox } from './PhotoLightbox';
import { PhotoTile } from './PhotoTile';

/* ==========================================================================
   GALLERY HERO - "Moments that become memories."
   --------------------------------------------------------------------------
   Not a full-screen background. The type holds the left of the page and the
   right is a composed desk of photographs: one large candid frame cut to the
   site's squircle, and three prints laid over and around it on paper borders,
   each at a slightly different angle, the way a yearbook editor spreads a
   day's prints before choosing.

   ARRIVAL, gated on the page transition like every opening screen:
     0.00  the lead photograph is printed up from its bottom edge
     0.30  the headline rises line by line
     0.45  the prints are laid down one after another
     0.70  the lead paragraph, the button and the facts

   Each print then drifts at its own rate as the page scrolls, so the desk
   has depth without anything moving on its own.
   ========================================================================== */

const PRINT_WIDTHS = [520, 420, 460];

export function GalleryHero() {
  const { scrollTo } = useSmoothScroll();
  const open = useLightbox();
  const all = [HERO_PHOTOS.main, ...HERO_PHOTOS.supporting];

  const scope = useGsapScope((_, el) => {
    // Depth in proportion to the prints: a 160px drift reads as layers on a
    // desktop spread and as a photograph sliding off a phone. The same
    // parallax, scaled per range, and rebuilt live on rotation.
    gsap.matchMedia(el).add(
      { phone: '(max-width: 599px)', tablet: '(min-width: 600px) and (max-width: 1024px)' },
      ({ conditions }) => {
        const k = conditions.phone ? 0.45 : conditions.tablet ? 0.7 : 1;
        el.querySelectorAll('[data-depth]').forEach((node) => {
          drift(node, Number(node.dataset.depth) * k, { trigger: el });
        });
      },
    );

    if (reduced()) return;

    const title = el.querySelector('.gal-hero__title');
    const split = title
      ? new SplitText(title, { type: 'lines', mask: 'lines', linesClass: 'split-line' })
      : null;

    const tl = gsap.timeline({ paused: !stageOpen(), defaults: { ease: 'power4.out' } });
    tl.from('.gal-hero__main', { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.3, ease: 'power4.inOut' }, 0)
      .from('.gal-hero__main img', { scale: 1.16, duration: 1.9, ease: 'power3.out' }, 0)
      .from('.gal-hero__tag > *', { y: 14, autoAlpha: 0, duration: 0.6, stagger: 0.08 }, 0.15)
      .from(split?.lines ?? [], { yPercent: 118, duration: 1.1, stagger: 0.09 }, 0.3)
      .from('.gal-hero__print', { y: 70, autoAlpha: 0, duration: 1.1, stagger: 0.13, ease: 'power3.out' }, 0.45)
      .from('.gal-hero__body > *', { y: 20, autoAlpha: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' }, 0.7)
      .from('.gal-hero__stamp', { y: 10, autoAlpha: 0, duration: 0.7 }, 1.2);

    // The split exists for the entrance only. Put the title back once it has
    // played, so a later resize or rotation re-wraps real text rather than
    // leaving stale lines to wrap again inside their own clipping masks.
    tl.eventCallback('onComplete', () => split?.revert());

    const release = onStage(() => tl.play());
    return () => {
      release();
      tl.kill();
      split?.revert();
    };
  }, []);

  return (
    <section ref={scope} className="gal-hero">
      <div className="wrap gal-hero__grid">
        <div className="gal-hero__text">
          <div className="gal-hero__tag">
            <Sticker tilt={-2.4}>School gallery</Sticker>
            <span className="meta">The living yearbook</span>
          </div>

          <h1 className="ed-hero gal-hero__title">
            Moments that become <span className="ed-em">memories.</span>
          </h1>

          <div className="gal-hero__body">
            <p className="lead gal-hero__lead">
              Explore the people, celebrations, achievements, and everyday moments that make our
              school community special.
            </p>

            <div className="gal-hero__actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => scrollTo('#glimpse', -72)}
              >
                <span className="btn__label">
                  Explore memories
                  <Icon name="arrowDown" size={16} />
                </span>
              </button>
            </div>

            <dl className="gal-hero__facts">
              <div>
                <dt>Academic years</dt>
                <dd className="stat-num">{GALLERY_TOTALS.years}</dd>
              </div>
              <div>
                <dt>Events</dt>
                <dd className="stat-num">{GALLERY_TOTALS.events}</dd>
              </div>
              <div>
                <dt>Photographs</dt>
                <dd className="stat-num">{GALLERY_TOTALS.photos}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="gal-hero__stage">
          <div className="gal-hero__main">
            <div data-depth="-50">
              <PhotoTile
                photo={HERO_PHOTOS.main}
                width={900}
                sizes="(max-width: 900px) 66vw, 34vw"
                shape="blob"
                ratio="portrait"
                label="Student Life"
                eager
                onOpen={() => open(all, 0, 'School gallery')}
              />
            </div>
          </div>

          {HERO_PHOTOS.supporting.map((photo, i) => (
            <div className={`gal-hero__print gal-hero__print--${i + 1}`} key={photo.id}>
              <div data-depth={[90, 140, 60][i]}>
                <div className="gal-hero__paper">
                  <PhotoTile
                    photo={photo}
                    width={PRINT_WIDTHS[i]}
                    sizes="(max-width: 900px) 40vw, 18vw"
                    shape="frame"
                    ratio={i === 2 ? 'square-ar' : 'landscape'}
                    eager
                    onOpen={() => open(all, i + 1, 'School gallery')}
                  />
                </div>
              </div>
            </div>
          ))}

          <span className="gal-hero__stamp meta" aria-hidden="true">
            Vol. 64 · 2025–26
          </span>
        </div>
      </div>
    </section>
  );
}
