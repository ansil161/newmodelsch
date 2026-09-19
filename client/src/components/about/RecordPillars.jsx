import { useNavigate } from 'react-router-dom';
import { RECORD, ROUTES } from '@/constants';
import { resolve, resolveSet } from '@/constants/imagery';
import { gsap, ScrollTrigger, SplitText } from '@/lib/gsap';
import { useGsapScope } from '@/hooks/useGsapScope';
import { playOnScroll, reduced } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import './record-pillars.css';

/* ==========================================================================
   THE RECORD - five pillars, one sentence
   --------------------------------------------------------------------------
   Five tall photographs stand side by side and rise from left to right, so
   the section reads as a single built thing - history, students, teachers,
   results, the future - rather than as five statistics that happen to share
   a row. Each figure is set into the sky of its own photograph instead of
   into a card.

   HOW IT IS LAID OUT

   Desktop is one grid of five columns and two rows. The head sits over the
   first three columns in row one; pillars 1-3 stand in row two, and 4-5 span
   both rows. Heights are percentages of their own grid area, so the steps
   stay proportioned to whatever the head needs rather than to a guessed
   pixel height, and the headline can never collide with a pillar.

   Tablet moves the head above all five. Phones turn the row into a column
   of full-width blocks that widen as they go down - the same ascent, turned
   ninety degrees.

   MOTION (all of it skipped under reduced motion)

   Desktop plays one timeline: the pale structure behind, the eyebrow, the
   headline line by line, the lead, then each pillar wiped up from its base
   followed by its label, its figure counting, and its note. Phones run the
   head as one beat and give each pillar its own trigger, because on a phone
   the fifth pillar is four screens below the first.

   Layers per pillar, so no two animations fight over one transform:
     .pillar        scroll parallax (y)             GSAP
     .pillar__frame the wipe (clip-path)            GSAP
     .pillar__media pointer parallax (x, y)         GSAP
     .pillar__zoom  hover scale                     CSS
     img            the settle after the wipe       GSAP
     .pillar__copy  hover lift                      CSS; its children GSAP
   ========================================================================== */

const { eyebrow, titleLines, lead, link, pillars } = RECORD;

/** Pointer parallax travel per pillar, in px - deeper to the right. */
const DEPTH = [4, 5, 7, 9, 11];
/** Total scroll-parallax travel per pillar, in px - reinforces the ascent. */
const LIFT = [6, 12, 18, 26, 34];

function Figure({ pillar }) {
  if (pillar.statement) {
    return (
      <p className="pillar__statement">
        {pillar.statement.text} <em>{pillar.statement.em}</em>
      </p>
    );
  }
  return (
    <p className="pillar__value">
      <span data-value={pillar.value} data-from={pillar.from ?? undefined}>
        {pillar.value}
      </span>
    </p>
  );
}

/** Counts a figure up to its authored text inside a timeline. */
function countInto(tl, el, at) {
  const final = el.dataset.value;
  const from = parseFloat(el.dataset.from);
  const match = final.match(/[\d,]+/);
  if (!match || !Number.isFinite(from)) return;

  const target = parseFloat(match[0].replace(/,/g, ''));
  const grouped = match[0].includes(',');
  const prefix = final.slice(0, match.index);
  const suffix = final.slice(match.index + match[0].length);
  const box = { n: from };
  const write = () => {
    const n = Math.round(box.n).toString();
    el.textContent = prefix + (grouped ? n.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : n) + suffix;
  };

  tl.to(
    box,
    {
      n: target,
      duration: 2.2,
      ease: 'power2.out',
      onStart: write,
      onUpdate: write,
      onComplete: () => {
        el.textContent = final;
      },
    },
    at,
  );
  // Until the count starts, show where it starts rather than the answer.
  write();
}

/** One pillar's arrival: the wipe, the settle, then label, figure, note. */
function buildPillar(tl, pillar, at) {
  const frame = pillar.querySelector('.pillar__frame');
  const img = pillar.querySelector('img');
  const [label, figure, note] = pillar.querySelectorAll('.pillar__copy > *');

  tl.fromTo(
    frame,
    { clipPath: 'inset(100% 0% 0% 0%)' },
    { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.35, ease: 'power4.inOut' },
    at,
  );
  tl.from(img, { scale: 1.14, duration: 1.9, ease: 'power3.out' }, at);
  tl.from(label, { y: 12, opacity: 0, duration: 0.8, ease: 'power3.out' }, at + 0.75);
  tl.from(figure, { yPercent: 40, opacity: 0, duration: 1.1, ease: 'power3.out' }, at + 0.85);
  tl.from(note, { y: 10, opacity: 0, duration: 0.8, ease: 'power3.out' }, at + 1.1);

  const num = figure?.querySelector('[data-value]');
  if (num) countInto(tl, num, at + 0.85);
}

