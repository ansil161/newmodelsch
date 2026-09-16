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

if (typeof window !== 'undefined') {
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
}

export { gsap, ScrollTrigger, SplitText, Draggable, Observer, CustomEase };
