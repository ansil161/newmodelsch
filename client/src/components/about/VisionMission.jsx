import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { VISION_PANELS } from '@/constants';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { Sticker } from '@/components/editorial';
import { Icon } from '@/components/common/Icon';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import { cx } from '@/utils';
import './vision-mission.css';

/* ==========================================================================
   VISION & MISSION - two strokes of paint, read by scrolling
   --------------------------------------------------------------------------
   Two irregular brush strokes on paper. The reader does not click through
   them and they do not play on a timer: the section locks to the viewport and
   the reader's own scroll walks the composition from the pair, to the vision
   statement, to the mission statement, and back out into the page.

   WHY IT IS BUILT THIS WAY

   1. THE SCROLL IS THE ONLY CLOCK.
      One scrubbed master timeline drives every layer - both strokes, both
      markers, both statements. There is no autoplay, no interval, no carousel
      index, and no second state machine that could disagree with the first.
      Scroll up and the story runs backwards exactly as far as you scrolled.

   2. THE MARKERS ARE STILL CONTROLS.
      A `+` on a brush stroke has to do something when you press it, and a
      keyboard user has to be able to reach both statements. Pressing one does
      not open a panel - it scrolls the page to the point in the pinned run
      where that statement is open. So the control and the scroll are the same
      mechanism, and `aria-expanded` is read off the scroll position rather
      than off a piece of React state that could drift from it.

   3. TRANSFORMS ONLY.
      Every stroke movement is `x/y/scale/rotation` on one wrapper with a
      fixed `left center` origin; nothing animates a box. The old version of
      this section transitioned `left/top/width/height`, which is four layout
      properties per frame on a filtered SVG.

   4. THE RESTING STATE IS THE FINISHED STATE.
      With no motion - a narrow screen, or `prefers-reduced-motion` - the
      section is an ordinary stacked composition: each stroke above its own
      statement, everything visible, nothing pinned. `is-live` is added by the
      motion build and removed when it reverts, so the cinematic layout only
      exists while there is something to drive it. Nothing is hidden in CSS
      that JavaScript then has to remember to show.

   THE RUN, IN ONE PLACE

     0 -> 14    both strokes arrive; markers and wordmarks land
     14 -> 28   the pair holds, and is simply a composition
     28 -> 46   mission steps aside, vision docks left, its statement reads
     46 -> 60   vision holds
     60 -> 78   vision leaves, mission takes the dock, its statement reads
     78 -> 100  mission holds, then the section releases

   The numbers below are the only place those beats are written.
   ========================================================================== */

/* --------------------------------------------------------------------------
   The beats
   --------------------------------------------------------------------------
   A 0-100 scale rather than seconds, because the timeline is scrubbed - its
   duration is a scroll distance, not a time. `OPEN` values are the progress
   the marker buttons scroll to, and they are read from the same constants the
   timeline is built from so a retimed beat cannot leave a button behind.
   -------------------------------------------------------------------------- */
const BEAT = {
  enter: [0, 14],
  visionOpen: [28, 46],
  visionHold: [46, 60],
  missionOpen: [60, 78],
};

const TOTAL = 100;

/** Where a marker press lands: the middle of that statement's hold. */
const OPEN_AT = {
  vision: (BEAT.visionOpen[1] + BEAT.visionHold[1]) / 2 / TOTAL,
  mission: (BEAT.missionOpen[1] + TOTAL) / 2 / TOTAL,
};

/** How far the reader scrolls through the pin, in viewport heights. */
const PIN_LENGTH = 3.4;

/** Uniform shrink applied to a stroke when it docks.

    Tuned against what is left after the shrink rather than against the number:
    the paint fills about two-thirds of its own box, so anything under about
    0.6 leaves a smear rather than a stroke beside the statement. */
const DOCK_SCALE = 0.66;

/**
 * The dock, per stroke, in percentages of the stroke's own box.
 *
 * Both strokes end up in the same slot on the left, vertically centred on the
 * stage — so the two statements are read against the same shape in the same
 * place, and only the colour and the words change. The numbers are derived
 * from the idle boxes in the stylesheet; if one of those moves, the comment
 * beside it in `vision-mission.css` says which of these follows it.
 */
