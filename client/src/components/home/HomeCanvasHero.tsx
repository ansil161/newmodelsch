import type { CSSProperties, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants';
import { campusImages, resolve, resolveSet } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { onStage, stageOpen } from '@/lib/stage';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import { Icon } from '@/components/common/Icon';
import './canvas-hero.css';

/* ==========================================================================
   01 - HERO, AS AN EDITORIAL CANVAS
   --------------------------------------------------------------------------
   Not a split screen. One white sheet with every element placed on it by
   hand: a restrained two-line statement in the upper middle, three students
   cut out of their photographs standing together in the lower middle, thin
   orbit lines drawn round them, and a handful of small labels, figures and
   shapes distributed through the space between.

   THE HIERARCHY IS THE COMPOSITION

     1. the statement           2. the students
     3. the orbit lines         4. the three figures
     5. the small shapes        6. the call to action

   THREE MOTION LAYERS, THREE WRITERS - NEVER TWO ON ONE PROPERTY

     [data-depth] wrappers   one rAF loop writes `transform`: pointer
                             parallax (data-mouse, px at the screen edge) plus
                             scroll travel (data-scroll, px over the section).
     their children          GSAP writes `transform` + opacity, once, for the
                             entrance.
     continuous drift        CSS keyframes on the independent `translate`
                             property, so it composes with both of the above.
     hover                   the independent `scale` / `rotate` / `translate`
                             properties on grandchildren, for the same reason.

   ENTRANCE (held behind the brand intro by the stage gate, as before)

     0.2  label slides in      0.3  headline, line by line, from its mask
     0.5  students spring up   0.7  orbit lines draw themselves
     0.9  figures, one by one  1.1  small shapes, scattered
     1.3  call to action

   Reduced motion: no loop, no drift, no parallax - a single fade.
   ========================================================================== */

const STUDENTS = [
  { id: 'blue', src: '/images/home/hero/student-blue.webp', w: 770, h: 888, mouse: 1, scroll: -8 },
  { id: 'girl', src: '/images/home/hero/student-girl.webp', w: 632, h: 851, mouse: 3, scroll: -24 },
  { id: 'book', src: '/images/home/hero/student-book.webp', w: 577, h: 1100, mouse: 2, scroll: -14 },
] as const;

const FIGURES = [
  { id: 'legacy', value: '64', suffix: '', label: 'Years of legacy', icon: 'history', mouse: 6, scroll: -40 },
  { id: 'learning', value: '13', suffix: '', label: 'Years of learning, Nursery to Class 10', icon: 'sprout', mouse: 8, scroll: -56 },
  { id: 'results', value: '100', suffix: '%', label: 'Board results, twelve years running', icon: 'cap', mouse: 5, scroll: -28 },
] as const;

const STEPS = ['Learn', 'Grow', 'Lead', 'Belong'];

interface FloatingObject {
  kind: 'sq' | 'dot' | 'ring' | 'plus' | 'arrow' | 'icon';
  tone: 'blue' | 'lav' | 'mint' | 'sky';
  /** Position on the desktop canvas, in percent. */
  x: number;
  y: number;
  /** Position inside the scene on tablet and phone. Omit with `sm: false`. */
  xm?: number;
  ym?: number;
  size: number;
  rot?: number;
  float?: 'y' | 'x' | 'diag';
  dur?: number;
  mouse: number;
  scroll: number;
  sm?: false;
}

/* Deliberately not all floating: the icon, the ring and the arrow's twin hold
   still, so the drift reads as a few things alive rather than a screensaver. */
const OBJECTS: FloatingObject[] = [
  { kind: 'sq', tone: 'blue', x: 17, y: 30, xm: 52, ym: 20, size: 9, rot: 14, float: 'diag', dur: 8, mouse: 7, scroll: -60 },
  { kind: 'sq', tone: 'lav', x: 88, y: 25, size: 14, rot: -10, float: 'diag', dur: 10, mouse: 9, scroll: -80, sm: false },
  { kind: 'dot', tone: 'mint', x: 26, y: 95, xm: 30, ym: 23, size: 9, float: 'y', dur: 6, mouse: 5, scroll: -30 },
  { kind: 'dot', tone: 'blue', x: 61, y: 13, xm: 96, ym: 46, size: 6, float: 'y', dur: 12, mouse: 10, scroll: -90 },
  { kind: 'ring', tone: 'blue', x: 35, y: 88, size: 26, mouse: 4, scroll: -40, sm: false },
  { kind: 'plus', tone: 'blue', x: 12, y: 74, size: 12, float: 'x', dur: 9, mouse: 6, scroll: -50, sm: false },
  { kind: 'arrow', tone: 'blue', x: 9, y: 36, size: 22, float: 'x', dur: 7, mouse: 5, scroll: -44, sm: false },
  { kind: 'icon', tone: 'blue', x: 60, y: 45, size: 30, mouse: 6, scroll: -70, sm: false },
  { kind: 'sq', tone: 'mint', x: 95, y: 72, xm: 50, ym: 43, size: 8, rot: 22, float: 'diag', dur: 11, mouse: 8, scroll: -64 },
  { kind: 'sq', tone: 'sky', x: 4, y: 20, size: 11, rot: -18, float: 'diag', dur: 12, mouse: 6, scroll: -36, sm: false },
  { kind: 'dot', tone: 'lav', x: 95, y: 12, xm: 62, ym: 22, size: 10, float: 'y', dur: 9, mouse: 9, scroll: -70 },
];

const campusPhoto = campusImages[7];

export function HomeHero() {
  const { scrollTo } = useSmoothScroll();
  const calm = reduced();

  const scope = useGsapScope<HTMLElement>((_, el) => {
    const q = gsap.utils.selector(el);
    const canvas = el.querySelector<HTMLElement>('.ch__canvas');

    if (reduced()) {
      el.classList.remove('is-pending');
      const fade = gsap.from(canvas, { autoAlpha: 0, duration: 0.6, ease: 'power1.out', paused: true });
      const release = onStage(() => fade.play());
      return () => {
        release();
        fade.kill();
      };
    }

    /* ---------------------------------------------------------------- entrance */
    const tl = gsap.timeline({ paused: !stageOpen(), defaults: { ease: 'ease-out-quint' } });

    const students = ['girl', 'blue', 'book']
      .map((id) => el.querySelector<HTMLElement>(`.ch__student--${id} img`))
      .filter(Boolean);

    tl.from(q('.ch__kicker'), { x: -28, autoAlpha: 0, duration: 0.9 }, 0.2)
      .from(q('.ch__place, .ch__progress'), { x: 22, autoAlpha: 0, duration: 0.9, stagger: 0.08 }, 0.3)
      .from(q('.ch__line > span'), { yPercent: 100, autoAlpha: 0, duration: 1.15, stagger: 0.12 }, 0.3)
      .from(q('.ch__ground-in'), { yPercent: 24, autoAlpha: 0, duration: 1.5 }, 0.35)
      .from(students, { y: 90, autoAlpha: 0, duration: 1.35, ease: 'back.out(1.2)', stagger: 0.1 }, 0.5)
      .fromTo(
        q('.ch__orbit [data-draw]'),
        { strokeDasharray: 1, strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 1.9, ease: 'power2.inOut', stagger: 0.14 },
        0.7,
      )
      .from(q('.ch__orbit [data-fade]'), { autoAlpha: 0, duration: 1 }, 1.3)
      .from(q('.ch__stat-in'), { y: 22, autoAlpha: 0, duration: 1, stagger: 0.12 }, 0.9)
      .from(q('.ch__lead'), { y: 16, autoAlpha: 0, duration: 1 }, 0.95)
      .from(q('.ch__campus-in'), { scale: 0.86, autoAlpha: 0, duration: 1.1 }, 1)
      .from(
        q('.ch__obj-in'),
        { scale: 0, autoAlpha: 0, duration: 0.8, ease: 'back.out(2)', stagger: { each: 0.05, from: 'random' } },
        1.1,
      )
      .from(q('.ch__note-in'), { y: 10, autoAlpha: 0, duration: 0.9, stagger: 0.15 }, 1.15)
      .fromTo(
        q('.ch__note path'),
        { strokeDasharray: 1, strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 0.8, ease: 'power2.out', stagger: 0.12 },
        1.35,
      )
      .from(q('.ch__foot > *, .ch__cue'), { y: 16, autoAlpha: 0, duration: 0.9, stagger: 0.08 }, 1.3);

    // Figures count up to themselves. The authored number is the source of
    // truth and is put back on teardown; assistive tech reads the sr-only copy.
    const restores: Array<() => void> = [];
    q('.ch__count').forEach((node, i) => {
      const final = node.textContent ?? '';
      const value = parseFloat(final);
      if (!Number.isFinite(value)) return;
      const box = { n: 0 };
      node.textContent = '0';
      tl.to(
        box,
        {
          n: value,
          duration: 1.6,
          ease: 'power2.out',
          onUpdate: () => {
            node.textContent = String(Math.round(box.n));
          },
        },
        1 + i * 0.12,
      );
      restores.push(() => {
        node.textContent = final;
      });
    });

    el.classList.remove('is-pending');
    const release = onStage(() => tl.play());

    /* ------------------------------------------------- parallax + progress loop */
    const layers = Array.from(el.querySelectorAll<HTMLElement>('[data-depth]')).map((node) => ({
      node,
      mouse: parseFloat(node.dataset.mouse ?? '0'),
      scroll: parseFloat(node.dataset.scroll ?? '0'),
    }));
    const ground = el.querySelector<HTMLElement>('.ch__ground');
    const progress = el.querySelector<HTMLElement>('.ch__progress');
    const steps = Array.from(el.querySelectorAll<HTMLElement>('.ch__progress li'));
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const wide = window.matchMedia('(min-width: 1200px)');

    let targetX = 0;
    let targetY = 0;
    let mouseX = 0;
    let mouseY = 0;
    let scrolled = 0;
    let drawn = -1;
    let active = 0;
    let visible = true;

    ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom top',
      onUpdate: (self) => {
        scrolled = self.progress;
      },
    });

    const tick = () => {
      if (!visible) return;
      mouseX += (targetX - mouseX) * 0.075;
      mouseY += (targetY - mouseY) * 0.075;
      const settled = Math.abs(targetX - mouseX) < 0.001 && Math.abs(targetY - mouseY) < 0.001;
      if (settled && scrolled === drawn) return;
      drawn = scrolled;

      const reach = wide.matches ? 1 : 0.6;
      for (const layer of layers) {
        const x = mouseX * layer.mouse;
        const y = mouseY * layer.mouse + scrolled * layer.scroll * reach;
        layer.node.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      }

      // The pale ground swells upward as the students leave, so the hero
      // hands over to the white section below without an edge.
      if (ground) ground.style.transform = `scale(${1 + scrolled * 0.18}, ${1 + scrolled * 0.85})`;

      if (progress) {
        const p = Math.min(1, scrolled / 0.8);
        progress.style.setProperty('--p', p.toFixed(3));
        const index = Math.min(steps.length - 1, Math.floor(Math.min(0.999, p) * steps.length));
        if (index !== active) {
          steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
          active = index;
        }
      }
    };
    gsap.ticker.add(tick);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(el);

    /* ------------------------------------------------------ pointer + magnet */
    const cta = el.querySelector<HTMLElement>('.ch__cta');
    const arrow = cta?.querySelector<HTMLElement>('.ch__cta-arrow');
    const clamp = gsap.utils.clamp(-8, 8);
    const ctaX = cta && gsap.quickTo(cta, 'x', { duration: 0.5, ease: 'power3.out' });
    const ctaY = cta && gsap.quickTo(cta, 'y', { duration: 0.5, ease: 'power3.out' });
    const arrowX = arrow && gsap.quickTo(arrow, 'x', { duration: 0.65, ease: 'power3.out' });

    const onMove = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;

      if (!cta || !ctaX || !ctaY) return;
      const r = cta.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const radius = r.width / 2 + 80;
      const pull = Math.max(0, 1 - Math.hypot(dx, dy) / radius);
      ctaX(clamp(dx * 0.16) * Math.min(1, pull * 1.8));
      ctaY(clamp(dy * 0.22) * Math.min(1, pull * 1.8));
      arrowX?.(gsap.utils.clamp(-5, 5, dx * 0.08) * pull);
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      ctaX?.(0);
      ctaY?.(0);
      arrowX?.(0);
    };

    const onCtaEnter = () => gsap.to(cta, { scale: 1.02, duration: 0.4, ease: 'power3.out' });
    const onCtaLeave = () => gsap.to(cta, { scale: 1, duration: 0.45, ease: 'power3.out' });

    if (fine) {
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      cta?.addEventListener('pointerenter', onCtaEnter);
      cta?.addEventListener('pointerleave', onCtaLeave);
    }

    return () => {
      release();
      tl.kill();
      gsap.ticker.remove(tick);
      io.disconnect();
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      cta?.removeEventListener('pointerenter', onCtaEnter);
      cta?.removeEventListener('pointerleave', onCtaLeave);
      restores.forEach((fn) => fn());
    };
  }, []);

  const jump = (target: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    scrollTo(target);
  };

  return (
    <section ref={scope} className="ch is-pending" aria-labelledby="ch-title">
      <div className="ch__canvas">
        {/* ------------------------------------------------------------ type */}
        <div className="ch__head">
          <p className="ch__kicker">
            <span className="ch__kicker-rule" aria-hidden="true" />
            Our legacy
            <span className="ch__kicker-dot" aria-hidden="true" />
            <span className="ch__kicker-est">Est. 1962</span>
          </p>

          <h1 className="ch__title" id="ch-title" data-depth="" data-mouse="1.5" data-scroll="40">
            <span className="ch__line">
              <span>Building minds</span>
            </span>
            <span className="ch__line ch__line--2">
              <span>
                that <em className="ch__serif">move</em> the world.
              </span>
            </span>
          </h1>

          <p className="ch__lead">
            One campus, Nursery through Class 10, and a rule kept since 1962: no class grows past
            the point where a teacher can hold every name.
          </p>
        </div>

        <p className="ch__place">
          Bahadurpura, Hyderabad
          <span>Nursery — Class 10</span>
        </p>

        {/* ----------------------------------------------------------- scene */}
        <div className="ch__scene">
          <div className="ch__ground" aria-hidden="true">
            <div className="ch__ground-in">
              <svg viewBox="0 0 1440 420" preserveAspectRatio="none" focusable="false">
                <defs>
                  <linearGradient id="ch-ground-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#eaf0fc" />
                    <stop offset="0.55" stopColor="#f5f5fb" />
                    <stop offset="1" stopColor="#ffffff" />
                  </linearGradient>
                  {/* Fades to nothing at the foot, so the overlapping form never
                      draws a line against the white section below. */}
                  <linearGradient id="ch-ground-lav" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#dcd8ee" stopOpacity="0.42" />
                    <stop offset="0.85" stopColor="#dcd8ee" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 420V236C200 160 430 104 730 112C1030 120 1240 200 1440 158V420Z" fill="url(#ch-ground-fill)" />
                <path d="M880 420V296C1030 226 1220 212 1440 246V420Z" fill="url(#ch-ground-lav)" />
                <path className="ch__ground-line" d="M-20 214C220 134 440 84 730 92C1030 100 1250 182 1460 136" />
              </svg>
            </div>
          </div>

          {OBJECTS.map((o, i) => (
            <span
              key={i}
              className={`ch__obj ch__obj--${o.kind} is-${o.tone}`}
              data-depth=""
              data-mouse={o.mouse}
              data-scroll={o.scroll}
              data-sm={o.sm === false ? 'off' : undefined}
              aria-hidden="true"
              style={
                {
                  '--x': `${o.x}%`,
                  '--y': `${o.y}%`,
                  '--xm': o.xm !== undefined ? `${o.xm}%` : undefined,
                  '--ym': o.ym !== undefined ? `${o.ym}%` : undefined,
                  '--s': `${o.size}px`,
                  '--r': `${o.rot ?? 0}deg`,
                  '--float': o.float ? `ch-float-${o.float}` : 'none',
                  '--dur': `${o.dur ?? 10}s`,
                } as CSSProperties
              }
            >
              <i className="ch__obj-in">
                {o.kind === 'plus' ? (
                  <svg viewBox="0 0 12 12" focusable="false">
                    <path d="M6 1v10M1 6h10" />
                  </svg>
                ) : o.kind === 'arrow' ? (
                  <svg viewBox="0 0 24 12" focusable="false">
                    <path d="M1 6h20M16 1.5 21 6l-5 4.5" />
                  </svg>
                ) : o.kind === 'icon' ? (
                  <Icon name="book" size={14} />
                ) : null}
              </i>
            </span>
          ))}

          {/* The students, with the orbit lines drawn round them. The orbit
              frames are sized off the stage, so the arcs hug the group at
              every breakpoint and run off the canvas edges. */}
          <div className="ch__stage-pos" data-depth="" data-mouse="2" data-scroll="-70">
            <div className="ch__orbit" data-depth="" data-mouse="1.5" data-scroll="16" aria-hidden="true">
              <svg className="ch__orbit-svg" viewBox="0 0 1600 1000" focusable="false">
                <g className="ch__orbit-drift">
                  <g transform="rotate(-9 800 520)">
                    <path id="ch-orbit-main" data-draw="" pathLength={1} d="M274 600A560 235 0 1 1 1229 671" />
                    <circle data-fade="" className="ch__orbit-node is-hollow" cx="1229" cy="671" r="7" />
                    {!calm ? (
                      <circle data-fade="" className="ch__orbit-node" r="4.5">
                        <animateMotion dur="30s" repeatCount="indefinite">
                          <mpath href="#ch-orbit-main" />
                        </animateMotion>
                      </circle>
                    ) : null}
                  </g>
                  <g transform="rotate(14 820 560)">
                    <path data-draw="" pathLength={1} d="M425 509A420 150 0 1 1 676 701" />
                  </g>
                  <path data-draw="" pathLength={1} className="is-journey" d="M-60 790C260 680 500 400 820 322S1380 250 1680 96" />
                  <circle data-fade="" className="ch__orbit-node" cx="274" cy="648" r="5" />
                  <path data-fade="" pathLength={1} className="is-dotted" d="M687 331A120 120 0 0 1 904 312" />
                </g>
              </svg>
            </div>

            <div className="ch__stage" role="img" aria-label="Three New Model High School students in uniform, standing together">
              {STUDENTS.map((s) => (
                <figure
                  key={s.id}
                  className={`ch__student ch__student--${s.id}`}
                  data-depth=""
                  data-mouse={s.mouse}
                  data-scroll={s.scroll}
                >
                  <img
                    src={s.src}
                    width={s.w}
                    height={s.h}
                    alt=""
                    decoding="async"
                    fetchPriority={s.id === 'girl' ? 'high' : 'auto'}
                    draggable={false}
                  />
                </figure>
              ))}
            </div>

            <div className="ch__orbit ch__orbit--front" data-depth="" data-mouse="-1" data-scroll="8" aria-hidden="true">
              <svg className="ch__orbit-svg" viewBox="0 0 1600 1000" focusable="false">
                <path data-draw="" pathLength={1} d="M470 640C620 704 1000 700 1150 560" />
              </svg>
            </div>

            <svg className="ch__accent" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
              <path d="M26 46c-6-3-12-6-19-8M33 37c-2-8-3-16-2-25M42 42c5-6 10-11 16-15" />
            </svg>
          </div>

          <ul className="ch__stats">
            {FIGURES.map((f) => (
              <li
                key={f.id}
                className={`ch__stat ch__stat--${f.id}`}
                data-depth=""
                data-mouse={f.mouse}
                data-scroll={f.scroll}
              >
                <div className="ch__stat-in">
                  <span className="sr-only">
                    {f.value}
                    {f.suffix} {f.label}
                  </span>
                  <div className="ch__stat-body" aria-hidden="true">
                    <span className="ch__stat-top">
                      <span className="ch__stat-icon">
                        <Icon name={f.icon} size={13} />
                      </span>
                      <span className="ch__stat-num">
                        <span className="ch__count">{f.value}</span>
                        {f.suffix ? <span className="ch__stat-suffix">{f.suffix}</span> : null}
                      </span>
                    </span>
                    <span className="ch__stat-line" />
                    <span className="ch__stat-label">{f.label}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="ch__note ch__note--think" data-depth="" data-mouse="7" data-scroll="-30" aria-hidden="true">
            <div className="ch__note-in">
              <span className="ch__note-text">Think bigger.</span>
              <svg className="ch__note-arrow" viewBox="0 0 90 60" focusable="false">
                <path pathLength={1} d="M84 6C62 10 40 24 26 48" />
                <path pathLength={1} d="M22 30l3 19 17-5" />
              </svg>
            </div>
          </div>

          <div className="ch__note ch__note--curiosity" data-depth="" data-mouse="6" data-scroll="-46" aria-hidden="true">
            <div className="ch__note-in">
              <span className="ch__note-text">Curiosity</span>
              <svg className="ch__note-arrow" viewBox="0 0 70 80" focusable="false">
                <path pathLength={1} d="M6 8c30 6 48 26 46 62" />
                <path pathLength={1} d="M40 56l12 13 9-15" />
              </svg>
            </div>
          </div>

          <a
            className="ch__campus"
            href="#campus"
            onClick={jump('#campus')}
            data-depth=""
            data-mouse="4"
            data-scroll="-54"
            data-cursor="View"
          >
            <span className="ch__campus-in">
              <span className="ch__campus-oval">
                <img
                  src={resolve(campusPhoto, 360)}
                  srcSet={resolveSet(campusPhoto, [240, 360, 520])}
                  sizes="(max-width: 759px) 22vw, 170px"
                  alt={campusPhoto.alt}
                  decoding="async"
                />
              </span>
              <span className="ch__campus-label">
                Our campus
                <Icon name="arrowRight" size={13} />
              </span>
            </span>
          </a>
        </div>

        {/* ------------------------------------------------------ navigation */}
        <div className="ch__progress" aria-hidden="true">
          <span className="ch__progress-track">
            <i />
          </span>
          <ol>
            {STEPS.map((step, i) => (
              <li key={step} className={i === 0 ? 'is-active' : undefined}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <em>{step}</em>
              </li>
            ))}
          </ol>
        </div>

        <div className="ch__foot">
          <Link className="btn btn-primary ch__cta" to={ROUTES.admissions}>
            <span className="btn__label">
              Start an admission
              <span className="ch__cta-arrow">
                <Icon name="arrowRight" size={17} />
              </span>
            </span>
          </Link>
          <Link className="link ch__more" to={ROUTES.about}>
            Explore the school
            <Icon name="arrowRight" size={15} />
          </Link>
        </div>

        <a className="ch__cue" href="#why" onClick={jump('#why')}>
          Discover more
          <i aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
