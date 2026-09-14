import { gsap, ScrollTrigger } from '@/lib/gsap';

/* ==========================================================================
   BEYOND THE SYLLABUS - motion
   --------------------------------------------------------------------------
   The map should feel like prints laid on a desk: assembled once, then left
   almost still. Seven small modules, each owning its own layer so no two
   tweens ever fight over the same property on the same element:

     reveal     copy, node, pencil lines, prints, cards, then the pen notes
     float      a slow sway on each print               .bm-photo   rotation
     shake      now and then, one print is nudged       body        x, rotation
     hover      lift, straighten, light the connector   body/card   scale, y
     parallax   layers follow the pointer by 3-12px     outer boxes x, y
     drift      prints slide against the scroll         .bm-photo   yPercent
     activate   the four light up in turn as you scroll classes only

   Wide screens get all of it. Tablets and phones get a plain reveal per
   experience, and hover only where there is a real pointer. Reduced motion
   gets opacity fades and nothing else: no sway, no shake, no parallax.

   As everywhere on the site, the resting state is the finished state - every
   hidden state is set here, in the same tick as its tween, never in CSS.
   ========================================================================== */

type Off = () => void;
type Track = <T extends (...args: never[]) => void>(name: string, fn: T) => T;

interface Group {
  id: string;
  el: HTMLElement;
  photo: HTMLElement;
  body: HTMLElement;
  wash: HTMLElement | null;
  frame: HTMLElement;
  img: HTMLImageElement | null;
  card: HTMLElement;
  cardBody: HTMLElement;
  note: HTMLElement | null;
  thread: SVGPathElement[];
  link: SVGGElement | null;
  lines: SVGPathElement[];
  dots: SVGCircleElement[];
  rail: HTMLElement | null;
  float: [number, number];
  drift: number;
  hover: { photo: boolean; card: boolean; on: boolean };
}

interface Refs {
  root: HTMLElement;
  stage: HTMLElement;
  head: HTMLElement[];
  lead: HTMLElement | null;
  swash: SVGPathElement[];
  node: HTMLElement;
  core: HTMLElement;
  ring: SVGSVGElement | null;
  ringPaths: SVGPathElement[];
  spokes: SVGPathElement[];
  words: HTMLElement[];
  map: SVGSVGElement | null;
  orbit: SVGPathElement | null;
  specks: SVGElement[];
  decor: HTMLElement | null;
  marks: SVGSVGElement[];
  notes: HTMLElement[];
  pen: SVGPathElement[];
  rail: HTMLElement | null;
  foot: HTMLElement | null;
  groups: Group[];
}

interface State {
  ready: boolean;
  inView: boolean;
}

/** Strokes carry pathLength="1", so a dash of 1 pushed along by 1 is a line not yet drawn. */
const UNDRAWN = { strokeDasharray: 1, strokeDashoffset: 1 };
const DRAW = { strokeDashoffset: 0, ease: 'power2.inOut' };

const all = <T extends Element = HTMLElement>(root: ParentNode, selector: string) =>
  Array.from(root.querySelectorAll<T>(selector));

const one = <T extends Element = HTMLElement>(root: ParentNode, selector: string) =>
  root.querySelector<T>(selector);

const present = <T>(items: (T | null | undefined)[]) =>
  items.filter((item): item is T => item != null);

/** The tilt a stylesheet gave an element through the `rotate` property. */
const tiltOf = (el: Element) => parseFloat(getComputedStyle(el).rotate) || 0;

/* --------------------------------------------------------------------------
   Collect
   -------------------------------------------------------------------------- */

