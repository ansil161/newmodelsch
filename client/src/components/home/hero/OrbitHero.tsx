import { useEffect, useState, type CSSProperties } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { NAV_LINKS, ROUTES, SCHOOL } from '@/constants';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { onStage, stageOpen } from '@/lib/stage';
import { Icon } from '@/components/common/Icon';
import { Logo } from '@/components/common/Logo';
import { OPEN_MENU } from '@/components/layout/menu-channel';
import './orbit-hero.css';

/* ==========================================================================
   01 - HERO, AS A CENTRED ORBIT
   --------------------------------------------------------------------------
   One white sheet, everything on the centre line, and two concentric hairline
   rings drawn round it.

     THE COMPOSITION, TOP TO BOTTOM
       a compact masthead          logo, links, one dark button
       a badge                     the one piece of news
       the claim, two lines        the only large type on the page
       one button                  the only thing to do
       two students                the focal point, cut out, bleeding off the foot

   THE RINGS ARE THE STRUCTURE, NOT DECORATION

   Both circles share a centre that sits just under the masthead - 2.2% down
   the hero, dead centre horizontally - so the arcs enter through the upper
   corners, bow outward past the type and close behind the students. The outer
   radius is 82% of the hero's height, capped at 46vw so a wide, short window
   never pushes the arcs off the sides. The inner ring is three quarters of it.

   Every geometric value is a custom property on `.oh`, so the whole
   composition is re-proportioned from one place. See `orbit-hero.css`.

   THE ICONS RIDE THE RINGS

   They do not bob in place: each chip is pinned to its ring at an authored
   angle and the ring itself turns - outer clockwise, inner anticlockwise,
   both a little over half a minute per revolution. Two nested wrappers undo
   the ring's rotation and the chip's own angle, so the square stays upright
   the whole way round while a third adds the small bob. Four elements, each
   doing exactly one transform, which is what keeps them off the main thread.

   ENTRANCE (held behind the brand intro by the stage gate)

     0.00  masthead down        0.10  badge up
     0.18  the claim, line by line
     0.30  rings open           0.45  students rise
     0.65  chips pop, scattered

   Reduced motion: no rings turning, no bob, no parallax. One fade, done.
   ========================================================================== */

/** Where the students stand. Both are transparent cut-outs on the white. */
const KIDS = [
  {
    id: 'boy',
    src: '/images/home/hero/student-blue.webp',
    w: 770,
    h: 888,
    alt: 'A New Model High School student in the school shirt',
    priority: true,
  },
  {
    id: 'girl',
    src: '/images/home/hero/student-girl.webp',
    w: 632,
    h: 851,
    alt: 'A New Model High School student in the school pinafore',
    priority: false,
  },
] as const;

interface Chip {
  icon: string;
  tone: 'blue' | 'violet' | 'pink' | 'green' | 'amber' | 'sky';
  ring: 'outer' | 'inner';
  /** Degrees clockwise from twelve o'clock, before the ring starts turning. */
  angle: number;
  /** Dropped below 900px so the composition never crowds. */
  wide?: true;
}

/* THE ANGLES ARE A SPACING PROBLEM, NOT A PLACEMENT ONE.

   Only the half of each ring between roughly 90 and 270 degrees is ever on
   screen: the centre sits at the hero's top edge, so anything near twelve
   o'clock is above it. That is the reference's behaviour too, and it is what
   makes the chips arrive and leave rather than circle forever.

   Because the ring turns, an authored angle is not a position - it is a
   PHASE, and the gap between two chips on the same ring is the only thing
   that never changes. So the three on each ring are spaced about 120 degrees
   apart. That guarantees no two of them are ever in the same part of the
   composition at once - in particular that two cannot sit on the students'
   heads together - while the two rings are offset from each other and turn at
   different speeds, so the pattern between them never repeats. The small
   irregularities (246 rather than 242) keep the trio off a perfect triangle,
   which would read as a loading spinner the moment all three were visible. */
const CHIPS: Chip[] = [
  { icon: 'book', tone: 'pink', ring: 'inner', angle: 122 },
  { icon: 'cap', tone: 'sky', ring: 'inner', angle: 246 },
  { icon: 'sparkle', tone: 'blue', ring: 'inner', angle: 352, wide: true },
  { icon: 'globe', tone: 'amber', ring: 'outer', angle: 100, wide: true },
  { icon: 'palette', tone: 'violet', ring: 'outer', angle: 212 },
  { icon: 'flask', tone: 'green', ring: 'outer', angle: 330, wide: true },
];

