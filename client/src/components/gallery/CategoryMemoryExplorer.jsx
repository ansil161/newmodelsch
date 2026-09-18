import { useEffect, useRef, useState } from 'react';
import { GALLERY_CATEGORIES } from '@/constants/gallery';
import { resolve, resolveSet } from '@/constants/imagery';
import { Icon } from '@/components/common/Icon';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import { lines, reduced, rise, unmask } from '@/lib/motion';
import { useLightbox } from './PhotoLightbox';

/* ==========================================================================
   THROUGH DIFFERENT EYES - the lens switcher
   --------------------------------------------------------------------------
   Seven ways of looking at one school. A pill bar of lenses, each carrying
   a small photograph of its own, sits above a bento of four framed photos.
   The largest frame carries the lens's title, line and a "view all" button
   over a dark gradient, so the words are always legible on the picture.

   The frames never move. Only their contents change, so the page never
   jumps: on a change of lens every photograph wipes away upward, the caption
   lifts out, the next set is committed, and the new photographs wipe in
   from below and settle from a slight zoom while the new title rises.

   While the section is on screen the lenses advance on their own, with a
   ring around the active lens's thumbnail filling as the clock runs. The
   clock pauses under the pointer or keyboard focus. With reduced motion
   there is no clock and no transition: a lens simply changes.
   ========================================================================== */

const CELLS = 'abcd';
const DWELL = 7;
/* Circumference of the progress ring: r = 17 in a 38-unit box. */
const RING = 2 * Math.PI * 17;

const SIZES = [
  '(max-width: 1023px) 92vw, 56vw',
  '(max-width: 1023px) 92vw, 40vw',
  '(max-width: 1023px) 46vw, 24vw',
  '(max-width: 1023px) 46vw, 16vw',
];
const WIDTHS = [[640, 1000, 1600], [560, 900, 1300], [360, 560, 900], [320, 480, 760]];

const preloaded = new Set();
function preload(category) {
  if (preloaded.has(category.id)) return;
  preloaded.add(category.id);
  category.photos.slice(0, CELLS.length).forEach((p, i) => {
    new Image().src = resolve(p, WIDTHS[i][1]);
  });
}

const TOTAL_PHOTOS = GALLERY_CATEGORIES.reduce((n, c) => n + c.photos.length, 0);

