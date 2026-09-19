/* ==========================================================================
   MOTION - the site's whole animation vocabulary, in one file
   --------------------------------------------------------------------------
   Ten gestures. Every animated thing on the site is one of them, and a
   section that wants an eleventh has to justify it here rather than inventing
   it locally. That constraint is the reason the motion reads as one designed
   system rather than as forty sections each showing off.

     lines()      a headline arrives line by line, from under a mask
     rise()       a group of small things comes up in sequence
     unmask()     a photograph is printed rather than faded in
     drift()      something moves at a different speed from the page
     count()      a figure counts up to itself
     draw()       a highlighter or an underline is drawn under a word
     grow()       a rule or a progress line extends as the reader scrolls
     rail()       a horizontal strip is dragged, scrolled, or scrubbed
     settle()     the tiny one: a hover, a press, a magnet
     stand()      the wordmark at the foot of the page stands up off it

   THREE RULES THAT APPLY TO ALL OF THEM

   1. THE RESTING STATE IS THE FINISHED STATE.
      Every helper animates *from* a hidden state that it sets itself, and it
      sets it in the same tick it builds the tween. Nothing is hidden in CSS.
      A page with JavaScript disabled, a page that errors before hydration,
      and a page rendered to a PDF are all complete pages - which is not true
      of the usual `opacity: 0` in a stylesheet.

   2. REDUCED MOTION IS NOT "FASTER". IT IS "ALREADY THERE".
      Every helper checks the media query and returns without building
      anything. It never builds a 1ms version, because a 1ms version still
      pins, still scrubs, and still hijacks a scroll.

   3. TRANSFORM AND OPACITY ONLY.
      The one exception is `unmask`, which animates `clip-path` because there
      is no transform that does what it does. It is compositor-friendly on
      every engine that matters and it is used on a bounded number of nodes.
   ========================================================================== */

import { gsap, ScrollTrigger, SplitText, Draggable } from './gsap';

/** True when the visitor has asked the OS for less movement. */
export const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The site's one scroll-in trigger position, so sections cannot disagree. */
const START = 'top 82%';

/* --------------------------------------------------------------------------
   lines - a headline arrives
   --------------------------------------------------------------------------
   SplitText into lines, each wrapped in its own overflow-hidden mask, then
   the lines travel up from below their own mask. This is the site's signature
   entrance and it is reserved for headlines: running a paragraph through it
   makes the reader wait for prose, which is rude.

   The split is reverted on teardown so the DOM goes back to being real text -
   a headline left as forty <span>s is a headline a screen reader reads as
   forty fragments.
   -------------------------------------------------------------------------- */
export function lines(target, opts = {}) {
  if (reduced()) return;
  const el = gsap.utils.toArray(target)[0];
  if (!el) return;

  /* Lines are a function of width. A phone turned to landscape, a resized
     window or a late font re-wraps the headline, and `autoSplit` re-splits
     it - so the entrance is built in `onSplit`, against the lines that exist
     now. SplitText reverts the tween it returned before each re-split, which
     is what keeps a stale set of lines from being animated. Once the
     entrance has started it is not replayed: a headline the reader has
     already watched arrive simply re-wraps. */
  let started = false;

  const split = SplitText.create(el, {
    type: 'lines',
    linesClass: 'split-line',
    mask: 'lines',
    autoSplit: true,
    onSplit: (self) => {
      if (started) return undefined;
      return gsap.from(self.lines, {
        yPercent: 118,
        duration: 1.15,
        ease: 'power4.out',
        stagger: opts.stagger ?? 0.09,
        delay: opts.delay ?? 0,
        onStart: () => {
          started = true;
        },
        scrollTrigger: {
          trigger: opts.trigger ?? el,
          start: opts.start ?? START,
          once: opts.once ?? true,
        },
      });
    },
  });

  return () => split.revert();
}

/* --------------------------------------------------------------------------
   playOnScroll - a composed timeline waits for its section
   --------------------------------------------------------------------------
   Use this instead of `scrollTrigger` in a timeline's vars whenever the
   trigger is `once`.

   GSAP measures a trigger attached to a timeline one tick late, so the
   timeline can be filled first. Until then the trigger has no end, and the
   next trigger created anywhere measures it on the spot. On a page reloaded
   halfway down, that is several sections already scrolled past: each `once`
   trigger completes and removes itself inside that measuring loop, the list
   shrinks under it, and ScrollTrigger throws "reading 'end'", taking the
   whole page down.

   A standalone trigger is measured the moment it is made, so it never sits
   in that half-built state. It plays the paused timeline on the way in, and
   on the way past for a reader who jumps below it.

   GSAP does not run enter/leave callbacks while it is measuring, so a trigger
   measured already past its end - made below the fold, or pushed past by a
   refresh - would never play, leaving its section hidden. `onRefresh` plays
   it in that case. It only plays, never kills: a trigger removed during a
   refresh is the crash this helper exists to avoid.

   Delay belongs inside the timeline (a position on the first tween), not in
   its vars: a paused timeline that is later played ignores its own delay.
   -------------------------------------------------------------------------- */