export function OrbitHero() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  /* The compact masthead borrows the site menu rather than shipping a second
     one: below 900px its button opens the real panel in `Navbar`, which
     already owns the focus trap, the scroll lock and the escape key. */
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const scope = useGsapScope<HTMLElement>((_, el) => {
    const q = gsap.utils.selector(el);

    if (reduced()) {
      el.classList.remove('is-pending');
      const fade = gsap.from(el.querySelector('.oh__in'), {
        autoAlpha: 0,
        duration: 0.6,
        ease: 'power1.out',
        paused: true,
      });
      const release = onStage(() => fade.play());
      return () => {
        release();
        fade.kill();
      };
    }

    /* ---------------------------------------------------------------- entrance */
    const tl = gsap.timeline({ paused: !stageOpen(), defaults: { ease: 'ease-out-quint' } });

    tl.from(q('.oh__bar'), { y: -14, autoAlpha: 0, duration: 0.8 }, 0)
      .from(q('.oh__badge'), { y: 14, autoAlpha: 0, duration: 0.8 }, 0.1)
      .from(q('.oh__line > span'), { yPercent: 108, duration: 1.05, stagger: 0.09 }, 0.18)
      .from(q('.oh__cta'), { y: 14, autoAlpha: 0, duration: 0.8 }, 0.34)
      .from(q('.oh__ring'), { scale: 0.93, autoAlpha: 0, duration: 1.5, stagger: 0.12 }, 0.3)
      .from(q('.oh__spark'), { scale: 0, autoAlpha: 0, duration: 0.8, ease: 'back.out(2)' }, 0.55)
      // The one behind comes up first, so the pair assembles front-last.
      .from(
        q('.oh__kid--girl img, .oh__kid--boy img'),
        { yPercent: 9, autoAlpha: 0, duration: 1.25, stagger: 0.12 },
        0.45,
      )
      .from(
        q('.oh__chip-art'),
        {
          scale: 0,
          autoAlpha: 0,
          duration: 0.7,
          ease: 'back.out(2)',
          stagger: { each: 0.07, from: 'random' },
        },
        0.65,
      );

    el.classList.remove('is-pending');
    const release = onStage(() => tl.play());

    /* ------------------------------------------------------------- parallax */
    // The rings drift up a little slower than the page, the students a little
    // faster. Scrubbed rather than looped: it is depth, not movement.
    const drift = gsap.timeline({
      scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: 0.6 },
    });
    drift
      .to(q('.oh__orbit'), { yPercent: -4, ease: 'none' }, 0)
      .to(q('.oh__kids'), { yPercent: 5, ease: 'none' }, 0);

    return () => {
      release();
      tl.kill();
      drift.scrollTrigger?.kill();
      drift.kill();
    };
  }, []);

  const rings = (['outer', 'inner'] as const).map((ring) => (
    <div key={ring} className={`oh__ring oh__ring--${ring}`}>
      <div className="oh__spin">
        {CHIPS.filter((c) => c.ring === ring).map((c) => (
          <span
            key={c.icon}
            className={`oh__chip is-${c.tone}`}
            data-wide={c.wide ? '' : undefined}
            style={{ '--a': `${c.angle}deg` } as CSSProperties}
          >
            <span className="oh__chip-unrot">
              <span className="oh__chip-unspin">
                <span className="oh__chip-art">
                  <Icon name={c.icon} size={20} />
                </span>
              </span>
            </span>
          </span>
        ))}
      </div>
    </div>
  ));

  return (
    <section ref={scope} className="oh is-pending" aria-labelledby="oh-title">
      {/* ---------------------------------------------------------- backdrop */}
      <div className="oh__orbit" aria-hidden="true">
        {rings}
        <span className="oh__spark">
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M12 1.6v20.8M2.4 12h19.2M5.2 5.2l13.6 13.6M18.8 5.2 5.2 18.8" />
          </svg>
        </span>
      </div>

      <div className="oh__in">
        {/* -------------------------------------------------------- masthead */}
        <header className="oh__bar">
          <Link className="oh__brand" to={ROUTES.home} aria-label={SCHOOL.name + ', home'}>
            <Logo className="oh__logo" decorative priority />
          </Link>

          <nav className="oh__nav" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                end={link.href === ROUTES.home}
                className={({ isActive }) => 'oh__nav-link' + (isActive ? ' is-current' : '')}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="oh__bar-end">
            <Link className="oh__enroll" to={ROUTES.admissions + '#enquiry'}>
              <span>Enroll Now</span>
              <Icon name="arrowUpRight" size={15} />
            </Link>

            <button
              type="button"
              className="oh__menu"
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen(true);
                window.dispatchEvent(new CustomEvent(OPEN_MENU));
              }}
            >
              <span className="oh__menu-bars" aria-hidden="true">
                <i />
                <i />
              </span>
              <span className="sr-only">Open menu</span>
            </button>
          </div>
        </header>

        {/* ----------------------------------------------------------- claim */}
        <div className="oh__type">
          <p className="oh__badge">
            <span className="oh__badge-dot" aria-hidden="true">
              <Icon name="sparkle" size={12} />
            </span>
            Admissions open for {SCHOOL.session}
          </p>

          <h1 className="oh__title" id="oh-title">
            <span className="oh__line">
              <span>Building minds</span>
            </span>
            <span className="oh__line">
              <span>that move the world.</span>
            </span>
          </h1>

          <Link className="oh__cta" to={ROUTES.admissions}>
            Enroll Now
            <Icon name="arrowUpRight" size={16} />
          </Link>
        </div>
      </div>

      {/* --------------------------------------------------------- students */}
      <div className="oh__kids">
        {KIDS.map((k) => (
          <figure key={k.id} className={'oh__kid oh__kid--' + k.id}>
            <img
              src={k.src}
              width={k.w}
              height={k.h}
              alt={k.alt}
              decoding="async"
              fetchPriority={k.priority ? 'high' : 'auto'}
              draggable={false}
            />
          </figure>
        ))}
      </div>
    </section>
  );
}