export function CategoryMemoryExplorer() {
  const open = useLightbox();
  const total = GALLERY_CATEGORIES.length;
  const [selected, setSelected] = useState(0);
  const [shown, setShown] = useState(0);

  const stageRef = useRef(null);
  const tabsRef = useRef(null);
  const running = useRef(null);
  const target = useRef(0);
  const shownRef = useRef(0);
  /* The lens the stage last animated to. Compared rather than a "has
     mounted" flag, because StrictMode runs layout effects twice on mount. */
  const played = useRef(0);
  const clock = useRef(null);
  const gate = useRef({ inView: false, hover: false, focus: false });

  const category = GALLERY_CATEGORIES[shown];
  const plates = category.photos.slice(0, CELLS.length);

  /* ------------------------------------------------------------- clock */
  const syncClock = () => {
    const c = clock.current;
    if (!c) return;
    const g = gate.current;
    if (g.inView && !g.hover && !g.focus) c.play();
    else c.pause();
  };

  /* ---------------------------------------------------- scroll entrance */
  const scope = useGsapScope((_, el) => {
    const undo = lines(el.querySelector('.lens__h'), { stagger: 0.1 });
    rise(el.querySelector('.lens__sub'), { trigger: el.querySelector('.lens__head'), y: 18, delay: 0.25 });
    /* The bar rises as two whole pieces. Rising each tab would slide them
       through the tab tray's scroll clip and fight their CSS press
       transition, leaving them cut off at the tray's lower edge. */
    rise(el.querySelectorAll('.lens__tabs, .lens__ctls'), { trigger: el.querySelector('.lens__bar'), y: 16, stagger: 0.1 });
    const stage = stageRef.current;
    if (stage) {
      unmask(stage.querySelectorAll('.lens__media'), { trigger: stage, stagger: 0.1 });
      rise(stage.querySelectorAll('.lens__caption > *'), { trigger: stage, y: 24, delay: 0.45, stagger: 0.08 });
    }

    /* The clock runs only while the photographs themselves are on screen,
       so a lens never changes before the reader has seen it. */
    const st = ScrollTrigger.create({
      trigger: stage ?? el,
      start: 'top 70%',
      end: 'bottom 30%',
      onToggle: (self) => {
        gate.current.inView = self.isActive;
        syncClock();
      },
    });
    gate.current.inView = st.isActive;
    syncClock();

    return () => undo?.();
  }, []);

  /* ------------------------------------------------------- parts & swap */
  const parts = () => {
    const stage = stageRef.current;
    const q = (s) => (stage ? Array.from(stage.querySelectorAll(s)) : []);
    return {
      media: q('.lens__media'),
      images: q('.lens__media img'),
      caption: q('.lens__caption > *'),
      title: q('.lens__line'),
    };
  };

  const playIn = () => {
    const { media, images, caption, title } = parts();
    const tl = gsap.timeline({
      onComplete: () => {
        running.current = null;
        gsap.set(media, { clearProps: 'clipPath' });
      },
    });
    tl.fromTo(
      media,
      { clipPath: 'inset(100% 0% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power4.out', stagger: 0.07 },
    )
      .fromTo(images, { scale: 1.18 }, { scale: 1, duration: 1.5, ease: 'power3.out', stagger: 0.07 }, 0.1)
      .fromTo(caption, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out', stagger: 0.08 }, 0.45)
      .fromTo(title, { yPercent: 105 }, { yPercent: 0, duration: 1, ease: 'expo.out' }, 0.45);
    running.current = tl;
  };

  useIsomorphicLayoutEffect(() => {
    shownRef.current = shown;
    if (played.current === shown) return;
    if (reduced()) {
      played.current = shown;
      return undefined;
    }

    /* The frames stay shut until the new photographs have decoded (or a
       short timeout passes on a slow line), so a wipe never opens onto an
       empty mount. The new title is held under its mask meanwhile. */
    const { images, title } = parts();
    gsap.set(title, { yPercent: 105 });
    let cancelled = false;
    Promise.race([
      Promise.all(images.map((img) => (img.decode ? img.decode().catch(() => {}) : null))),
      new Promise((r) => setTimeout(r, 1500)),
    ]).then(() => {
      if (cancelled || shownRef.current !== shown || played.current === shown) return;
      played.current = shown;
      playIn();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const centreTab = (i) => {
    const bar = tabsRef.current;
    const tab = bar?.children[i];
    if (!bar || !tab || bar.scrollWidth <= bar.clientWidth) return;
    bar.scrollTo({
      left: tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2,
      behavior: reduced() ? 'auto' : 'smooth',
    });
  };

  const select = (i) => {
    setSelected(i);
    target.current = i;
    preload(GALLERY_CATEGORIES[i]);
    centreTab(i);

    if (reduced()) {
      setShown(i);
      return;
    }
    if (i === shownRef.current && !running.current) return;

    running.current?.kill();
    const { media, images, caption } = parts();
    const tl = gsap.timeline({
      onComplete: () => {
        running.current = null;
        if (target.current === shownRef.current) {
          played.current = shownRef.current;
          playIn();
        } else {
          setShown(target.current);
        }
      },
    });
    tl.to(media, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.42, ease: 'power3.in', stagger: 0.04 })
      .to(images, { scale: 1.08, duration: 0.42, ease: 'power2.in', stagger: 0.04 }, 0)
      .to(caption, { y: -18, autoAlpha: 0, duration: 0.32, ease: 'power2.in', stagger: 0.03 }, 0);
    running.current = tl;
  };

  const step = (d) => select((target.current + d + total) % total);

  /* The clock restarts on every lens. */
  useEffect(() => {
    const arcs = tabsRef.current ? Array.from(tabsRef.current.querySelectorAll('.lens__ring-arc')) : [];
    gsap.set(arcs, { strokeDashoffset: RING });
    if (reduced()) return undefined;
    const arc = arcs[selected];
    if (!arc) return undefined;

    preload(GALLERY_CATEGORIES[(selected + 1) % total]);
    clock.current = gsap.fromTo(
      arc,
      { strokeDashoffset: RING },
      {
        strokeDashoffset: 0,
        duration: DWELL,
        ease: 'none',
        paused: true,
        onComplete: () => step(1),
      },
    );
    syncClock();
    return () => {
      clock.current?.kill();
      clock.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  /* Roving focus: arrow keys move along the tabs and choose as they go. */
  const onTabKey = (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    let next;
    if (d) next = (target.current + d + total) % total;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = total - 1;
    else return;
    e.preventDefault();
    select(next);
    tabsRef.current?.children[next]?.focus();
  };

  const holdOn = (key) => () => {
    gate.current[key] = true;
    syncClock();
  };
  const holdOff = (key) => (e) => {
    if (key === 'focus' && e.currentTarget.contains(e.relatedTarget)) return;
    gate.current[key] = false;
    syncClock();
  };

  return (
    <section
      ref={scope}
      id="eyes"
      className="section lens"
      aria-labelledby="lens-heading"
      onFocus={holdOn('focus')}
      onBlur={holdOff('focus')}
    >
      <div className="wrap">
        <header className="lens__head">
          <h2 className="lens__h" id="lens-heading">
            The school, through <span className="lens__h-accent">different eyes.</span>
          </h2>
          <p className="lens__sub">
            Seven lenses on everyday life at New Model, from the loudest festival to the quietest
            corner of the library. {TOTAL_PHOTOS} photographs in all.
          </p>
        </header>

        <div className="lens__bar">
          <div
            ref={tabsRef}
            className="lens__tabs"
            role="tablist"
            aria-label="Choose a lens"
            onKeyDown={onTabKey}
          >
            {GALLERY_CATEGORIES.map((c, i) => (
              <button
                type="button"
                role="tab"
                key={c.id}
                id={`lens-tab-${i}`}
                className={`lens__tab${i === selected ? ' is-on' : ''}`}
                aria-selected={i === selected}
                aria-controls="lens-panel"
                tabIndex={i === selected ? 0 : -1}
                onClick={() => select(i)}
                onPointerEnter={() => preload(c)}
              >
                <span className="lens__thumb" aria-hidden="true">
                  <img src={resolve(c.photos[0], 96)} alt="" loading="lazy" />
                  <svg className="lens__ring" viewBox="0 0 38 38">
                    <circle className="lens__ring-track" cx="19" cy="19" r="17" />
                    <circle
                      className="lens__ring-arc"
                      cx="19"
                      cy="19"
                      r="17"
                      strokeDasharray={RING}
                      strokeDashoffset={RING}
                    />
                  </svg>
                </span>
                <span className="lens__tab-label">{c.label}</span>
              </button>
            ))}
          </div>

          <div className="lens__ctls">
            <button type="button" className="lens__ctl" onClick={() => step(-1)} aria-label="Previous lens">
              <Icon name="arrowLeft" size={18} />
            </button>
            <button type="button" className="lens__ctl" onClick={() => step(1)} aria-label="Next lens">
              <Icon name="arrowRight" size={18} />
            </button>
          </div>
        </div>

        <div
          ref={stageRef}
          id="lens-panel"
          className="lens__stage"
          role="tabpanel"
          aria-labelledby={`lens-tab-${shown}`}
          onPointerEnter={holdOn('hover')}
          onPointerLeave={holdOff('hover')}
        >
          {plates.map((photo, i) => (
            <div className={`lens__cell lens__cell--${CELLS[i]}`} key={CELLS[i]}>
              <div className="lens__frame">
                <button
                  type="button"
                  className="lens__open"
                  data-cursor="View"
                  onClick={() => open(category.photos, i, category.label)}
                >
                  <span className="lens__media">
                    <img
                      key={photo.id}
                      src={resolve(photo, WIDTHS[i][1])}
                      srcSet={resolveSet(photo, WIDTHS[i]) || undefined}
                      sizes={SIZES[i]}
                      alt=""
                      loading={shown === 0 ? 'lazy' : 'eager'}
                      decoding="async"
                      style={photo.focus ? { objectPosition: photo.focus } : undefined}
                    />
                  </span>
                  <span className="sr-only">Open photograph: {photo.alt}</span>
                  {i > 0 ? (
                    <span className="lens__peek" aria-hidden="true">
                      <Icon name="arrowUpRight" size={18} />
                    </span>
                  ) : null}
                </button>

                {i === 0 ? (
                  <div className="lens__caption" aria-live="polite">
                    <p className="lens__label">{category.label}</p>
                    <h3 className="lens__title">
                      <span className="lens__mask">
                        <span className="lens__line" key={category.id}>
                          {category.title}
                        </span>
                      </span>
                    </h3>
                    <p className="lens__lead">{category.lead}</p>
                    <button
                      type="button"
                      className="lens__cta"
                      onClick={() => open(category.photos, 0, category.label)}
                    >
                      <span>View all {category.photos.length} photos</span>
                      <span className="lens__cta-icon" aria-hidden="true">
                        <Icon name="arrowUpRight" size={16} />
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