export function AboutRecord() {
  const { scrollTo } = useSmoothScroll();
  const navigate = useNavigate();

  const scope = useGsapScope((_, el) => {
    const nums = el.querySelectorAll('[data-value]');
    // A pass torn down mid-count (StrictMode, HMR) must not leave a partial
    // figure behind for the next pass, or for a reader with motion off.
    const restore = () => nums.forEach((n) => (n.textContent = n.dataset.value));
    restore();
    if (reduced()) return restore;

    const shapes = el.querySelectorAll('.record__shape');
    const head = el.querySelector('.record__title');
    const cols = gsap.utils.toArray(el.querySelectorAll('.pillar'));
    /* The heading's lines are re-split whenever its width changes - a turned
       tablet, a resized window, a late font - so the reveal never plays, and
       the finished heading never keeps, line breaks measured for another
       width. The reveal is a tween the split owns; the timeline below only
       says when it starts. Once it has played, a re-split lands finished. */
    let revealed = false;
    let reveal;
    const split = SplitText.create(head, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'record__line',
      autoSplit: true,
      onSplit: (self) => {
        reveal = gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.2,
          ease: 'power4.out',
          stagger: 0.14,
          paused: true,
        });
        if (revealed) reveal.progress(1);
        return reveal;
      },
    });
    const mm = gsap.matchMedia();

    const headBeats = (tl, at = 0) => {
      tl.from(shapes, { opacity: 0, y: 40, scale: 0.97, duration: 1.8, ease: 'power2.out', stagger: 0.2 }, at);
      tl.from('.record__eyebrow-rule', { scaleX: 0, transformOrigin: 'left center', duration: 1, ease: 'power3.inOut' }, at + 0.35);
      tl.from('.record__eyebrow-text', { y: 10, opacity: 0, duration: 0.8 }, at + 0.45);
      tl.call(
        () => {
          revealed = true;
          reveal?.play();
        },
        undefined,
        at + 0.6,
      );
      tl.from('.record__lead', { y: 18, opacity: 0, duration: 0.9 }, at + 1.15);
      tl.from('.record__cta', { y: 14, opacity: 0, duration: 0.9 }, at + 1.3);
    };

    /* ---------------------------------------------------- tablet & desktop */
    mm.add('(min-width: 720px)', () => {
      const tl = gsap.timeline();
      headBeats(tl);
      cols.forEach((col, i) => buildPillar(tl, col, 1.45 + i * 0.26));
      playOnScroll(tl, { trigger: el, start: 'top 72%' });

      // Scroll parallax: each pillar a little faster than the one before.
      cols.forEach((col, i) => {
        gsap.fromTo(
          col,
          { y: LIFT[i] / 2 },
          {
            y: -LIFT[i] / 2,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1.2 },
          },
        );
      });

      // The structure behind moves against the pillars, a few px at most.
      gsap.fromTo(
        shapes,
        { y: -14 },
        {
          y: 14,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1.5 },
        },
      );
    });

    /* ------------------------------------------ pointer parallax, fine only */
    mm.add('(min-width: 1024px) and (hover: hover) and (pointer: fine)', () => {
      const stage = el.querySelector('.record__stage');
      const movers = cols.map((col, i) => {
        const media = col.querySelector('.pillar__media');
        return {
          x: gsap.quickTo(media, 'x', { duration: 1.4, ease: 'power3.out' }),
          y: gsap.quickTo(media, 'y', { duration: 1.4, ease: 'power3.out' }),
          d: DEPTH[i],
        };
      });
      const onMove = (e) => {
        const r = stage.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        movers.forEach((m) => {
          m.x(nx * m.d * 2);
          m.y(ny * m.d * 1.4);
        });
      };
      const onLeave = () => movers.forEach((m) => (m.x(0), m.y(0)));
      stage.addEventListener('pointermove', onMove);
      stage.addEventListener('pointerleave', onLeave);
      return () => {
        stage.removeEventListener('pointermove', onMove);
        stage.removeEventListener('pointerleave', onLeave);
      };
    });

    /* --------------------------------------------------------------- phone */
    mm.add('(max-width: 719.98px)', () => {
      const tl = gsap.timeline();
      headBeats(tl);
      playOnScroll(tl, { trigger: el, start: 'top 78%' });

      cols.forEach((col, i) => {
        const own = gsap.timeline();
        buildPillar(own, col, 0);
        playOnScroll(own, { trigger: col, start: 'top 85%' });

        // The same depth as the wide parallax, scaled to a stacked column:
        // each photograph drifts a fraction of its desktop lift inside its
        // own frame, so the pillars still read as layered, not as a list.
        const media = col.querySelector('.pillar__media');
        if (media) {
          gsap.fromTo(
            media,
            { y: LIFT[i] / 3 },
            {
              y: -LIFT[i] / 3,
              ease: 'none',
              scrollTrigger: { trigger: col, start: 'top bottom', end: 'bottom top', scrub: 1 },
            },
          );
        }
      });
    });

    // The grid settles once the split has changed line boxes.
    ScrollTrigger.refresh();

    return () => {
      mm.revert();
      split.revert();
      restore();
    };
  }, []);

  return (
    <section ref={scope} className="section record" id="record" aria-labelledby="record-title">
      <div className="record__ground" aria-hidden="true">
        {/* Three soft structural forms: a long rising sweep that follows the
            pillar tops, a tall arch behind the last two, and a low plinth. */}
        <svg className="record__shape record__shape--sweep" viewBox="0 0 1200 600" preserveAspectRatio="none">
          <path d="M0 600 C 260 560 520 470 760 300 C 900 200 1040 110 1200 60 L1200 600 Z" />
        </svg>
        <svg className="record__shape record__shape--arch" viewBox="0 0 400 800" preserveAspectRatio="none">
          <path d="M0 800 V 200 A 200 200 0 0 1 400 200 V 800 Z" />
        </svg>
        <span className="record__shape record__shape--plinth" />
      </div>

      <div className="wrap">
        <div className="record__stage">
          <header className="record__head">
            <p className="record__eyebrow">
              <span className="record__eyebrow-text">{eyebrow}</span>
              <span className="record__eyebrow-rule" aria-hidden="true" />
            </p>

            <h2 className="record__title" id="record-title">
              {titleLines.map((line, i) => (
                <span className="record__title-line" key={i}>
                  {line.text}
                  {line.em ? <em>{line.em}</em> : null}
                </span>
              ))}
            </h2>

            <p className="record__lead">{lead}</p>

            <a
              className="record__cta"
              href={link.hash}
              onClick={(e) => {
                e.preventDefault();
                // On the About page the story is on the same page; anywhere
                // else (the home page) the button takes the reader there.
                if (document.querySelector(link.hash)) scrollTo(link.hash, -80);
                else navigate(`${ROUTES.about}${link.hash}`);
              }}
            >
              <span className="record__cta-ring" aria-hidden="true">
                <Icon name="arrowRight" size={16} />
              </span>
              <span className="record__cta-label">{link.label}</span>
            </a>
          </header>

          <ol className="record__pillars" aria-label="The school, from 1962 to its vision">
            {pillars.map((pillar, i) => (
              <li className={`pillar pillar--${i + 1}`} key={pillar.label}>
                <div className="pillar__frame">
                  <div className="pillar__media">
                    <div className="pillar__zoom">
                      <img
                        src={resolve(pillar.photo, 720)}
                        srcSet={resolveSet(pillar.photo, [360, 540, 720, 1080]) || undefined}
                        sizes="(max-width: 719px) 92vw, (max-width: 1023px) 20vw, 18vw"
                        alt={pillar.photo.alt}
                        loading="lazy"
                        decoding="async"
                        style={{ objectPosition: pillar.photo.focus }}
                      />
                    </div>
                  </div>
                  <span className="pillar__veil" aria-hidden="true" />

                  <div className="pillar__copy">
                    <p className="pillar__label">{pillar.label}</p>
                    <Figure pillar={pillar} />
                    <p className="pillar__note">{pillar.note}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
