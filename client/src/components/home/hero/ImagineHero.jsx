import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES, SCHOOL } from '@/constants';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap, SplitText } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { onStage, stageOpen } from '@/lib/stage';
import { Icon } from '@/components/common/Icon';
import './imagine-hero.css';

/* ==========================================================================
   HERO 01 - "imagine"
   --------------------------------------------------------------------------
   One oversized word, and the school's own photographs living inside its
   letters, centred across the page. Under it the claim in an editorial serif
   on one side, the sentence and two actions on the other, and along the foot
   the school's name, its colour travelling slowly from white into blue.

   HOW THE PHOTOGRAPHS GET INSIDE THE LETTERS

   Each letter is two copies of the same glyph stacked exactly on top of each
   other. The lower one is solid pale blue - the letter before its picture
   arrives. The upper one carries the photograph as its background, clipped
   to the glyph with `background-clip: text`, so the picture is cut by the
   real letterform the browser lays out: no measured SVG geometry to drift
   from the font, no rectangular edges, and it reflows with the type.

   The photograph is sized to COVER its letter with a little slack (see
   `fit`), which is what lets it drift inside the glyph on hover and under
   the pointer without an edge ever showing.

   ENTRANCE (held behind the brand intro by the stage gate)

     0.10  letters rise, pale           0.55  photographs fill each letter
     1.20  the claim, line by line      1.55  the sentence, then the actions
     1.90  the school's name            2.95  the hand-drawn details,
                                              the small print, the scroll cue
     3.40  a small student starts hopping along the name, letter to letter

   `mode="switch"` is the same score played faster, for when the reader
   arrives here from Hero 02 rather than from a page load.

   Reduced motion: one fade, no drift, no pointer movement.
   ========================================================================== */

const IMG = '/images/home/imagine';
const REC = '/images/about/record';

/* One photograph per letter. `a` is the photograph's width / height, which
   `fit` needs to cover a letter without loading the file first; `at` is the
   crop; `z` enlarges it past a plain cover.

   The m, a and g are x-height letters: the glyph fills only the lower two
   thirds of its box. A portrait's face sits in its upper third, so at a
   plain cover the face lands above the ink. `z` enlarges those three until
   the face drops into the bowl of the letter. */
const LETTERS = [
  { ch: 'i', src: `${REC}/flag.webp`, a: 725 / 2168, at: [50, 34] },
  { ch: 'm', src: `${IMG}/student-girl.webp`, a: 900 / 1125, at: [54, 6], z: 1.5 },
  { ch: 'a', src: `${IMG}/student-boy.webp`, a: 900 / 1125, at: [50, 8], z: 1.55 },
  { ch: 'g', src: `${IMG}/student-blazer.webp`, a: 900 / 1117, at: [52, 8], z: 1.35, figure: true },
  { ch: 'i', src: `${REC}/students-walking.webp`, a: 900 / 1599, at: [72, 74] },
  { ch: 'n', src: `${REC}/campus-flag.webp`, a: 1600 / 901, at: [30, 58] },
  { ch: 'e', src: `${REC}/campus-building.webp`, a: 900 / 1598, at: [40, 52] },
];

const BRAND_LINES = ['Learning', 'Today', 'Leading', 'Tomorrow'];

/** Seconds for one hop from a letter to the next. */
const HOP = 0.46;

/**
 * The student on the school's name: hops from each letter to the next, and
 * each letter gives a little under the landing. Out to the end of the name,
 * then turns round and hops back. Built from measured letter positions, so it
 * is rebuilt whenever the name reflows.
 */
function hopAlong(name) {
  const hopper = name.querySelector('.ih__hop');
  const letters = [...name.querySelectorAll('.ih__sl')].filter((l) => l.textContent.trim());
  if (!hopper || letters.length < 2) return gsap.timeline();

  const size = parseFloat(getComputedStyle(name).fontSize);
  const lift = size * 0.55;
  const xs = letters.map((l) => l.offsetLeft + l.offsetWidth / 2 - hopper.offsetWidth / 2);
  // Out from the first letter to the last, then back to the first.
  const path = [...letters.keys()].slice(1).concat([...letters.keys()].reverse().slice(1));

  gsap.set(hopper, { x: xs[0], y: 0, scaleX: 1 });
  const tl = gsap.timeline({ repeat: -1 });
  path.forEach((to, n) => {
    const from = n === 0 ? 0 : path[n - 1];
    const at = n * HOP;
    tl.set(hopper, { scaleX: xs[to] < xs[from] ? -1 : 1 }, at)
      .to(hopper, { x: xs[to], duration: HOP, ease: 'none' }, at)
      .to(hopper, { y: -lift, duration: HOP / 2, ease: 'power2.out' }, at)
      .to(hopper, { y: 0, duration: HOP / 2, ease: 'power2.in' }, at + HOP / 2)
      .to(letters[to], { y: size * 0.07, duration: 0.1, ease: 'power2.out', yoyo: true, repeat: 1 }, at + HOP);
  });
  return tl;
}

