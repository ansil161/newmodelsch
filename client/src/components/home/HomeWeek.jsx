import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants';
import { everydayImages } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { settle } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Figure } from '@/components/editorial';
import './week.css';

/* The first print is the one the section opens on, so it has to carry a
   whole screen by itself: a group of friends laughing outdoors reads as
   school life at any size. Order is also stacking order in the stylesheet. */
const PRINTS = [
  {
    photo: everydayImages.friends,
    rotate: -2,
    cluster: { x: -0.2, y: -0.32, h: 0.8 },
    emerge: { at: 0.14, duration: 0.28 },
    spread: { at: 0.5, duration: 0.34 },
    drift: -3,
    sizes: '(max-width: 899px) 60vw, 46vw',
  },
  {
    photo: everydayImages.yoga,
    rotate: 1.5,
    cluster: { x: 0.4, y: -0.5, h: 0.44 },
    emerge: { at: 0.15, duration: 0.26 },
    spread: { at: 0.44, duration: 0.32 },
    drift: 4,
    sizes: '(max-width: 899px) 40vw, 20vw',
  },
  {
    photo: everydayImages.lesson,
    rotate: -1,
    cluster: { x: 0.36, y: 0.04, h: 0.6 },
    emerge: { at: 0.19, duration: 0.25 },
    spread: { at: 0.48, duration: 0.32 },
    drift: -5,
    sizes: '(max-width: 899px) 30vw, 18vw',
  },
  {
    photo: everydayImages.track,
    rotate: -1.5,
    cluster: { x: 0.25, y: 0.54, h: 0.38 },
    emerge: { at: 0.23, duration: 0.22 },
    spread: { at: 0.47, duration: 0.33 },
    drift: 3,
    sizes: '(max-width: 899px) 46vw, 22vw',
  },
  {
    photo: everydayImages.football,
    rotate: 1,
    cluster: { x: -0.3, y: 0.32, h: 0.46 },
    emerge: { at: 0.17, duration: 0.26 },
    spread: { at: 0.46, duration: 0.34 },
    drift: -4,
    sizes: '(max-width: 899px) 38vw, 18vw',
  },
  {
    photo: everydayImages.deskGirls,
    rotate: 2,
    cluster: { x: -0.72, y: -0.2, h: 0.5 },
    emerge: { at: 0.13, duration: 0.3 },
    spread: { at: 0.45, duration: 0.36 },
    drift: 5,
    sizes: '(max-width: 899px) 30vw, 16vw',
  },
  {
    photo: everydayImages.waving,
    rotate: -1,
    cluster: { x: -0.66, y: 0.36, h: 0.32 },
    emerge: { at: 0.25, duration: 0.21 },
    spread: { at: 0.52, duration: 0.3 },
    drift: -2,
    sizes: '(max-width: 899px) 26vw, 14vw',
  },
];

const TITLE = 'Every week brings new moments to learn, explore, and grow.';

/** Length of the pin, in viewports. Long enough to feel unhurried. */
const PIN = { wide: 2.6, narrow: 2.1 };