const DOCK = {
  vision: { xPercent: 0, yPercent: -19.7, rotation: -2 },
  mission: { xPercent: -78.6, yPercent: 19.7, rotation: -2 },
};

/** The angle both strokes rest at as a pair - the same for each, so the two
    read as one matched composition rather than one straight and one askew. */
const REST_ROTATION = -4;

/** Where a stroke waits when the other one has the floor. */
const ASIDE = {
  vision: { xPercent: -30, yPercent: 14, scale: 0.84, rotation: -8 },
  mission: { xPercent: 30, yPercent: -14, scale: 0.84, rotation: -11 },
};

/** Where a stroke comes from on first arrival. */
const ENTER = {
  vision: { xPercent: -26, yPercent: 20, scale: 0.9, rotation: -12 },
  mission: { xPercent: 24, yPercent: -18, scale: 0.9, rotation: -14 },
};

/* ==========================================================================
   The stroke
   --------------------------------------------------------------------------
   Drawn, not shipped as a PNG. A slab, a couple of dry streaks and some
   spray, all pushed through one turbulence displacement filter - which is
   what turns clean vector edges into a swipe of paint that ran out halfway.

   Two layers rather than one: the body at full strength, and a second pass
   offset a few units with its own frequency, so the middle of the stroke
   carries the darker double-loaded band a real brush leaves. The seed differs
   per instance, so the two strokes are not the same shape twice.
   ========================================================================== */
function BrushStroke({ id, seed }) {
  return (
    <svg
      className="vm__paint"
      viewBox="0 0 420 300"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Tight region: a wider one lets the displaced edge bleed past the
            element's own box and under the page gutter. */}
        <filter id={id} x="-10%" y="-14%" width="120%" height="128%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02 0.055"
            numOctaves="4"
            seed={seed}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="26"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* The second pass. A different frequency, so it does not simply
            trace the first one a few pixels over. */}
        <filter id={`${id}-b`} x="-10%" y="-14%" width="120%" height="128%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.045 0.03"
            numOctaves="3"
            seed={seed + 11}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="18"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>

      {/* Scaled in from the viewBox edge, so the displaced outline has room to
          move without being clipped. */}
      <g filter={`url(#${id})`} fill="currentColor" transform="translate(34 12) scale(0.85)">
        <path d="M30 108C96 74 158 86 224 70c58-14 122-4 166 20 14 32 8 88-8 130-18 46-72 68-136 60-62-8-124 4-180-16-34-14-48-72-32-156Z" />
        {/* Dry streaks trailing off the leading edge. */}
        <path d="M232 44c46-8 92-6 132 8-40 4-84 10-126 22-14 4-20-24-6-30Z" opacity="0.85" />
        <path d="M300 250c40 2 74-8 104-26-22 26-58 44-98 48-14 2-18-20-6-22Z" opacity="0.7" />
        {/* Spray, where the brush left the paper. */}
        <ellipse cx="14" cy="152" rx="10" ry="7" opacity="0.9" />
        <ellipse cx="402" cy="196" rx="8" ry="6" opacity="0.75" />
        <ellipse cx="366" cy="36" rx="6" ry="5" opacity="0.6" />
        <ellipse cx="60" cy="264" rx="7" ry="5" opacity="0.7" />
      </g>

      {/* The double-loaded band through the middle. Multiply, so it darkens
          the body rather than sitting on it as a second colour. */}
      <g
        className="vm__paint-load"
        filter={`url(#${id}-b)`}
        fill="currentColor"
        transform="translate(52 34) scale(0.78)"
      >
        <path d="M46 128c72-30 140-22 210-34 44-8 88-2 122 12-30 30-96 44-166 52-64 8-128 16-176 4-14-4-16-28 10-34Z" />
      </g>
    </svg>
  );
}

/* ==========================================================================
   One column of the mission's split statement
   --------------------------------------------------------------------------
   The ampersand rides inside the first headline rather than sitting in a
   column of its own: that column is right-aligned, so a third grid track
   would strand the badge a long way from the words it joins.
   ========================================================================== */
