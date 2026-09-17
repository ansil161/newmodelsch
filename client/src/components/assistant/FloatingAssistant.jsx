import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { onStage } from '@/lib/stage';
import { cx } from '@/utils';
import { ChatButton } from './ChatButton';
import { ChatPanel } from './ChatPanel';
import { askChat } from './responder';
import { useConversation } from './useConversation';
import './assistant.css';

/* ==========================================================================
   FLOATING ASSISTANT
   --------------------------------------------------------------------------
   One brand-ink Chat button in the bottom-right corner, and the panel it opens.

   WHAT IT DOES NOT TOUCH

   Everything here is `position: fixed` and mounted once in the Shell, outside
   `<main>`. It adds no height to the document, no transform to any ancestor
   of a pinned section, and no ScrollTrigger, so nothing the page choreographs
   can be moved by it.

   CLOSING

     Escape            closes, and focus goes back to the button
     the × or button   the same
     a click outside   closes, and focus stays where the visitor clicked
     a route change    closes - an answer about Admissions left open over the
                       Contact page is an answer to a question nobody asked

   ENTRANCE

   The button arrives once, after the page does. It waits on the stage, so on
   a first visit it lands after the brand transition rather than behind it,
   and it starts hidden only when it is about to animate - with motion reduced
   it is simply there.
   ========================================================================== */

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const chat = useConversation(askChat);

  const root = useRef(null);
  const dock = useRef(null);
  const trigger = useRef(null);
  const panelId = useId();
  const { pathname } = useLocation();

  const close = useCallback(
    (returnFocus) => {
      // Before the state change, so focus is never stranded inside a panel
      // that is about to become inert.
      if (returnFocus && open) trigger.current?.focus({ preventScroll: true });
      setOpen(false);
    },
    [open],
  );

  const toggle = () => {
    if (open) close(true);
    else setOpen(true);
  };

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event) => {
      if (event.key === 'Escape') close(true);
    };
    const onPointer = (event) => {
      if (!root.current?.contains(event.target)) close(false);
    };

    document.addEventListener('keydown', onKey);
    // Capture, so a control that stops propagation still counts as outside.
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [open, close]);

  useIsomorphicLayoutEffect(() => {
    const el = dock.current;
    if (!el || reduced()) return;

    const ctx = gsap.context(() => {
      gsap.set(el, { autoAlpha: 0, y: 14 });
    });
    const release = onStage(() =>
      ctx.add(() => {
        gsap.to(el, {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          delay: 0.5,
          ease: 'power3.out',
          clearProps: 'opacity,visibility,transform',
        });
      }),
    );

    return () => {
      release();
      ctx.revert();
    };
  }, []);

  return (
    <div ref={root} className={cx('fa', open && 'is-open')}>
      <div className="fa-dock">
        <div ref={dock} className="fa-dock__row">
          <ChatButton ref={trigger} active={open} controls={panelId} onClick={toggle} />
        </div>
      </div>

      <ChatPanel id={panelId} mode="chat" open={open} conversation={chat} onClose={() => close(true)} />
    </div>
  );
}
