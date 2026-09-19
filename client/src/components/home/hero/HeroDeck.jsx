import { useCallback, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { ImagineHero } from './ImagineHero';
import { OrbitHero } from './OrbitHero';
import './hero-deck.css';

/* ==========================================================================
   THE HOMEPAGE HERO - two chapters and a switch between them
   --------------------------------------------------------------------------
     01  ImagineHero   the primary: photographs inside the word "imagine"
     02  OrbitHero     the original centred orbit, untouched

   ONE HERO IS MOUNTED AT A TIME.

   Each hero owns its whole entrance, its parallax and its teardown, and both
   already clean up after themselves. So a switch is: play the outgoing
   hero's exit from here, unmount it, mount the other - which then plays its
   own entrance. Nothing in either hero had to learn that the other exists,
   and OrbitHero is imported exactly as it was.

   The exit is written here rather than inside each hero because it is a
   property of the deck: type lifts away first, pictures close behind it,
   drawn lines un-draw. The selectors below are the only thing the deck knows
   about each hero's markup.

   While the chapters change, the deck holds its height, so the sections
   below never jump.
   ========================================================================== */

const HEROES = [
  { id: 1, label: 'Imagine', Component: ImagineHero },
  { id: 2, label: 'Orbit', Component: OrbitHero },
];

/** What leaves first, what closes after it, and what un-draws. */
const EXIT = {
  1: {
    type: '.ih__title .ih__line, .ih__lead, .ih__actions > *, .ih__brand, .ih__scroll, .ih__school, .ih__hop',
    word: '.ih__l',
    media: '.ih__l-photo',
    lines: '.ih__figure [data-draw]',
  },
  2: {
    type: '.oh__badge, .oh__line > span, .oh__cta',
    word: '.oh__spark, .oh__chip-art',
    media: '.oh__kids',
    lines: '.oh__ring',
  },
};

export function HeroDeck() {
  const [active, setActive] = useState(1);
  const [mode, setMode] = useState('load');
  const deckRef = useRef(null);
  const busy = useRef(false);
  const tabs = useRef([]);

  const go = useCallback(
    (next) => {
      const deck = deckRef.current;
      if (!deck || busy.current || next === active) return;
      busy.current = true;

      // Hold the page still while one chapter leaves and the next arrives.
      deck.style.minHeight = `${deck.offsetHeight}px`;
      const settle = () => {
        setMode('switch');
        setActive(next);
        window.setTimeout(() => {
          deck.style.minHeight = '';
          busy.current = false;
        }, 900);
      };

      const panel = deck.querySelector('.hero-deck__panel');
      if (!panel) {
        settle();
        return;
      }
      // Reduced motion: a plain fade out, and the next hero fades itself in.
      if (reduced()) {
        gsap.to(panel, { autoAlpha: 0, duration: 0.25, ease: 'power1.out', onComplete: settle });
        return;
      }

      // Going forward the old chapter lifts away; going back it drops.
      const dir = next > active ? -1 : 1;
      const sel = EXIT[active];
      const q = (s) => panel.querySelectorAll(s);

      gsap
        .timeline({ defaults: { ease: 'power2.in' }, onComplete: settle })
        .to(q(sel.type), { y: 22 * dir, autoAlpha: 0, duration: 0.42, stagger: 0.025 }, 0)
        .to(q(sel.word), { yPercent: 18 * dir, autoAlpha: 0, duration: 0.45, stagger: 0.03 }, 0.05)
        .to(q(sel.media), { clipPath: 'inset(0% 0% 0% 100%)', duration: 0.55, ease: 'power3.inOut' }, 0.08)
        .to(q(sel.lines), active === 1 ? { strokeDashoffset: 1, duration: 0.45 } : { scale: 0.94, autoAlpha: 0, duration: 0.5 }, 0)
        .to(panel, { autoAlpha: 0, duration: 0.2, ease: 'power1.in' }, 0.5);
    },
    [active],
  );

  const onKey = (e, index) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (e.key === 'Home' || e.key === 'End' || step) {
      e.preventDefault();
      const to = e.key === 'Home' ? 0 : e.key === 'End' ? HEROES.length - 1 : (index + step + HEROES.length) % HEROES.length;
      tabs.current[to]?.focus();
      go(HEROES[to].id);
    }
  };

  const Current = HEROES.find((h) => h.id === active).Component;

  return (
    <div ref={deckRef} className="hero-deck" data-active={active}>
      <div
        className="hero-deck__panel"
        id="hero-deck-panel"
        role="tabpanel"
        aria-label={`Hero ${String(active).padStart(2, '0')}`}
        key={active}
      >
        <Current mode={mode} />
      </div>

      <nav className="hero-deck__switch" aria-label="Choose a hero">
        <div role="tablist" aria-orientation="vertical" className="hero-deck__list">
          {HEROES.map((hero, i) => {
            const on = hero.id === active;
            return (
              <button
                key={hero.id}
                ref={(node) => (tabs.current[i] = node)}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="hero-deck-panel"
                aria-label={`Hero ${hero.id}: ${hero.label}`}
                tabIndex={on ? 0 : -1}
                className={`hero-deck__tab${on ? ' is-on' : ''}`}
                onClick={() => go(hero.id)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <span className="hero-deck__dot" aria-hidden="true" />
                <span className="hero-deck__name">{hero.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