function collect(root: HTMLElement): Refs | null {
  const stage = one(root, '[data-bm-stage]');
  const node = one(root, '[data-bm-node]');
  const core = one(root, '[data-bm-node-core]');
  if (!stage || !node || !core) return null;

  const groups = all(root, '[data-bm-exp]').flatMap<Group>((el) => {
    const id = el.dataset.bmExp ?? '';
    const photo = one(el, '[data-bm-photo]');
    const body = one(el, '[data-bm-body]');
    const frame = one(el, '[data-bm-frame]');
    const card = one(el, '[data-bm-card]');
    const cardBody = one(el, '[data-bm-card-body]');
    if (!photo || !body || !frame || !card || !cardBody) return [];

    const link = one<SVGGElement>(root, `[data-bm-link="${id}"]`);
    const [from = 0, to = 0] = (el.dataset.float ?? '').split(' ').map(Number);

    return [
      {
        id,
        el,
        photo,
        body,
        frame,
        card,
        cardBody,
        wash: one(el, '[data-bm-wash]'),
        img: one<HTMLImageElement>(el, 'img'),
        note: one(el, '[data-bm-note]'),
        thread: all<SVGPathElement>(el, '[data-bm-thread]'),
        link,
        lines: link ? all<SVGPathElement>(link, '[data-bm-draw]') : [],
        dots: link ? all<SVGCircleElement>(link, '[data-bm-dot]') : [],
        rail: one(root, `[data-bm-rail="${id}"]`),
        float: [from, to],
        drift: Number(el.dataset.drift ?? 0),
        hover: { photo: false, card: false, on: false },
      },
    ];
  });

  return {
    root,
    stage,
    node,
    core,
    groups,
    head: all(root, '[data-bm-copy="head"]'),
    lead: one(root, '[data-bm-copy="lead"]'),
    swash: all<SVGPathElement>(root, '.bm__swash [data-stroke]'),
    ring: one<SVGSVGElement>(root, '[data-bm-ring]'),
    ringPaths: all<SVGPathElement>(root, '[data-bm-ring] path'),
    spokes: all<SVGPathElement>(root, '[data-bm-spokes] path'),
    words: all(root, '[data-bm-word]'),
    map: one<SVGSVGElement>(root, '[data-bm-map]'),
    orbit: one<SVGPathElement>(root, '[data-bm-orbit]'),
    specks: all<SVGElement>(root, '[data-bm-speck]'),
    decor: one(root, '[data-bm-decor]'),
    marks: all<SVGSVGElement>(root, '.bm-mark'),
    notes: all(root, '[data-bm-note]'),
    pen: all<SVGPathElement>(root, '.bm-note__arrow [data-stroke], .bm-mark [data-stroke]'),
    rail: one(root, '[data-bm-rail-list]'),
    foot: one(root, '[data-bm-foot]'),
  };
}

/* --------------------------------------------------------------------------
   Reveal - the composed map
   --------------------------------------------------------------------------
   heading, lead, node, pencil lines, prints, cards, pen notes. One timeline,
   so the order holds however fast the reader arrives.
   -------------------------------------------------------------------------- */

function revealMap(r: Refs, state: State) {
  const tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    scrollTrigger: { trigger: r.stage, start: 'top 72%', once: true },
    onComplete: () => {
      state.ready = true;
    },
  });

  tl.from(r.head, { autoAlpha: 0, y: 30, duration: 1.1, ease: 'expo.out', stagger: 0.12 })
    .from(present([r.lead]), { autoAlpha: 0, y: 20, duration: 1 }, '-=0.8')
    .fromTo(r.swash, UNDRAWN, { ...DRAW, duration: 0.7, stagger: 0.14 }, '-=0.7');

  // The node draws itself, then its words settle inside the ring.
  tl.addLabel('node', '-=0.45')
    .fromTo(r.ringPaths, UNDRAWN, { ...DRAW, duration: 1.2, stagger: 0.2 }, 'node')
    .from(r.words, { autoAlpha: 0, y: 8, duration: 0.7, stagger: 0.08 }, 'node+=0.35')
    .from(
      present([r.orbit]),
      { autoAlpha: 0, rotation: -24, scale: 0.9, svgOrigin: '51 38.5', duration: 1.3, ease: 'expo.out' },
      'node+=0.25',
    );

  // Each line runs out from the node; its dots land as the pencil passes them.
  tl.addLabel('links', 'node+=0.7');
  r.groups.forEach((g, i) => {
    const at = 0.14 * i;
    tl.fromTo(g.lines, UNDRAWN, { ...DRAW, duration: 0.85 }, `links+=${at}`).from(
      g.dots,
      { scale: 0, transformOrigin: '50% 50%', duration: 0.5, ease: 'expo.out', stagger: 0.3 },
      `links+=${at + 0.4}`,
    );
  });
  tl.from(r.specks, { autoAlpha: 0, duration: 0.8, stagger: 0.04 }, 'links+=0.3');

  // Prints arrive in reading order, each card a beat behind its photograph.
  tl.addLabel('photos', 'links+=0.5');
  r.groups.forEach((g, i) => {
    const at = 0.16 * i;
    const lean = i % 2 ? 1 : -1;
    tl.from(g.body, { autoAlpha: 0, y: 40, rotation: lean * 4, duration: 1.2, ease: 'expo.out' }, `photos+=${at}`)
      .fromTo(
        g.frame,
        { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.out' },
        `photos+=${at}`,
      )
      .from(present([g.img]), { scale: 1.18, duration: 1.6, ease: 'expo.out' }, `photos+=${at}`)
      .from(present([g.wash]), { autoAlpha: 0, scale: 0.7, duration: 1.2, ease: 'expo.out' }, `photos+=${at + 0.1}`)
      .from(g.cardBody, { autoAlpha: 0, y: 18, rotation: -lean * 3, duration: 0.9 }, `photos+=${at + 0.38}`);
  });

  // Last, somebody annotates it.
  tl.addLabel('pen', 'photos+=1.05')
    .from(
      [...r.notes.flatMap((note) => Array.from(note.children)), ...r.marks],
      { autoAlpha: 0, y: 10, duration: 0.8, stagger: 0.08 },
      'pen',
    )
    .fromTo(r.pen, UNDRAWN, { ...DRAW, duration: 0.6, stagger: 0.08 }, 'pen+=0.2')
    .from(present([r.foot, r.rail]), { autoAlpha: 0, y: 12, duration: 0.8, stagger: 0.1 }, 'pen+=0.3');

  return tl;
}