function buildMotion(scope) {
  const mm = gsap.matchMedia(scope);

  mm.add(
    {
      motion: '(prefers-reduced-motion: no-preference)',
      narrow: '(max-width: 899px)',
    },
    (context) => {
      const { motion, narrow } = context.conditions;
      if (!motion) return;

      const stage = scope.querySelector('.week__stage');
      const slot = scope.querySelector('.week__slot');
      const tiles = gsap.utils.toArray('.week__tile', scope);
      if (!stage || !slot || tiles.length !== PRINTS.length) return;

      const prints = tiles.map((tile) => tile.querySelector('.week__print'));
      const images = tiles.map((tile) => tile.querySelector('img'));

      const open = [];
      const cluster = [];

      /* Offsets rather than bounding boxes: no transform changes them, so the
         prints can be measured while the timeline is holding them anywhere.
         Every tile is positioned against `.week__prints`, which covers the
         stage exactly, so the stage centre is simply half its size. */
      const measure = () => {
        const cx = stage.clientWidth / 2;
        const cy = stage.clientHeight / 2;
        const openW = slot.offsetWidth;
        const openH = slot.offsetHeight;

        const boxes = tiles.map((tile) => ({
          cx: tile.offsetLeft + tile.offsetWidth / 2,
          cy: tile.offsetTop + tile.offsetHeight / 2,
          w: tile.offsetWidth,
          h: tile.offsetHeight,
        }));

        /* How far the cluster reaches sideways, in opening heights. A phone
           cannot hold it at full width, so its spread is compressed and its
           prints shrink a little - which is what turns it into a taller,
           more layered stack there instead of a scaled-down desktop. */
        const reach = Math.max(
          ...PRINTS.map((p, i) => Math.abs(p.cluster.x) + (p.cluster.h * (boxes[i].w / boxes[i].h)) / 2),
        );
        const fit = Math.min(1, (cx * 0.96) / (reach * openH));
        const size = Math.max(fit, 0.74);

        boxes.forEach((b, i) => {
          const c = PRINTS[i].cluster;
          open[i] = {
            x: cx - b.cx,
            y: cy - b.cy,
            scale:
              i === 0
                ? openH / b.h
                : 0.8 * Math.min((openW * 0.85) / b.w, (openH * 0.85) / b.h),
          };
          cluster[i] = {
            x: cx + c.x * openH * fit - b.cx,
            y: cy + c.y * openH - b.cy,
            scale: (c.h * openH * size) / b.h,
          };
        });
      };

      measure();

      /* One unit long, so every position is a fraction of the reader's
         journey through the pin. */
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: scope,
          start: 'top top',
          end: () => `+=${Math.round((narrow ? PIN.narrow : PIN.wide) * window.innerHeight)}`,
          pin: true,
          scrub: 1.2,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefreshInit: measure,
        },
      });

      /* EVERY TWEEN IS A `fromTo`, AND ONLY THE FIRST ON EACH ELEMENT RENDERS
         IMMEDIATELY. Both ends written down keeps every state a function of
         the scroll position after a refresh; `immediateRender: false` on the
         later ones stops them stamping their start over the opening pose. */
      const later = { immediateRender: false };

      /* ---- the one print, expanding ------------------------------------ */
      tl.fromTo(
        tiles[0],
        { x: () => open[0].x, y: () => open[0].y, scale: () => open[0].scale * 0.85 },
        {
          x: () => open[0].x,
          y: () => open[0].y,
          scale: () => open[0].scale,
          duration: 0.14,
          ease: 'power1.inOut',
        },
        0,
      );

      PRINTS.forEach((p, i) => {
        const tile = tiles[i];
        const lead = i === 0;
        const first = lead ? later : {};

        /* ---- out from behind, into the cluster ------------------------- */
        if (!lead) {
          tl.fromTo(tile, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, p.emerge.at);
        }

        tl.fromTo(
          tile,
          { x: () => open[i].x },
          { x: () => cluster[i].x, duration: p.emerge.duration, ease: 'power2.inOut', ...first },
          p.emerge.at,
        ).fromTo(
          tile,
          { y: () => open[i].y, scale: () => open[i].scale },
          {
            y: () => cluster[i].y,
            scale: () => cluster[i].scale,
            duration: p.emerge.duration,
            ease: 'power3.out',
            ...first,
          },
          p.emerge.at,
        );

        /* ---- the cluster opens, out to the finished collage ------------ */
        tl.fromTo(
          tile,
          { x: () => cluster[i].x },
          { x: 0, duration: p.spread.duration, ease: 'power2.inOut', ...later },
          p.spread.at,
        ).fromTo(
          tile,
          { y: () => cluster[i].y, scale: () => cluster[i].scale },
          { y: 0, scale: 1, duration: p.spread.duration, ease: 'power3.inOut', ...later },
          p.spread.at,
        );

        /* ---- the tilt: a small counter-lean on the way out, then its own */
        const print = prints[i];
        if (print) {
          tl.fromTo(
            print,
            { rotation: 0 },
            { rotation: -p.rotate * 0.6, duration: p.emerge.duration, ease: 'power2.out' },
            p.emerge.at,
          ).fromTo(
            print,
            { rotation: -p.rotate * 0.6 },
            { rotation: p.rotate, duration: p.spread.duration, ease: 'power2.inOut', ...later },
            p.spread.at,
          );
        }

        /* ---- the photograph settles inside its frame ------------------- */
        const image = images[i];
        if (image) {
          tl.fromTo(image, { scale: 1.16 }, { scale: 1, duration: 0.86, ease: 'power1.out' }, 0);
        }

        /* ---- depth, once everything has landed ------------------------- */
        tl.fromTo(
          tile,
          { yPercent: 0 },
          { yPercent: p.drift, duration: 0.14, ease: 'sine.inOut' },
          0.86,
        );
      });

      /* A blur scrubbed across a dozen words is paid for on every frame, and
         a phone's GPU pays most. Below 900px the words rise and fade alone. */
      const blur = (px) => (narrow ? {} : { filter: `blur(${px}px)` });

      /* ---- the words -----------------------------------------------------
         The oversized word opens from its centre first, behind everything.
         The sentence is already there, faint and blurred under the cluster -
         partially hidden by the prints themselves - and sharpens word by word
         as they move off it, landing as the collage does. */
      tl.fromTo(
        '.week__ghost',
        { clipPath: 'inset(0% 50% 0% 50%)', scale: 1.08 },
        { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 0.42, ease: 'power2.inOut' },
        0.34,
      )
        .fromTo(
          '.week__eyebrow',
          { y: 22, autoAlpha: 0, ...blur(6) },
          { y: 0, autoAlpha: 1, ...blur(0), duration: 0.18, ease: 'power2.out' },
          0.44,
        )
        .fromTo(
          '.week__rule',
          { scaleX: 0 },
          { scaleX: 1, duration: 0.2, ease: 'power2.out' },
          0.5,
        )
        .fromTo(
          '.week__word',
          { yPercent: 55, autoAlpha: 0.08, ...blur(12) },
          {
            yPercent: 0,
            autoAlpha: 1,
            ...blur(0),
            duration: 0.22,
            stagger: 0.016,
            ease: 'power2.out',
          },
          0.48,
        )
        /* The way on to the gallery arrives last, once the sentence it follows
           has finished - never while the prints are still crossing it. */
        .fromTo(
          '.week__cta',
          { y: 18, autoAlpha: 0, ...blur(6) },
          { y: 0, autoAlpha: 1, ...blur(0), duration: 0.12, ease: 'power2.out' },
          0.76,
        );

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    },
  );

  return () => mm.revert();
}

