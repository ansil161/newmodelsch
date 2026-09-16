import { VALUES } from '@/constants';
import { academicImages, resolve, resolveSet, sportsImages, studentImages } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { lines, rise } from '@/lib/motion';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import './charter-scroll.css';

/* ==========================================================================
   05 - THE CHARTER - one card, six principles, moved through by scrolling
   --------------------------------------------------------------------------
   The section pins. The heading holds the top of the left column and the
   card holds the right one, and neither moves again until the charter is
   finished. The reader's scroll is spent on what changes around them:

     STATE      a principle on the left - its number and label, its title,
                its argument and the two practices behind it - and its
                photograph in the card, with the figure that proves it.
     TRANSITION the words leave upward and blur; the next photograph rises
                into the card from its bottom edge and covers the last one,
                which settles back a few percent; the next segment of the
                progress bar fills as it rises; the step number rolls; the
                next words come up from below, title first; the figure is
                set last.

   ONE TIMELINE, SIX UNITS LONG.

   Principle k owns [k, k + 1). The first half of every unit is a hold, and
   the handover to the next principle runs through the second half - so the
   first principle is held before anything moves, and the last is held for a
   full unit before the pin lets go. Every position below is a fraction of
   that journey, never a number of seconds.

   THE RESTING STATE IS A LIST.

   Without `.is-live` - no JavaScript yet, or motion turned off - the six
   principles are an ordinary ruled list beside a card showing the first
   photograph. The module adds the class in the same tick it builds the
   timeline, so the stacked layout never exists without the motion that
   explains it.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Content
   --------------------------------------------------------------------------
   The words are VALUES, unchanged - the charter is a record and this section
   does not get to rewrite it. Only the photograph and the one-word label are
   chosen here, paired to the principle rather than mapped by index.
   -------------------------------------------------------------------------- */

const PHOTOS = [
  studentImages[1], // 01 known         - a child working with a teacher
  academicImages[0], // 02 rigour        - a problem worked through with seniors
  academicImages[2], // 03 curiosity     - a robot being assembled
  sportsImages[3], // 04 character       - a team, after the fixture
  academicImages[3], // 05 honesty       - the working, on the page
  studentImages[5], // 06 belonging      - Class 10, on the way out
];

const LABELS = {
  known: 'Pastoral care',
  rigour: 'Standards',
  curiosity: 'Making',
  character: 'Character',
  honesty: 'Reporting',
  belonging: 'Community',
};

const ENTRIES = VALUES.map((value, i) => ({
  ...value,
  photo: PHOTOS[i % PHOTOS.length],
  label: LABELS[value.id] ?? 'Principle',
}));

const COUNT = String(ENTRIES.length).padStart(2, '0');

/* --------------------------------------------------------------------------
   The beat of one handover, as offsets into the outgoing principle's unit
   -------------------------------------------------------------------------- */
const BEAT = {
  /** The words start to leave, and the photograph starts to rise. */
  leave: 0.45,
  leaveFor: 0.2,
  /** The photograph, the progress segment and the step number. */
  visualFor: 0.55,
  /** The next words arrive only once the last ones have gone - two blurred
      paragraphs on top of each other read as a rendering fault. */
  arrive: 0.72,
  arriveFor: 0.28,
  /** The figure in the card is set after its photograph has landed. */
  caption: 0.74,
  captionFor: 0.24,
};

/** Scroll per principle, in viewports. Six of them is 4.8 screens of story. */
const PER_STAGE = { wide: 0.8, narrow: 0.7 };

/* ==========================================================================
   Motion
   ========================================================================== */

