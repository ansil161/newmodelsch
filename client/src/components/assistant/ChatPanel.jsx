import { useId, useRef } from 'react';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { cx } from '@/utils';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';

const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * The panel the chat button opens. One element, always mounted, so it can play
 * its closing animation - an unmounted panel cannot fade out - and so the
 * page never pays for mounting it on the first click.
 *
 * NON-MODAL ON PURPOSE. It is a dialog the page stays usable around: nothing
 * is made inert behind it and scrolling is not locked, because a parent asking
 * "which board is it?" is usually reading the page the answer is about. It is
 * `inert` itself while closed, so none of its controls sit in the tab order
 * of every page on the site.
 *
 * TWO TRANSITIONS, ONE EFFECT.
 *
 *   OPEN     fades up 20px with a hint of scale, out of the dock's corner.
 *   CLOSE    the same, reversed and quicker - leaving is not an event.
 */
export function ChatPanel({ id, mode, open, conversation, onClose }) {
  const panel = useRef(null);
  const inner = useRef(null);
  const input = useRef(null);
  const titleId = useId();
  const previous = useRef(null);

  useIsomorphicLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;

    const before = previous.current;
    previous.current = { open, mode };

    // First run: closed is the resting state, and it is set before first paint.
    if (!before) {
      if (!open) gsap.set(el, { autoAlpha: 0 });
      return;
    }

    // A keyboard on a phone is half the screen. On touch the panel itself
    // takes focus, so a screen reader lands in it without the keyboard
    // jumping up over the answer the parent opened it to read.
    const focusStart = () => (finePointer() ? input.current : el)?.focus({ preventScroll: true });

    if (open && !before.open) {
      gsap.killTweensOf(el);
      // Visibility first and on its own, so the focus below lands on
      // something the browser considers visible.
      gsap.set(el, { visibility: 'visible' });

      if (reduced()) {
        gsap.set(el, { opacity: 1, y: 0, scale: 1 });
      } else {
        gsap.fromTo(
          el,
          { opacity: 0, y: 20, scale: 0.98 },
          { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' },
        );
        const chips = el.querySelectorAll('.fa-chip');
        if (chips.length) {
          gsap.fromTo(
            chips,
            { opacity: 0, y: 6 },
            {
              opacity: 1,
              y: 0,
              duration: 0.4,
              ease: 'power2.out',
              stagger: 0.045,
              delay: 0.14,
              // Handed back to the stylesheet, which owns the hover lift.
              clearProps: 'opacity,transform',
            },
          );
        }
      }
      focusStart();
    } else if (!open && before.open) {
      gsap.killTweensOf(el);
      if (reduced()) {
        gsap.set(el, { autoAlpha: 0 });
      } else {
        gsap.to(el, {
          opacity: 0,
          y: 12,
          scale: 0.985,
          duration: 0.24,
          ease: 'power2.in',
          onComplete: () => {
            gsap.set(el, { visibility: 'hidden' });
          },
        });
      }
    } else if (open && mode !== before.mode) {
      if (!reduced() && inner.current) {
        gsap.fromTo(
          inner.current,
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out', clearProps: 'opacity,transform' },
        );
      }
      focusStart();
    }
  }, [open, mode]);

  return (
    <section
      ref={panel}
      id={id}
      className={cx('fa-panel', `fa-panel--${mode}`)}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      inert={!open}
    >
      {/* Keyed by mode: each service mounts its own header, thread and
          composer, which is what lets the switch cross-fade. */}
      <div key={mode} ref={inner} className="fa-panel__inner">
        <ChatHeader mode={mode} titleId={titleId} onClose={onClose} />
        <ChatMessages
          mode={mode}
          messages={conversation.messages}
          pending={conversation.pending}
          onSuggest={conversation.send}
        />
        <ChatInput
          mode={mode}
          value={conversation.draft}
          onChange={conversation.setDraft}
          onSubmit={conversation.submit}
          busy={conversation.pending}
          inputRef={input}
        />
      </div>
    </section>
  );
}