export function playOnScroll(tl, vars) {
  tl.pause();
  const play = () => tl.play();
  return ScrollTrigger.create({
    ...vars,
    once: vars.once ?? true,
    onEnter: play,
    onLeave: play,
    onRefresh: (self) => {
      if (self.progress === 1) play();
    },
  });
}

/* --------------------------------------------------------------------------
   rise - a group of small things arrives
   --------------------------------------------------------------------------
   The workhorse. Metadata, list items, chips, cards, buttons. Short travel
   and a tight stagger: past about 90ms a row stops reading as one gesture and
   starts reading as a queue.
   -------------------------------------------------------------------------- */
export function rise(targets, opts = {}) {
  if (reduced()) return;
  const els = gsap.utils.toArray(targets);
  if (!els.length) return;

  gsap.from(els, {
    y: opts.y ?? 26,
    opacity: 0,
    duration: 0.85,
    ease: 'power3.out',
    stagger: opts.stagger ?? 0.07,
    delay: opts.delay ?? 0,
    scrollTrigger: {
      trigger: opts.trigger ?? els[0],
      start: opts.start ?? START,
      once: opts.once ?? true,
    },
  });
}

/* --------------------------------------------------------------------------
   unmask - a photograph is printed
   --------------------------------------------------------------------------
   The frame opens from the bottom edge while the image inside it scales down
   from 1.08 to 1. Two things moving in opposite directions is what makes it
   read as a print rather than as a reveal: the frame grows, the picture
   settles.

   `from` picks the edge the mask opens from. Alternating it down a page is
   most of why a column of photographs does not read as a list.
   -------------------------------------------------------------------------- */
export function unmask(
  figures,
  opts = {},
) {
  const els = gsap.utils.toArray(figures);
  if (!els.length || reduced()) return;

  const edge = {
    bottom: 'inset(100% 0% 0% 0%)',
    top: 'inset(0% 0% 100% 0%)',
    left: 'inset(0% 100% 0% 0%)',
    right: 'inset(0% 0% 0% 100%)',
  }[opts.from ?? 'bottom'];

  els.forEach((el, i) => {
    const image = el.querySelector('img');
    const at = (opts.delay ?? 0) + i * (opts.stagger ?? 0.12);
    const tl = gsap.timeline({ paused: true });

    tl.from(el, {
      clipPath: edge,
      duration: 1.25,
      ease: 'power4.inOut',
    }, at);

    if (image) {
      tl.from(image, { scale: 1.09, duration: 1.6, ease: 'power3.out' }, at);
    }

    playOnScroll(tl, {
      trigger: opts.trigger ?? el,
      start: opts.start ?? START,
      once: opts.once ?? true,
    });
  });
}

/* --------------------------------------------------------------------------
   drift - parallax
   --------------------------------------------------------------------------
   `amount` is the total travel in pixels across the whole scroll through the
   element, positive meaning the thing lags the page. Kept small deliberately:
   the point is that the composition breathes, not that the reader notices
   layers.
   -------------------------------------------------------------------------- */