/** Slack over an exact cover, so the picture can move inside the glyph. */
const SLACK = 1.18;

/** Size each letter's photograph to cover its box, whichever axis binds. */
function fit(photos) {
  photos.forEach((el) => {
    const a = parseFloat(el.dataset.a);
    const z = SLACK * (parseFloat(el.dataset.z) || 1);
    const { offsetWidth: w, offsetHeight: h } = el;
    if (!w || !h || !a) return;
    el.style.backgroundSize = w / h > a ? `${z * 100}% auto` : `auto ${z * 100}%`;
  });
}

export function ImagineHero({ mode = 'load' }) {
  const wordRef = useRef(null);

  const scope = useGsapScope((_, el) => {
    const q = gsap.utils.selector(el);
    const photos = q('.ih__l-photo');

    fit(photos);
    const ro = new ResizeObserver(() => fit(photos));
    if (wordRef.current) ro.observe(wordRef.current);

    const name = q('.ih__school-text')[0];

    if (reduced()) {
      const fade = gsap.from(q('.ih__in'), { autoAlpha: 0, duration: 0.6, ease: 'power1.out', paused: true });
      const release = onStage(() => fade.play());
      return () => {
        release();
        fade.kill();
        ro.disconnect();
      };
    }

    const split = new SplitText(q('.ih__title')[0], { type: 'lines', mask: 'lines', linesClass: 'ih__line' });
    const draw = q('[data-draw]');
    gsap.set(draw, { strokeDasharray: 1, strokeDashoffset: 1 });

    /* ---------------------------------------------------------------- entrance */
    const tl = gsap.timeline({
      paused: mode === 'load' && !stageOpen(),
      defaults: { ease: 'ease-out-quint' },
    });

    tl.from(q('.ih__l'), { yPercent: 34, autoAlpha: 0, duration: 1.1, stagger: 0.06 }, 0.1)
      .fromTo(
        photos,
        { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power3.inOut', stagger: 0.09 },
        0.55,
      )
      // Each picture settles upward into its crop as its letter fills.
      .from(
        photos,
        {
          backgroundPosition: (_, t) => {
            const [x, y] = t.dataset.at.split(',').map(Number);
            return `${x}% ${Math.min(y + 16, 100)}%`;
          },
          duration: 1.8,
          ease: 'power3.out',
          stagger: 0.09,
        },
        0.55,
      )
      .from(split.lines, { yPercent: 110, duration: 1.15, stagger: 0.12 }, 1.2)
      .from(q('.ih__lead'), { y: 16, autoAlpha: 0, duration: 0.9 }, 1.55)
      .from(q('.ih__actions > *'), { y: 14, autoAlpha: 0, duration: 0.85, stagger: 0.1 }, 1.72)
      .from(q('.ih__school'), { y: 24, autoAlpha: 0, duration: 1.3 }, 1.9)
      .to(q('.ih__figure [data-draw]'), { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out', stagger: 0.08 }, 2.95)
      .from(q('.ih__ring'), { scale: 0, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.6)', stagger: 0.12 }, 3.05)
      .from(q('.ih__brand > *'), { y: 8, autoAlpha: 0, duration: 0.7, stagger: 0.07 }, 3.1)
      .from(q('.ih__scroll'), { y: 10, autoAlpha: 0, duration: 0.8 }, 3.25);

    if (mode === 'switch') tl.timeScale(2.4);

    /* ------------------------------------------ the student on the name */
    let hop = gsap.timeline({ paused: true });
    let hopping = false;
    const startHop = () => {
      hop.kill();
      hop = hopAlong(name);
      if (!hopping) hop.pause();
    };
    startHop();
    tl.from(q('.ih__hop'), { autoAlpha: 0, duration: 0.5 }, 3.3).call(
      () => {
        hopping = true;
        hop.play();
      },
      null,
      3.4,
    );
    const hopRo = new ResizeObserver(() => startHop());
    hopRo.observe(name);

    el.classList.remove('is-pending');
    const release = mode === 'load' ? onStage(() => tl.play()) : (tl.play(), () => {});

    /* -------------------------------------------------- hover inside a letter */
    const letters = q('.ih__l');
    const hovers = letters.map((letter) => {
      const photo = letter.querySelector('.ih__l-photo');
      const [x, y] = photo.dataset.at.split(',').map(Number);
      const enter = () =>
        gsap.to(photo, { backgroundPosition: `${x + 4}% ${Math.max(y - 8, 0)}%`, duration: 1.1, ease: 'power3.out', overwrite: 'auto' });
      const leave = () =>
        gsap.to(photo, { backgroundPosition: `${x}% ${y}%`, duration: 1.2, ease: 'power3.out', overwrite: 'auto' });
      letter.addEventListener('pointerenter', enter);
      letter.addEventListener('pointerleave', leave);
      return () => {
        letter.removeEventListener('pointerenter', enter);
        letter.removeEventListener('pointerleave', leave);
      };
    });

    /* ------------------------------------------- pointer depth, fine pointers */
    let offMove = () => {};
    if (window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)').matches) {
      const layers = q('[data-depth]').map((node) => ({
        x: gsap.quickTo(node, 'x', { duration: 1.6, ease: 'power3.out' }),
        y: gsap.quickTo(node, 'y', { duration: 1.6, ease: 'power3.out' }),
        d: parseFloat(node.dataset.depth),
      }));
      const onMove = (e) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        layers.forEach((l) => {
          l.x(nx * l.d);
          l.y(ny * l.d);
        });
      };
      el.addEventListener('pointermove', onMove);
      offMove = () => el.removeEventListener('pointermove', onMove);
    }

    /* ------------------------------------------------------------- parallax */
    const drift = gsap.timeline({
      scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: 0.6 },
    });
    drift.to(q('.ih__word'), { yPercent: -6, ease: 'none' }, 0);

    return () => {
      release();
      tl.kill();
      hop.kill();
      hopRo.disconnect();
      drift.scrollTrigger?.kill();
      drift.kill();
      hovers.forEach((off) => off());
      offMove();
      split.revert();
      ro.disconnect();
    };
  }, [mode]);

  return (
    <section ref={scope} className="ih is-pending" aria-labelledby="ih-title">
      <div className="ih__in">
        {/* ------------------------------------------------ the word */}
        <p className="ih__word" ref={wordRef} aria-label="imagine" data-depth="-6">
          {LETTERS.map((l, i) => (
            <span className={`ih__l ih__l--${l.ch}`} key={i} aria-hidden="true">
              <span className="ih__l-base">{l.ch}</span>
              <span
                className="ih__l-photo"
                data-a={l.a}
                data-at={l.at.join(',')}
                data-z={l.z}
                style={{
                  backgroundImage: `url(${l.src})`,
                  backgroundPosition: `${l.at[0]}% ${l.at[1]}%`,
                }}
              >
                {l.ch}
              </span>

              {/* A small figure standing on the g, arms up. */}
              {l.figure ? (
                <svg className="ih__figure" viewBox="0 0 40 52" data-depth="10">
                  <circle cx="20" cy="8" r="6" data-draw pathLength="1" />
                  <path d="M20 15 V34 M20 34 L12 50 M20 34 L28 50" data-draw pathLength="1" />
                  <path d="M20 21 L8 8 M20 21 L32 8" data-draw pathLength="1" />
                </svg>
              ) : null}
            </span>
          ))}
        </p>

        {/* ------------------------------------------------ the claim */}
        <div className="ih__copy">
          <h1 className="ih__title" id="ih-title">
            <span className="ih__tl">Where children play to learn,</span>{' '}
            <span className="ih__tl">
              and <em>learn to live.</em>
            </span>
          </h1>

          <div className="ih__side">
            <p className="ih__lead">
              At {SCHOOL.name}, we prepare children to flourish and bloom in tomorrow&rsquo;s world.
            </p>

            <div className="ih__actions">
              <Link className="ih__cta" to={`${ROUTES.about}#story`}>
                <span>Discover Our Story</span>
                <span className="ih__cta-arrow" aria-hidden="true">
                  <Icon name="arrowRight" size={16} />
                </span>
              </Link>

            </div>
          </div>
        </div>

        {/* ------------------------------------------------ the name */}
        <p className="ih__school">
          <span className="ih__school-text" aria-label={SCHOOL.name}>
            {[...SCHOOL.name].map((ch, i) => (
              <span className="ih__sl" key={i} aria-hidden="true">
                {ch === ' ' ? ' ' : ch}
              </span>
            ))}
            <span className="ih__hop" aria-hidden="true">
              <svg viewBox="0 0 40 52" focusable="false">
                <circle cx="20" cy="8" r="6" />
                <path d="M20 15 V34 M20 34 L12 50 M20 34 L28 50" />
                <path d="M20 21 L8 8 M20 21 L32 8" />
              </svg>
            </span>
          </span>
        </p>

        {/* ------------------------------------------------ small print */}
        <p className="ih__brand" aria-hidden="true">
          {BRAND_LINES.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>

        <span className="ih__ring ih__ring--a" aria-hidden="true" data-depth="14" />

        <div className="ih__scroll" aria-hidden="true">
          <span className="ih__scroll-track">
            <span className="ih__scroll-dot" />
          </span>
          <span className="ih__scroll-text">
            Scroll
            <br />
            to explore
          </span>
        </div>
      </div>
    </section>
  );
}