/* ==========================================================================
   The section
   ========================================================================== */

export function HomeWeek() {
  const scope = useGsapScope((_, el) => {
    /* Native lazy-loading would request a print only once it was on screen,
       which here is mid-flight. Load the set a screen before the section
       arrives instead. */
    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom+=100%',
      once: true,
      onEnter: () => el.querySelectorAll('img').forEach((img) => (img.loading = 'eager')),
    });

    const cta = el.querySelector('.week__cta');
    const unsettle = cta ? settle(cta) : undefined;
    const unbuild = buildMotion(el);

    return () => {
      unsettle?.();
      unbuild();
    };
  }, []);

  const words = TITLE.split(' ');

  return (
    <section ref={scope} className="week" id="weekly-life" aria-labelledby="week-title">
      <div className="week__stage">
        {/* The opening print's size, and nothing else. Never drawn. */}
        <span className="week__slot" aria-hidden="true" />

        <p className="week__ghost" aria-hidden="true">
          Weekly life
        </p>

        <div className="week__copy">
          <p className="meta week__eyebrow">
            <span className="week__rule" aria-hidden="true" />
            Weekly life
            <span className="week__rule" aria-hidden="true" />
          </p>
          <h2 className="week__title" id="week-title">
            {words.map((word, i) => (
              <span key={i}>
                <span className={`week__word${i === words.length - 1 ? ' week__word--last' : ''}`}>
                  {word}
                </span>
                {i < words.length - 1 ? ' ' : null}
              </span>
            ))}
          </h2>
          <Link className="btn btn-primary week__cta" to={ROUTES.gallery}>
            <span className="btn__label">
              Explore the gallery
              <Icon name="arrowRight" size={16} />
            </span>
          </Link>
        </div>

        <ul className="week__prints" aria-label="Photographs from an ordinary school week">
          {PRINTS.map((print, i) => (
            <li className={`week__tile week__tile--${i + 1}`} key={print.photo.id}>
              <div className="week__print" style={{ '--r': `${print.rotate}deg` }}>
                <Figure
                  photo={print.photo}
                  width={520}
                  widths={[320, 520, 800, 1100]}
                  sizes={print.sizes}
                  shape="frame"
                  ratio="free"
                  className="week__fig"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