/* --------------------------------------------------------------------------
   Reveal - the stacked layouts (tablet and phone)
   -------------------------------------------------------------------------- */

function revealStack(r: Refs) {
  gsap
    .timeline({ scrollTrigger: { trigger: r.stage, start: 'top 80%', once: true } })
    .from(r.head, { autoAlpha: 0, y: 26, duration: 1, ease: 'expo.out', stagger: 0.1 })
    .from(present([r.lead]), { autoAlpha: 0, y: 18, duration: 0.9 }, '-=0.7')
    .fromTo(r.swash, UNDRAWN, { ...DRAW, duration: 0.7 }, '-=0.6');

  gsap
    .timeline({ scrollTrigger: { trigger: r.node, start: 'top 85%', once: true } })
    .fromTo(r.ringPaths, UNDRAWN, { ...DRAW, duration: 1, stagger: 0.18 })
    .from(r.words, { autoAlpha: 0, y: 6, duration: 0.6, stagger: 0.07 }, '<0.3')
    .fromTo(r.spokes, UNDRAWN, { ...DRAW, duration: 0.6, stagger: 0.08 }, '<0.1');

  r.groups.forEach((g) => {
    gsap
      .timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: { trigger: g.el, start: 'top 82%', once: true },
      })
      .fromTo(g.thread, UNDRAWN, { ...DRAW, duration: 0.7 })
      .from(g.note ? Array.from(g.note.children) : [], { autoAlpha: 0, x: -8, duration: 0.6 }, '<0.2')
      .from(g.body, { autoAlpha: 0, y: 30, duration: 0.9 }, '<0.05')
      .fromTo(
        g.frame,
        { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.out' },
        '<',
      )
      .from(g.cardBody, { autoAlpha: 0, y: 20, duration: 0.8 }, '<0.25');
  });

  if (r.foot) {
    gsap.from(r.foot, {
      autoAlpha: 0,
      y: 14,
      duration: 0.8,
      scrollTrigger: { trigger: r.foot, start: 'top 92%', once: true },
    });
  }
}

/* --------------------------------------------------------------------------
   Reveal - reduced motion: fades, nothing that travels
   -------------------------------------------------------------------------- */

function fadeIn(r: Refs) {
  const targets = present<Element>([
    ...r.head,
    r.lead,
    r.node,
    r.map,
    r.decor,
    ...r.groups.flatMap((g) => [g.photo, g.card, g.note]),
    r.rail,
    r.foot,
  ]);

  gsap.set(targets, { autoAlpha: 0 });
  ScrollTrigger.batch(targets, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, duration: 0.6, stagger: 0.05, ease: 'none' }),
  });
}

/* --------------------------------------------------------------------------
   Float - each print sways on its own clock, only while the map is on screen
   -------------------------------------------------------------------------- */

function float(r: Refs, state: State) {
  const sways = r.groups.map((g) =>
    gsap.fromTo(
      g.photo,
      { rotation: g.float[0] },
      {
        rotation: g.float[1],
        duration: gsap.utils.random(4, 6),
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        paused: true,
      },
    ),
  );

  ScrollTrigger.create({
    trigger: r.stage,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      state.inView = self.isActive;
      sways.forEach((sway) => (self.isActive ? sway.play() : sway.pause()));
    },
  });
}

