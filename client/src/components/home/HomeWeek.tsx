import { academicImages, artsImages, everydayImages } from '@/constants/imagery';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { reduced, rise } from '@/lib/motion';
import { Figure } from '@/components/editorial';
import './week.css';

/* ==========================================================================
   08 - WEEKLY LIFE - the moving ribbon
   --------------------------------------------------------------------------
   One sentence, and under it a strip of tall photographs that travels right
   to left on its own, edge to edge, without ever arriving anywhere. A ribbon,
   not a slider: no stops, no arrows, nothing to operate.

   THE LOOP

   The sequence is rendered twice, side by side. `span` is the measured
   distance from the first copy to the second - one copy plus one gap - and
   the track moves `-span` over a constant, linear duration, repeating
   forever. A wrap modifier folds every value back into [-span, 0), so the
   position at the end of a cycle is pixel-identical to the start and there is
   no seam, no jump, and no blank gap.

   The loop is built as soon as the section mounts and rebuilt whenever the
   tiles change size, carrying its phase across so a resize does not jump.
   Tile widths come from the stylesheet, not from the photographs, so the
   measurement is correct before a single image has loaded.

   WHEN IT MOVES

   Always, while the section is on screen - no scroll, hover or click needed.
   Visibility comes from an IntersectionObserver rather than a ScrollTrigger,
   because the pinned sections above this one resize the page after mount and
   a mis-measured trigger would leave the ribbon paused in plain view.

   With `prefers-reduced-motion` nothing is built; the stylesheet turns the
   strip into a native swipeable row with the duplicate copy removed.
   ========================================================================== */

const TILES: Photo[] = [
  everydayImages.deskGirls,
  everydayImages.football,
  artsImages[1],
  everydayImages.friends,
  academicImages[2],
  everydayImages.yoga,
  everydayImages.lesson,
  artsImages[2],
  everydayImages.track,
  academicImages[5],
  everydayImages.waving,
  academicImages[1],
];

/** Seconds for the ribbon to travel one tile. Calm, but plainly moving. */
const SECONDS_PER_TILE = 3.5;

export function HomeWeek() {
  const scope = useGsapScope<HTMLElement>((ctx, el) => {
    rise(el.querySelectorAll<HTMLElement>('.week__head > *'), { trigger: el, y: 20, stagger: 0.08 });
    rise(el.querySelector<HTMLElement>('.week__ribbon'), { trigger: el, y: 30, delay: 0.15 });

    if (reduced()) return;

    const track = el.querySelector<HTMLElement>('.week__track');
    const sets = el.querySelectorAll<HTMLElement>('.week__set');
    if (!track || sets.length < 2) return;

    // Native lazy-loading measures against the clipped viewport, so a tile
    // travelling in from the edge would only be requested once it was already
    // on screen. Load the whole ribbon a screen before the section arrives -
    // both copies share URLs, so this is twelve requests, not twenty-four.
    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom+=100%',
      once: true,
      onEnter: () => el.querySelectorAll('img').forEach((img) => (img.loading = 'eager')),
    });

    let loop: gsap.core.Tween | undefined;
    let span = 0;
    let visible = false;

    const build = () =>
      ctx.add(() => {
        const next = sets[1].offsetLeft - sets[0].offsetLeft;
        if (next <= 0 || next === span) return;

        // How far through a cycle the ribbon is, so a rebuild continues from
        // the same photograph rather than snapping back to the first.
        const phase = span
          ? gsap.utils.wrap(0, 1, -Number(gsap.getProperty(track, 'x')) / span)
          : 0;

        span = next;
        loop?.kill();

        const wrapX = gsap.utils.wrap(-span, 0);
        gsap.set(track, { x: -phase * span });

        loop = gsap.to(track, {
          x: `-=${span}`,
          duration: TILES.length * SECONDS_PER_TILE,
          ease: 'none',
          repeat: -1,
          modifiers: {
            x: gsap.utils.unitize((x: string) => wrapX(parseFloat(x))),
          },
        });

        if (!visible) loop.pause();
      });

    build();
    const ro = new ResizeObserver(build);
    ro.observe(sets[0]);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) loop?.play();
        else loop?.pause();
      },
      { rootMargin: '10% 0px' },
    );
    io.observe(el);

    return () => {
      ro.disconnect();
      io.disconnect();
      loop?.kill();
    };
  }, []);

  return (
    <section ref={scope} className="week" id="weekly-life" aria-labelledby="week-title">
      <div className="week__head wrap">
        <p className="meta week__eyebrow">Weekly life</p>
        <h2 className="week__title" id="week-title">
          Every week brings new moments to learn, explore, and grow.
        </h2>
      </div>

      <div className="week__ribbon">
        <div className="week__viewport" role="region" aria-label="Photographs from an ordinary school week">
          <div className="week__track">
            {[0, 1].map((copy) => (
              <ul className="week__set" key={copy} aria-hidden={copy === 1 || undefined}>
                {TILES.map((photo) => (
                  <li className="week__tile" key={photo.id}>
                    <Figure
                      photo={photo}
                      width={320}
                      widths={[240, 360, 520]}
                      sizes="(max-width: 599px) 46vw, (max-width: 899px) 27vw, 17vw"
                      shape="square"
                      ratio="free"
                      decorative={copy === 1}
                      className="week__fig"
                    />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