function SplitColumn({
  column,
  align,
  amp = false,
}) {
  return (
    <div className={cx('vm__col', `vm__col--${align}`)} data-in>
      <h4 className="vm__col-head">
        {amp ? (
          <span className="vm__amp" aria-hidden="true">
            &amp;
          </span>
        ) : null}
        {column.headline.map((line, i) =>
          i === column.insetIndex ? (
            <span className="vm__col-inset" key={line}>
              {line}
            </span>
          ) : (
            <span className="vm__col-line" key={line}>
              {line}
            </span>
          ),
        )}
      </h4>
      <p className="vm__col-body">{column.body}</p>
    </div>
  );
}

/* --------------------------------------------------------------------------
   The pinned run - wide screens, motion allowed
   -------------------------------------------------------------------------- */
function buildPinned(root, wiring) {
  const pin = root.querySelector('.vm__pin');
  if (!pin) return;

  const brush = (id) => root.querySelector(`[data-brush="${id}"]`);
  const panel = (id) => root.querySelector(`[data-panel="${id}"]`);
  const marker = (id) => root.querySelector(`[data-marker="${id}"]`);
  const cue = (id) => root.querySelector(`[data-cue="${id}"]`);
  const label = (id) => root.querySelector(`[data-label="${id}"]`);

  const vision = brush('vision');
  const mission = brush('mission');
  if (!vision || !mission) return;

  /* The overlay layout only exists while there is a timeline to drive it.
     Added before the trigger is created, so the pin measures the composition
     it is actually going to animate. */
  root.classList.add('is-live');

  /* One origin for the whole run. Changing `transformOrigin` mid-timeline
     jumps a DOM element, so the dock, the aside and the entrance are all
     expressed against the same left-centre pivot. */
  gsap.set([vision, mission], { transformOrigin: 'left center' });

  const timeline = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => `+=${window.innerHeight * PIN_LENGTH}`,
      pin: true,
      /* A hair of smoothing so a trackpad's jitter never reaches a transform.
         Past about 1 it stops feeling like scrubbing and starts feeling like
         lag. */
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      /* A statement counts as open from just before its beat finishes until
         the beat that takes it away begins — read off the same constants the
         timeline is built from, so the × and the docked marker position can
         never be left on a stroke that is already leaving. */
      onUpdate: (self) => {
        const p = self.progress * TOTAL;
        wiring.setPhase(
          p >= BEAT.missionOpen[1] - 4
            ? 'mission'
            : p >= BEAT.visionOpen[1] - 4 && p < BEAT.missionOpen[0]
              ? 'vision'
              : 'idle',
        );
      },
    },
  });

  wiring.trigger = timeline.scrollTrigger ?? null;

  /* ---------------------------------------------------------------- 1. entry
     The pair arrives. Each stroke comes in from the side it lives on and
     rotates the last few degrees into place, so the two read as having been
     painted rather than as having been positioned. */
  const [enterFrom, enterTo] = BEAT.enter;

  timeline
    .fromTo(
      vision,
      { ...ENTER.vision, autoAlpha: 0 },
      { xPercent: 0, yPercent: 0, scale: 1, rotation: REST_ROTATION, autoAlpha: 1, duration: enterTo },
      enterFrom,
    )
    .fromTo(
      mission,
      { ...ENTER.mission, autoAlpha: 0 },
      { xPercent: 0, yPercent: 0, scale: 1, rotation: REST_ROTATION, autoAlpha: 1, duration: enterTo - 2 },
      enterFrom + 2,
    );

  /* The wordmarks and the markers land after the paint, not with it. A
     stroke that arrives already labelled reads as an image; one that is
     painted and then written on reads as two acts. */
  (['vision', 'mission']).forEach((id, i) => {
    const wordmark = label(id);
    const hotspot = marker(id);
    const hint = cue(id);
    const at = enterFrom + 6 + i * 2;

    if (wordmark) {
      timeline.fromTo(
        wordmark.querySelectorAll('i'),
        { yPercent: 110, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 7, stagger: 1.4 },
        at,
      );
    }
    if (hotspot) {
      timeline.fromTo(
        hotspot,
        { scale: 0.3, autoAlpha: 0 },
        { scale: 1, autoAlpha: 1, duration: 6, ease: 'back.out(2)' },
        at + 2,
      );
    }
    if (hint) {
      timeline.fromTo(hint, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 5 }, at + 4);
    }
  });

  /* -------------------------------------------------------- 2. the statements
     Each statement is the same three moves: the other stroke steps aside, this
     one docks, and the words read in the space that frees up. Nothing is ever
     laid over the top of the composition, which is the difference between this
     and a modal. */
  const open = (
    id,
    other,
    [from, to],
    dockAt,
  ) => {
    const self = brush(id);
    const away = brush(other);
    const body = panel(id);
    const hotspot = marker(id);
    const hint = cue(id);
    const span = to - from;

    /* The stroke leaving goes back the way it came, so the reader can see
       where it went rather than watching it evaporate.

       Opacity is a separate tween from the move on both strokes, and a much
       shorter one. Fading a stroke across its whole travel is what produced
       the long muddy window where neither statement was legible and both
       were on the page - the paint has to be either there or gone well
       before it has finished moving. */
    timeline.to(away, { ...ASIDE[other], duration: span * 0.5 }, from);
    timeline.to(away, { autoAlpha: 0, duration: span * 0.26 }, from + span * 0.08);

    timeline.to(
      self,
      { ...DOCK[id], scale: DOCK_SCALE, duration: span * 0.78 },
      from + span * 0.12,
    );
    timeline.to(self, { autoAlpha: 1, duration: span * 0.22 }, from + span * 0.12);

    /* The marker turns 45 degrees into a close. One control, both ways -
       there is never a second button to find, and focus never has to move. */
    if (hotspot) {
      timeline.to(hotspot, { rotation: 45, duration: span * 0.5 }, from + span * 0.25);
    }
    /* Once the statement is open the cue would be telling the reader to do
       the thing they have just done. */
    if (hint) {
      timeline.to(hint, { autoAlpha: 0, y: -6, duration: span * 0.3 }, from);
    }

    /* The statement has to be finished well before the hold is, or the reader
       spends the pause watching the last line arrive instead of reading it.
       Everything lands inside the first two-thirds of the beat. */
    if (body) {
      timeline.to(body, { autoAlpha: 1, duration: span * 0.25 }, dockAt - span * 0.4);
      timeline.fromTo(
        body.querySelectorAll('[data-in]'),
        { yPercent: 40, autoAlpha: 0 },
        {
          yPercent: 0,
          autoAlpha: 1,
          duration: span * 0.4,
          stagger: span * 0.04,
        },
        dockAt - span * 0.35,
      );
    }
  };

  /* Vision. */
  open('vision', 'mission', BEAT.visionOpen, BEAT.visionOpen[1]);

  /* The handover. The vision statement clears out first, so the two are never
     both on the page - the mission's words arrive into an empty column rather
     than cross-fading through someone else's sentence. */
  const [handFrom, handTo] = BEAT.missionOpen;
  const visionPanel = panel('vision');
  const visionMarker = marker('vision');

  if (visionPanel) {
    timeline.to(
      visionPanel.querySelectorAll('[data-in]'),
      { yPercent: -26, autoAlpha: 0, duration: 3.5, stagger: 0.4 },
      handFrom,
    );
    /* Off the page by the sixth beat of the handover, which is before the
       yellow has finished arriving. */
    timeline.to(visionPanel, { autoAlpha: 0, duration: 3 }, handFrom + 2.5);
  }
  if (visionMarker) {
    timeline.to(visionMarker, { rotation: 0, duration: 6 }, handFrom);
  }

  open('mission', 'vision', [handFrom + 4, handTo], handTo);

  /* --------------------------------------------------------- 3. the long drift
     Under everything: the docked stroke keeps moving, very slightly, for the
     whole run. It is the difference between a composition that is animated and
     one that is alive, and the test for it is that nobody should be able to
     say what moved. */
  timeline.fromTo(
    '.vm__stage',
    { y: 0 },
    { y: -18, duration: TOTAL, ease: 'none' },
    0,
  );

  /* The head text travels at its own rate. Two speeds is what reads as depth;
     one speed is a section sliding. */
  timeline.fromTo(
    '.vm__head',
    { y: 0 },
    { y: 26, duration: TOTAL, ease: 'none' },
    0,
  );

  /* Nothing follows the last beat but the release. The final composition holds
     for the remaining scroll and the pin ends on it, so the section is never
     mid-transition when the page starts moving again. */
  timeline.set({}, {}, TOTAL);

  return () => {
    root.classList.remove('is-live');
    wiring.trigger = null;
  };
}