/* --------------------------------------------------------------------------
   Shake - every five to eight seconds, one print (never the same one twice
   running, never the one under the pointer) is nudged and settles
   -------------------------------------------------------------------------- */

function shake(r: Refs, state: State, track: Track): Off {
  let last = -1;
  let timer: gsap.core.Tween | null = null;

  const nudge = track('bmNudge', () => {
    const pool = r.groups.map((_, i) => i).filter((i) => i !== last && !r.groups[i].hover.on);

    if (state.ready && state.inView && !document.hidden && pool.length) {
      const i = pool[Math.floor(Math.random() * pool.length)];
      const { body } = r.groups[i];
      const a = gsap.utils.random(0.8, 1.15);
      const step = gsap.utils.random(0.25, 0.36) / 4;
      last = i;

      gsap
        .timeline({ defaults: { ease: 'sine.inOut', duration: step } })
        .to(body, { rotation: -2 * a, x: -2 })
        .to(body, { rotation: 2 * a, x: 2 })
        .to(body, { rotation: -1 * a, x: -1 })
        .to(body, { rotation: 0, x: 0, duration: step * 1.5, ease: 'power2.out' });
    }

    timer = gsap.delayedCall(gsap.utils.random(5, 8), nudge);
  });

  timer = gsap.delayedCall(gsap.utils.random(5, 8), nudge);
  return () => timer?.kill();
}

/* --------------------------------------------------------------------------
   Hover - a print lifts and straightens, its card rises, its line darkens and
   the node answers. Focus inside a card does the same for the keyboard.
   -------------------------------------------------------------------------- */

function hover(r: Refs, track: Track, pointer: boolean): Off {
  const pulse = track('bmPulse', (g: Group) => {
    gsap.fromTo(
      g.dots,
      { scale: 1 },
      { scale: 1.4, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 1, transformOrigin: '50% 50%', stagger: 0.06 },
    );
    gsap.fromTo(r.core, { scale: 1 }, { scale: 1.035, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 1 });
    if (r.ring) gsap.to(r.ring, { rotation: '+=10', duration: 1.2, ease: 'power3.out' });
  });

  const render = track('bmRender', (g: Group) => {
    const { photo: onPhoto, card: onCard } = g.hover;
    const on = onPhoto || onCard;
    const settle = { duration: 0.5, ease: 'power3.out', overwrite: 'auto' as const };

    gsap.to(g.body, {
      scale: onPhoto ? 1.04 : onCard ? 1.015 : 1,
      y: onPhoto ? -5 : onCard ? -2 : 0,
      // The print's tilt lives in CSS; counter most of it rather than all.
      rotation: onPhoto ? -tiltOf(g.photo) * 0.85 : 0,
      x: 0,
      ...settle,
    });
    gsap.to(g.cardBody, {
      y: onCard ? -5 : onPhoto ? -3 : 0,
      rotation: onCard ? -tiltOf(g.card) * 0.9 : 0,
      ...settle,
    });

    g.el.classList.toggle('is-active', on);
    g.el.classList.toggle('is-card', onCard);
    g.link?.classList.toggle('is-on', on);
    if (on && !g.hover.on) pulse(g);
    g.hover.on = on;
    r.node.classList.toggle('is-on', r.groups.some((group) => group.hover.on));
  });

  const offs: Off[] = [];
  const listen = (el: Element, type: string, fn: () => void) => {
    el.addEventListener(type, fn);
    offs.push(() => el.removeEventListener(type, fn));
  };

  r.groups.forEach((g) => {
    const set = (key: 'photo' | 'card', value: boolean) => () => {
      if (g.hover[key] === value) return;
      g.hover[key] = value;
      render(g);
    };

    if (pointer) {
      listen(g.photo, 'pointerenter', set('photo', true));
      listen(g.photo, 'pointerleave', set('photo', false));
      listen(g.card, 'pointerenter', set('card', true));
      listen(g.card, 'pointerleave', set('card', false));
    }
    listen(g.card, 'focusin', set('card', true));
    listen(g.card, 'focusout', set('card', false));
  });

  return () => {
    offs.forEach((off) => off());
    r.node.classList.remove('is-on');
    r.groups.forEach((g) => {
      g.hover = { photo: false, card: false, on: false };
      g.el.classList.remove('is-active', 'is-card');
      g.link?.classList.remove('is-on');
    });
  };
}

/* --------------------------------------------------------------------------
   Parallax - pointer-led, a few pixels, deeper layers moving further
   -------------------------------------------------------------------------- */