export function drift(target, amount = 80, opts = {}) {
  if (reduced()) return;
  const els = gsap.utils.toArray(target);
  if (!els.length) return;

  els.forEach((el) => {
    gsap.fromTo(
      el,
      { y: -amount / 2 },
      {
        y: amount / 2,
        ease: 'none',
        scrollTrigger: {
          trigger: opts.trigger ?? el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    );
  });
}

/* --------------------------------------------------------------------------
   count - a figure counts up to itself
   --------------------------------------------------------------------------
   The element's own text is the source of truth, so the finished number is in
   the markup and the animation only re-reaches it. That is what keeps the
   number correct when motion is off, when the tween is interrupted, and when
   a search engine reads the page.

   It parses the number out of whatever is written - '10,000+', '4.9', '98%' -
   and preserves the prefix, suffix, separators and decimal places exactly.
   -------------------------------------------------------------------------- */
export function count(
  targets,
  opts = {},
) {
  const els = gsap.utils.toArray(targets);
  if (!els.length || reduced()) return;

  els.forEach((el, i) => {
    // If the setup re-runs while a count is mid-flight (a parent re-render
    // reverts the context), the element holds a partial figure, and reading
    // that as the target freezes the count on it - on '0', typically. So the
    // authored figure is remembered, and the text is trusted again only when
    // something other than this function has changed it.
    const shown = el.textContent ?? '';
    const final =
      el.dataset.countTo !== undefined && el.dataset.countShown === shown
        ? el.dataset.countTo
        : shown;
    el.dataset.countTo = final;
    const match = final.match(/-?[\d,]*\.?\d+/);
    if (!match) return;

    const raw = match[0];
    const value = parseFloat(raw.replace(/,/g, ''));
    if (!Number.isFinite(value)) return;

    const prefix = final.slice(0, match.index ?? 0);
    const suffix = final.slice((match.index ?? 0) + raw.length);
    const decimals = (raw.split('.')[1] ?? '').length;
    const grouped = raw.includes(',');
    const box = { n: 0 };

    if (opts.fromZero) {
      el.textContent = prefix + (0).toFixed(decimals) + suffix;
      el.dataset.countShown = el.textContent;
    }

    gsap.to(box, {
      n: value,
      duration: opts.duration ?? 1.9,
      ease: opts.ease ?? 'power2.out',
      delay: (opts.delay ?? 0) + i * (opts.stagger ?? 0),
      snap: decimals ? { n: 1 / 10 ** decimals } : { n: 1 },
      onUpdate: () => {
        const n = decimals ? box.n.toFixed(decimals) : Math.round(box.n).toString();
        el.textContent = prefix + (grouped ? groupDigits(n) : n) + suffix;
        el.dataset.countShown = el.textContent;
      },
      onComplete: () => {
        // Restore the authored string rather than the formatted one, so any
        // character the parser did not model survives.
        el.textContent = final;
        el.dataset.countShown = final;
      },
      scrollTrigger: {
        trigger: opts.trigger ?? el,
        start: opts.start ?? 'top 88%',
        once: true,
      },
    });
  });
}

function groupDigits(n) {
  const [whole, frac] = n.split('.');
  const out = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${out}.${frac}` : out;
}

/* --------------------------------------------------------------------------
   draw - the highlighter
   --------------------------------------------------------------------------
   Drives the `--mark-scale` custom property that `.mark`, `.mark-ul` and
   `.mark-ring` in globals.css scale themselves by. The property rests at 1,
   so a mark that is never animated is a mark that is simply already drawn.

   The delay is deliberate and it is the whole trick: the stroke lands just
   after the headline's last line has settled, so it reads as someone marking
   the sentence after writing it rather than as part of the same motion.
   -------------------------------------------------------------------------- */
export function draw(scope, opts = {}) {
  if (reduced()) return;
  const marks = scope.querySelectorAll('.mark, .mark-ul, .mark-ring');
  if (!marks.length) return;

  gsap.fromTo(
    marks,
    { '--mark-scale': 0 },
    {
      '--mark-scale': 1,
      duration: 0.62,
      ease: 'power2.inOut',
      stagger: 0.14,
      delay: opts.delay ?? 0.55,
      scrollTrigger: {
        trigger: opts.trigger ?? scope,
        start: opts.start ?? START,
        once: true,
      },
    },
  );
}

/* --------------------------------------------------------------------------
   grow - a line the reader draws
   --------------------------------------------------------------------------
   Scrubbed rather than played, because the point is that the progress belongs
   to the reader. Used for the admissions process spine, the chapter rules and
   the journey path.

   `axis` picks which way it extends. `svg` mode animates a stroke's dash
   offset instead of a transform, for a path that curves.
   -------------------------------------------------------------------------- */
export function grow(
  target,
  opts = {},
) {
  const els = gsap.utils.toArray(target);
  if (!els.length) return;

  els.forEach((el) => {
    if (reduced()) {
      // The finished state, without a scrub. A progress line that never fills
      // is a broken graphic, not a calm one.
      if (opts.svg) gsap.set(el, { strokeDashoffset: 0 });
      return;
    }

    const trigger = opts.trigger ?? el;

    if (opts.svg) {
      const path = el;
      const len = path.getTotalLength();
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      gsap.to(path, {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: {
          trigger,
          start: 'top 72%',
          end: opts.end ?? 'bottom 62%',
          scrub: 0.7,
        },
      });
      return;
    }

    gsap.fromTo(
      el,
      { scaleY: opts.axis === 'x' ? 1 : 0, scaleX: opts.axis === 'x' ? 0 : 1 },
      {
        scaleY: 1,
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger,
          start: 'top 72%',
          end: opts.end ?? 'bottom 62%',
          scrub: 0.7,
        },
      },
    );
  });
}

/* --------------------------------------------------------------------------
   rail - a horizontal strip
   --------------------------------------------------------------------------
   One helper, two behaviours, and which one you get depends on the viewport
   rather than on a prop:

     DESKTOP    the section pins and vertical scroll is converted into
                horizontal travel. It is the strongest device on the site and
                it is used exactly four times.
     TOUCH      native overflow scrolling with snap points. A pinned scroll
                hijack on a phone fights the browser's own gesture handling
                and loses.

   Drag is added on top of the pinned version, because a strip that can only
   be reached by scrolling is a strip half the audience will not reach. The
   Draggable instance moves the ScrollTrigger's scroll position rather than
   the element, so dragging and scrolling cannot disagree about where the
   strip is.
   -------------------------------------------------------------------------- */
export function rail(
  track,
  section,
  opts = {},
) {
  const distance = () => Math.max(0, track.scrollWidth - track.parentElement.clientWidth);

  if (reduced() || window.matchMedia('(max-width: 900px)').matches) {
    // Nothing to build: the CSS already makes this an overflow-scroll strip.
    // Returning early rather than building a disabled ScrollTrigger keeps the
    // page's total trigger count honest.
    return;
  }

  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${opts.end ? opts.end(distance()) : distance() + window.innerHeight * 0.6}`,
    pin: true,
    scrub: 0.8,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      gsap.set(track, { x: -distance() * self.progress });
      opts.onProgress?.(self.progress);
    },
  });

  const drag = Draggable.create(track, {
    type: 'x',
    trigger: track,
    cursor: 'grab',
    activeCursor: 'grabbing',
    inertia: false,
    onDrag() {
      const d = distance();
      if (!d) return;
      const p = gsap.utils.clamp(0, 1, -this.x / d);
      // Move the page, not the element: the ScrollTrigger's onUpdate is what
      // actually positions the track, so this keeps one source of truth.
      const scroll = st.start + (st.end - st.start) * p;
      window.scrollTo({ top: scroll });
    },
  })[0];

  return () => {
    drag?.kill();
    st.kill();
  };
}