/* --------------------------------------------------------------------------
   The flowing run - narrow screens, motion allowed
   --------------------------------------------------------------------------
   No pin. A phone's scroll belongs to the person holding it, and a section
   that captures it to play a composition is a section they cannot get past.
   The two blocks are already stacked in the base layout, so each one only
   needs its own arrival - and it is still scrubbed, so the reader's thumb is
   still what moves the paint.
   -------------------------------------------------------------------------- */
function buildFlow(root) {
  const blocks = gsap.utils.toArray('.vm__block', root);

  blocks.forEach((block) => {
    const paint = block.querySelector('.vm__brush');
    const id = paint?.dataset.brush;
    if (!paint || !id) return;

    gsap.set(paint, { transformOrigin: 'left center' });

    /* Arrival: about half the travel of the desktop entrance. Enough to read
       as intentional, not enough to fight a thumb. */
    gsap.fromTo(
      paint,
      { xPercent: ENTER[id].xPercent * 0.4, rotation: ENTER[id].rotation * 0.5, scale: 0.94 },
      {
        xPercent: 0,
        rotation: REST_ROTATION,
        scale: 1,
        ease: 'none',
        scrollTrigger: { trigger: block, start: 'top 92%', end: 'top 42%', scrub: 0.7 },
      },
    );

    /* The wordmark and the statement rise once, on first sight. */
    const wordmark = block.querySelector('.vm__label');
    if (wordmark) {
      gsap.from(wordmark.querySelectorAll('i'), {
        yPercent: 110,
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.09,
        ease: 'power3.out',
        scrollTrigger: { trigger: block, start: 'top 74%', once: true },
      });
    }

    gsap.from(block.querySelectorAll('[data-in]'), {
      y: 26,
      autoAlpha: 0,
      duration: 0.8,
      stagger: 0.07,
      ease: 'power3.out',
      scrollTrigger: { trigger: block.querySelector('.vm__panel'), start: 'top 84%', once: true },
    });
  });
}