function parallax(r: Refs): Off {
  const layers: [Element | null, number][] = [
    [r.decor, 3],
    [r.map, 5],
    [r.node, 4],
    ...r.groups.flatMap((g, i): [Element | null, number][] => [
      [g.note, 3],
      [g.photo, 6 + (i % 3) * 2],
      [g.card, 8 + ((i + 1) % 3) * 2],
    ]),
  ];

  const movers = layers
    .filter((layer): layer is [Element, number] => layer[0] != null)
    .map(([el, depth]) => ({
      depth,
      x: gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3.out' }),
    }));

  const move = (event: PointerEvent) => {
    const box = r.stage.getBoundingClientRect();
    const nx = ((event.clientX - box.left) / box.width - 0.5) * 2;
    const ny = ((event.clientY - box.top) / box.height - 0.5) * 2;
    movers.forEach((m) => {
      m.x(nx * m.depth);
      m.y(ny * m.depth);
    });
  };
  const rest = () =>
    movers.forEach((m) => {
      m.x(0);
      m.y(0);
    });

  r.stage.addEventListener('pointermove', move);
  r.stage.addEventListener('pointerleave', rest);
  return () => {
    r.stage.removeEventListener('pointermove', move);
    r.stage.removeEventListener('pointerleave', rest);
  };
}

/* --------------------------------------------------------------------------
   Drift - the prints slide a few percent against the scroll
   -------------------------------------------------------------------------- */

function drift(r: Refs) {
  r.groups.forEach((g) => {
    gsap.fromTo(
      g.photo,
      { yPercent: g.drift },
      {
        yPercent: -g.drift,
        ease: 'none',
        scrollTrigger: { trigger: r.stage, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      },
    );
  });
}

/* --------------------------------------------------------------------------
   Activate - while the map crosses the middle of the screen, the four
   experiences light up in reading order. No pin: the page keeps scrolling.
   -------------------------------------------------------------------------- */

function activate(r: Refs, track: Track): Off {
  let lit = -1;

  const light = track('bmLight', (index: number) => {
    if (index === lit) return;
    lit = index;
    r.groups.forEach((g, i) => {
      const on = i === index;
      g.el.classList.toggle('is-lit', on);
      g.link?.classList.toggle('is-lit', on);
      g.rail?.classList.toggle('is-lit', on);
    });
    const g = r.groups[index];
    if (g) {
      gsap.fromTo(
        g.dots,
        { scale: 1 },
        { scale: 1.4, duration: 0.24, ease: 'power2.out', yoyo: true, repeat: 1, transformOrigin: '50% 50%' },
      );
    }
  });

  ScrollTrigger.create({
    trigger: r.stage,
    start: 'top 30%',
    end: 'bottom 70%',
    onUpdate: (self) =>
      light(Math.min(r.groups.length - 1, Math.floor(self.progress * r.groups.length))),
    onToggle: (self) => {
      if (!self.isActive) light(-1);
    },
  });

  return () => {
    r.groups.forEach((g) => {
      g.el.classList.remove('is-lit');
      g.link?.classList.remove('is-lit');
      g.rail?.classList.remove('is-lit');
    });
  };
}

/* --------------------------------------------------------------------------
   Entry
   -------------------------------------------------------------------------- */

export function animateBeyond(root: HTMLElement): Off | undefined {
  const r = collect(root);
  if (!r) return undefined;

  const mm = gsap.matchMedia();

  mm.add(
    {
      wide: '(min-width: 1180px)',
      fine: '(hover: hover) and (pointer: fine)',
      reduce: '(prefers-reduced-motion: reduce)',
    },
    (context) => {
      const { wide, fine, reduce } = context.conditions ?? {};
      // Anything created later - in a handler, on a timer - is recorded
      // against this context too, so a breakpoint change reverts it cleanly.
      const track: Track = (name, fn) => context.add(name, fn) as unknown as typeof fn;

      if (reduce) {
        fadeIn(r);
        return undefined;
      }

      const state: State = { ready: false, inView: false };
      const offs: Off[] = [];

      if (wide) {
        revealMap(r, state);
        drift(r);
        float(r, state);
        offs.push(shake(r, state, track), activate(r, track));
        if (fine) offs.push(parallax(r));
      } else {
        revealStack(r);
      }

      offs.push(hover(r, track, Boolean(fine)));
      return () => offs.forEach((off) => off());
    },
  );

  return () => mm.revert();
}