function buildMotion(root) {
  const mm = gsap.matchMedia(root);

  mm.add(
    {
      motion: '(prefers-reduced-motion: no-preference)',
      narrow: '(max-width: 699px)',
    },
    (context) => {
      const { motion, narrow } = context.conditions;
      if (!motion) return;

      const stage = root.querySelector('.charter__stage');
      const steps = gsap.utils.toArray('.charter-step', root);
      const layers = gsap.utils.toArray('.charter-card__layer', root);
      const fills = gsap.utils.toArray('.charter-progress__fill', root);
      const numbers = gsap.utils.toArray('.charter-card__num-n', root);
      const n = ENTRIES.length;
      if (
        !stage ||
        steps.length !== n ||
        layers.length !== n ||
        fills.length !== n ||
        numbers.length !== n
      ) {
        return;
      }

      root.classList.add('is-live');

      const parts = (step) => step.querySelectorAll('[data-part]');
      const image = (layer) => layer.querySelector('.charter-card__img');
      const caption = (layer) =>
        layer.querySelector('.charter-card__caption');

      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: stage,
          start: 'top top',
          end: () =>
            `+=${Math.round(n * (narrow ? PER_STAGE.narrow : PER_STAGE.wide) * window.innerHeight)}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      /* EVERY ELEMENT'S FIRST TWEEN RENDERS IMMEDIATELY, AND NO OTHER DOES.

         A principle's arrival is the first thing that ever happens to it, so
         it is allowed to stamp its hidden state at build. Its departure comes
         later and must not - otherwise the first principle would be hidden
         before the reader had seen it. */
      const later = { immediateRender: false };

      for (let k = 0; k < n - 1; k += 1) {
        const next = k + 1;
        const leave = k + BEAT.leave;

        /* ---- the words leave: up, fading, very slightly blurred ---------- */
        tl.fromTo(
          parts(steps[k]),
          { y: 0, autoAlpha: 1, filter: 'blur(0px)' },
          {
            y: -24,
            autoAlpha: 0,
            filter: 'blur(6px)',
            duration: BEAT.leaveFor,
            stagger: 0.03,
            ease: 'power2.in',
            ...later,
          },
          leave,
        );

        /* ---- the next photograph rises into the card ---------------------
           The layer travels up from under the card's bottom edge while the
           photograph inside it travels a little the other way, so the image
           is revealed by the rising edge rather than pushed in on a tray. */
        tl.fromTo(layers[next], { yPercent: 100 }, { yPercent: 0, duration: BEAT.visualFor }, leave);

        const incoming = image(layers[next]);
        if (incoming) {
          tl.fromTo(
            incoming,
            { yPercent: -40, scale: 1.03 },
            { yPercent: 0, scale: 1, duration: BEAT.visualFor },
            leave,
          );
        }

        /* ---- and the last one settles back under it ----------------------
           Same duration and ease as the rise, which is what keeps its
           exposed lower edge always behind the incoming layer. */
        const outgoing = image(layers[k]);
        if (outgoing) {
          tl.fromTo(
            outgoing,
            { yPercent: 0, scale: 1 },
            { yPercent: -8, scale: 1.03, duration: BEAT.visualFor, ...later },
            leave,
          );
        }

        /* ---- the progress segment fills as the photograph rises ---------- */
        tl.fromTo(
          fills[next],
          { scaleX: 0 },
          { scaleX: 1, duration: BEAT.visualFor, ease: 'power1.inOut' },
          leave,
        );

        /* ---- the step number rolls --------------------------------------- */
        tl.fromTo(
          numbers[k],
          { yPercent: 0 },
          { yPercent: -110, duration: 0.3, ...later },
          leave + 0.08,
        ).fromTo(numbers[next], { yPercent: 110 }, { yPercent: 0, duration: 0.3 }, leave + 0.08);

        /* ---- the next words arrive: title first, then the argument ------- */
        tl.fromTo(
          parts(steps[next]),
          { y: 28, autoAlpha: 0, filter: 'blur(6px)' },
          {
            y: 0,
            autoAlpha: 1,
            filter: 'blur(0px)',
            duration: BEAT.arriveFor,
            stagger: 0.04,
            ease: 'power2.out',
          },
          k + BEAT.arrive,
        );

        /* ---- the figure is set once its photograph has landed ------------ */
        const figure = caption(layers[next]);
        if (figure) {
          tl.fromTo(
            figure,
            { y: 16, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: BEAT.captionFor, ease: 'power2.out' },
            k + BEAT.caption,
          );
        }
      }

      /* The last principle is held for a whole unit before the pin releases. */
      tl.set({}, {}, n);

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
        root.classList.remove('is-live');
      };
    },
  );

  return () => mm.revert();
}

/* ==========================================================================
   CharterScrollSection
   ========================================================================== */

export function CharterScrollSection() {
  const { scrollTo } = useSmoothScroll();

  const scope = useGsapScope((_ctx, root) => {
    /* Five of the six photographs wait below the card's clipped edge until
       their turn, where native lazy-loading never sees them - so a reader who
       scrolls quickly meets an empty card. Load all six a screen early. */
    ScrollTrigger.create({
      trigger: root,
      start: 'top bottom+=100%',
      once: true,
      onEnter: () =>
        root.querySelectorAll('img').forEach((img) => {
          img.loading = 'eager';
          /* Decoded now, not on the frame it first rises into view - an
             undecoded photograph paints as an empty card for that frame. */
          img.decode().catch(() => undefined);
        }),
    });

    /* The layout switch comes first, so the heading's own entrance below is
       measured against the layout it will actually play in. */
    const unbuild = buildMotion(root);

    const title = root.querySelector('.charter__title');
    const unsplit = title ? lines(title, { trigger: root }) : undefined;
    rise(root.querySelectorAll('[data-intro]'), { trigger: root, y: 16, delay: 0.2 });

    return () => {
      unsplit?.();
      unbuild();
    };
  }, []);

  const toPrincipal = (event) => {
    event.preventDefault();
    scrollTo('#principal', -24);
  };

  return (
    <section ref={scope} className="charter" id="values" aria-labelledby="charter-title">
      {/* CharterScrollContainer - the pinned element */}
      <div className="charter__stage">
        <div className="wrap charter__grid">
          <CharterContent />
          <CharterVisual />
        </div>
      </div>

      <div className="wrap charter__after">
        <a className="charter__cta btn btn-primary" href="#principal" onClick={toPrincipal}>
          <span className="btn__label">
            The principal&rsquo;s letter
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M2.5 8h10.5M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </span>
        </a>
      </div>
    </section>
  );
}

/* ==========================================================================
   The left column - the heading, and the six principles in one cell
   ========================================================================== */

function CharterContent() {
  return (
    <div className="charter__content">
      <header className="charter__head">
        <p className="charter__eyebrow" data-intro>
          The charter
        </p>
        <h2 className="charter__title" id="charter-title">
          Six things we will not trade.
        </h2>
        <p className="charter__lead" data-intro>
          Written in 1962 and never amended - each with the two practices that hold it up.
        </p>
      </header>

      <ol className="charter__steps">
        {ENTRIES.map((entry) => (
          <li className="charter-step" key={entry.id} id={`charter-${entry.id}`}>
            <StepIndicator entry={entry} />
            <CharterHeading entry={entry} />
            <CharterDescription entry={entry} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepIndicator({ entry }) {
  return (
    <p className="charter-step__label" data-part>
      <b>{entry.index}</b>
      <span className="charter-step__dash" aria-hidden="true" />
      {entry.label}
    </p>
  );
}

function CharterHeading({ entry }) {
  return (
    <h3 className="charter-step__title" data-part>
      {entry.title}
    </h3>
  );
}

function CharterDescription({ entry }) {
  return (
    <>
      <p className="charter-step__body" data-part>
        {entry.description}
      </p>
      <ul className="charter-step__proof" data-part>
        {entry.proof.map((point) => (
          <li key={point.slice(0, 24)}>{point}</li>
        ))}
      </ul>
    </>
  );
}

/* ==========================================================================
   The right column - the card that never moves
   ========================================================================== */

function CharterVisual() {
  return (
    <div className="charter__visual">
      <VisualCard />
    </div>
  );
}

function VisualCard() {
  return (
    <div className="charter-card">
      <div className="charter-card__frame">
        {ENTRIES.map((entry, i) => (
          <CardContent entry={entry} index={i} key={entry.id} />
        ))}

        <p className="charter-card__step" aria-hidden="true">
          <span className="charter-card__word">Principle</span>
          <span className="charter-card__num">
            {ENTRIES.map((entry) => (
              <span className="charter-card__num-n" key={entry.id}>
                {entry.index}
              </span>
            ))}
          </span>
          <span className="charter-card__of">/ {COUNT}</span>
        </p>
      </div>

      <ProgressIndicator />
    </div>
  );
}

function CardContent({ entry, index }) {
  return (
    <figure className="charter-card__layer" style={{ zIndex: index + 1 }}>
      <img
        className="charter-card__img"
        src={resolve(entry.photo, 1100)}
        srcSet={resolveSet(entry.photo, [640, 960, 1280, 1600])}
        sizes="(max-width: 699px) calc(100vw - 40px), (max-width: 1023px) 54vw, 52vw"
        alt={entry.photo.alt}
        loading={index === 0 ? 'eager' : 'lazy'}
        decoding="async"
        style={entry.photo.focus ? { objectPosition: entry.photo.focus } : undefined}
      />
      <figcaption className="charter-card__caption">
        <b>{entry.mark.value}</b>
        <span>{entry.mark.label}</span>
      </figcaption>
    </figure>
  );
}

function ProgressIndicator() {
  return (
    <ol className="charter-progress" aria-hidden="true">
      {ENTRIES.map((entry) => (
        <li className="charter-progress__seg" key={entry.id}>
          <span className="charter-progress__fill" />
        </li>
      ))}
    </ol>
  );
}