/* --------------------------------------------------------------------------
   stand - the wordmark stands up
   --------------------------------------------------------------------------
   Used once: the school's name at the foot of every page. Each letter starts
   tipped back onto the page, lying flat on its own baseline, and stands
   upright as the reader runs out of page - so reaching the end has a moment
   rather than just stopping.

   Scrubbed, not played, because the point is that the reader is the one
   doing it. The ending is placed so the letters are upright a little before
   the scroll can go no further; a wordmark still leaning when the page stops
   reads as a broken animation, not a calm one.

   Restrained in everything except the angle: short travel, no scale, no
   overshoot, a tight stagger. The letters' parent must carry `perspective`,
   which is set in the stylesheet in `em` so the vanishing point scales with
   the type rather than flattening on a phone.
   -------------------------------------------------------------------------- */
export function stand(
  targets,
  opts = {},
) {
  if (reduced()) return;
  const els = gsap.utils.toArray(targets);
  if (!els.length) return;

  const split = new SplitText(els, { type: 'chars', charsClass: 'split-char' });

  gsap.fromTo(
    split.chars,
    { rotateX: 76, yPercent: 34, opacity: 0, transformOrigin: '50% 100%' },
    {
      rotateX: 0,
      yPercent: 0,
      opacity: 1,
      ease: 'power2.out',
      stagger: 0.055,
      scrollTrigger: {
        trigger: opts.trigger ?? els[0],
        start: opts.start ?? 'top bottom',
        end: opts.end ?? 'bottom bottom',
        scrub: 0.6,
      },
    },
  );

  return () => split.revert();
}

/* --------------------------------------------------------------------------
   settle - the small ones
   --------------------------------------------------------------------------
   A magnetic pull toward the pointer, used on the primary buttons and the
   drag handles. The shell moves further than the label inside it, which is
   what makes it feel like a physical object with some give rather than like a
   div being translated.

   Returns its own teardown. Bind it inside a gsap.context so the listeners
   die with the timeline.
   -------------------------------------------------------------------------- */
export function settle(el, strength = 0.32) {
  if (reduced() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const label = el.querySelector('.btn__label');
  const move = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
  const moveY = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });
  const labelX = label && gsap.quickTo(label, 'x', { duration: 0.55, ease: 'power3.out' });
  const labelY = label && gsap.quickTo(label, 'y', { duration: 0.55, ease: 'power3.out' });

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) * strength;
    const dy = (e.clientY - (r.top + r.height / 2)) * strength;
    move(dx);
    moveY(dy);
    labelX?.(dx * 0.42);
    labelY?.(dy * 0.42);
  };

  const onLeave = () => {
    move(0);
    moveY(0);
    labelX?.(0);
    labelY?.(0);
  };

  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);

  return () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
  };
}