/* ==========================================================================
   The section
   ========================================================================== */
export function VisionMission() {
  const [phase, setPhase] = useState('idle');
  const { scrollTo } = useSmoothScroll();

  /* Mutable, and deliberately not state: the timeline writes the trigger here
     on build and the marker handlers read it on press. Putting it in state
     would re-render the section every time the motion build swapped. */
  const wiring = useRef({ trigger: null, setPhase: () => {} });

  const scope = useGsapScope((_ctx, root) => {
    /* Set on every build rather than once, because the ref outlives the
       context and a reverted build must not keep the old setter alive. */
    wiring.current.setPhase = (next) => setPhase((current) => (current === next ? current : next));

    const mm = gsap.matchMedia(root);

    mm.add(
      {
        pinned: '(min-width: 900px) and (prefers-reduced-motion: no-preference)',
        flowing: '(max-width: 899px) and (prefers-reduced-motion: no-preference)',
      },
      (context) => {
        const { pinned, flowing } = context.conditions;
        if (pinned) return buildPinned(root, wiring.current);
        if (flowing) buildFlow(root);
      },
    );

    return () => {
      mm.revert();
      wiring.current.trigger = null;
      /* A reader who reverts mid-run - a resize across the breakpoint, or
         motion switched off - should be left with the finished composition,
         not with whichever half-open frame the scroll was on. */
      setPhase('idle');
    };
  }, []);

  /**
   * A marker press moves the page, not a panel.
   *
   * Inside the pinned run the statement's position is a scroll offset, so the
   * button converts its beat into one and asks Lenis for it - which means the
   * press and the wheel are doing the same thing to the same timeline, and the
   * two can never disagree. Outside it there is no run to seek, so it simply
   * takes the reader to the statement, which is already on the page.
   */
  const seek = useCallback(
    (id) => () => {
      const trigger = wiring.current.trigger;
      if (trigger) {
        const target = phase === id ? 0 : OPEN_AT[id];
        // Pressing the × goes back to the pair rather than nowhere.
        const at = phase === id ? trigger.start : trigger.start + (trigger.end - trigger.start) * target;
        scrollTo(at);
        return;
      }
      const panel = document.querySelector(`[data-panel="${id}"]`);
      if (panel) scrollTo(panel, -120);
    },
    [phase, scrollTo],
  );

  return (
    <section ref={scope} className="vm" id="vision" aria-labelledby="vm-title">
      <div className="vm__pin">
        <div className="wrap vm__head">
          <div className="vm__head-left">
            <Sticker tone="blue" tilt={-2.4}>
              Vision &amp; mission
            </Sticker>
            <h2 className="ed-h2 vm__title" id="vm-title">
              What the school is for.
            </h2>
          </div>
          <p className="vm__lead">
            Two statements, painted rather than printed. Keep scrolling to read each one in
            full — or press the <span aria-hidden="true">+</span> on either stroke to go
            straight to it.
          </p>
        </div>

        <div className="wrap vm__stage">
          {VISION_PANELS.map((panel) => {
            const id = panel.id;
            const open = phase === id;

            return (
              <article
                className={cx('vm__block', `vm__block--${id}`, open && 'is-open')}
                key={panel.id}
              >
                <div className={cx('vm__brush', `vm__brush--${panel.tone}`)} data-brush={id}>
                  <BrushStroke id={`vm-paint-${id}`} seed={panel.tone === 'blue' ? 13 : 37} />

                  {/* Wordmark and marker share one centred column over the
                      body of the paint, so the + can never cover the word. */}
                  <div className="vm__face">
                    {/* Each line masked separately, so the wordmark can be
                        painted on line by line rather than faded on. */}
                    <span className="vm__label" data-label={id} aria-hidden="true">
                      <span>
                        <i>{panel.labelLines[0]}</i>
                      </span>
                      <span>
                        <i>{panel.labelLines[1]}</i>
                      </span>
                    </span>

                    <span className="vm__hot">
                      <button
                        type="button"
                        className="vm__marker"
                        data-marker={id}
                        data-cursor="link"
                        aria-expanded={open}
                        aria-controls={`vm-panel-${id}`}
                        onClick={seek(id)}
                      >
                        <Icon name="plus" size={24} />
                        <span className="sr-only">
                          {open ? 'Back to both statements' : `Read ${panel.labelLines.join(' ')}`}
                        </span>
                      </button>

                      {/* The words are the affordance. A bare + on a piece of
                          paint has never told anyone there is a statement
                          behind it. Hidden from assistive tech because the
                          button's own label already says this. */}
                      <span className="vm__cue" data-cue={id} aria-hidden="true">
                        Read our {id}
                      </span>
                    </span>
                  </div>
                </div>

                <div
                  className="vm__panel"
                  id={`vm-panel-${id}`}
                  data-panel={id}
                  role="region"
                  aria-label={panel.labelLines.join(' ')}
                >
                  {panel.layout === 'stacked' ? (
                    <p className="vm__stack">
                      {panel.lines?.map((line) => (
                        <span
                          className={cx('vm__stack-line', `is-${line.tone}`)}
                          key={line.text}
                          data-in
                        >
                          {line.text}
                        </span>
                      ))}
                    </p>
                  ) : (
                    <div className="vm__split">
                      <SplitColumn column={panel.columns[0]} align="end" amp />
                      <SplitColumn column={panel.columns[1]} align="start" />
                    </div>
                  )}

                  <div className="vm__foot" data-in>
                    <Link className="btn btn-primary" to={panel.ctaHref}>
                      <span className="btn__label">
                        {panel.ctaLabel}
                        <Icon name="arrowRight" size={17} />
                      </span>
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
