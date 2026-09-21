/**
 * Single GSAP entry point. Every module imports gsap and its plugins from
 * here, so plugins are registered exactly once and tree-shaking stays
 * predictable.
 *
 * Draggable and InertiaPlugin's free counterpart are registered because the
 * horizontal strips on this site are draggable as well as scrollable - a
 * photo wall a parent can only reach by scrolling is a photo wall half of
 * them will not reach.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Draggable } from 'gsap/Draggable';
import { Observer } from 'gsap/Observer';
import { CustomEase } from 'gsap/CustomEase';

/* ONE BREAKPOINT CROSSING, ONE REFRESH.

   Every `gsap.matchMedia().add(query)` on the site registers GSAP's media
   handler on its own MediaQueryList, and when a tablet turns or a window is
   dragged past 900px, the browser fires every list that flipped, one after
   another. GSAP only merges changes that land within 2ms of each other - but
   each call runs a full revert-and-refresh of every ScrollTrigger on the page
   synchronously, so the next one always lands later, and a single rotation
   became seven complete refreshes back to back (about two seconds of frozen
   main thread on the homepage, measured on a desktop CPU). The first call has
   already applied every flipped query; the other six re-did its work.

   So the handler's calls are collected and run once, on the next task, by
   which time every list has flipped and one pass sees them all. This is
   scoped to the legacy `addListener` API, which GSAP registers with and
   nothing else here uses (the site's own media queries use
   `addEventListener`, and are left untouched). */
function coalesceMediaListeners() {
  const proto = window.MediaQueryList?.prototype;
  if (!proto?.addListener || proto.addListener.__coalesced) return;

  const add = proto.addListener;
  const remove = proto.removeListener;
  const wrappers = new WeakMap();
  const queued = new Set();

  const wrap = (fn) => {
    let wrapper = wrappers.get(fn);
    if (!wrapper) {
      wrapper = () => {
        if (queued.has(fn)) return;
        queued.add(fn);
        window.setTimeout(() => {
          queued.delete(fn);
          fn();
        }, 0);
      };
      wrappers.set(fn, wrapper);
    }
    return wrapper;
  };

  proto.addListener = function addListener(fn) {
    return add.call(this, typeof fn === 'function' ? wrap(fn) : fn);
  };
  proto.addListener.__coalesced = true;
  proto.removeListener = function removeListener(fn) {
    return remove.call(this, wrappers.get(fn) ?? fn);
  };
}

if (typeof window !== 'undefined') {
  coalesceMediaListeners();
  gsap.registerPlugin(ScrollTrigger, SplitText, Draggable, Observer, CustomEase);

  /* A CSS cubic-bezier, available to GSAP by name.
     `cubic-bezier(x1,y1,x2,y2)` and `M0,0 C{x1},{y1} {x2},{y2} 1,1` describe
     the same curve, so a curve chosen in a stylesheet and the tween that has
     to match it are one definition rather than two that drift. Registered
     here because this file is where anything global to GSAP is declared
     exactly once. */
  CustomEase.create('ease-out-quint', 'M0,0 C0.22,1 0.36,1 1,1');

  gsap.defaults({ ease: 'power3.out', duration: 0.9 });

  // ScrollTrigger recalculates on resize; ignoring the mobile address-bar
  // resize avoids a full refresh every time the browser chrome collapses.
  ScrollTrigger.config({ ignoreMobileResize: true });

  // Pins must be measured in page order: each one adds scroll length that
  // every trigger below it has to include. ScrollTrigger measures in creation
  // order, which is page order on first load - but a `gsap.matchMedia` block
  // rebuilt after a rotation creates its pin last, so a rebuilt pin near the
  // top was measured after the pins below it and they overlapped. Re-sorting
  // at the start of every refresh restores page order (refreshPriority first,
  // then position) wherever a rebuild happens.
  ScrollTrigger.addEventListener('refreshInit', () => ScrollTrigger.sort());
}

export { gsap, ScrollTrigger, SplitText, Draggable, Observer, CustomEase };
