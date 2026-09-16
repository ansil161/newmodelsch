import { useRef, useState } from 'react';
import { gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { useGsapScope } from '@/hooks/useGsapScope';
import { rise } from '@/lib/motion';

export function EditorialAccordion({
  items,
  multiple = false,
  initial = -1,
  className = '',
  id,
}) {
  const [open, setOpen] = useState(initial >= 0 ? [initial] : []);
  const panels = useRef([]);

  const scope = useGsapScope((_, el) => {
    rise(el.querySelectorAll('.acc__row'), { trigger: el, y: 18, stagger: 0.05 });
  }, [items]);

  const toggle = (i) => {
    const isOpen = open.includes(i);
    const next = isOpen
      ? open.filter((n) => n !== i)
      : multiple
        ? [...open, i]
        : [i];

    // Animate what is changing, then commit the state. Doing it in this order
    // means the panel being closed is still measurable at the moment the
    // tween is built.
    if (!reduced()) {
      if (isOpen) {
        collapse(panels.current[i]);
      } else {
        if (!multiple) open.forEach((n) => collapse(panels.current[n]));
        expand(panels.current[i]);
      }
    }

    setOpen(next);
  };

  return (
    <div ref={scope} id={id} className={`acc ${className}`.trim()}>
      {items.map((item, i) => {
        const isOpen = open.includes(i);
        return (
          <div className={`acc__row${isOpen ? ' is-open' : ''}`} key={item.id}>
            <h3 className="acc__heading">
              <button
                type="button"
                className="acc__q"
                aria-expanded={isOpen}
                aria-controls={`${item.id}-answer`}
                id={`${item.id}-question`}
                onClick={() => toggle(i)}
              >
                <span className="acc__q-text ed-h3">{item.question}</span>
                {item.tag ? <span className="acc__tag meta">{item.tag}</span> : null}
                <span className="acc__mark" aria-hidden="true">
                  <i />
                  <i />
                </span>
              </button>
            </h3>

            <div
              className="acc__panel"
              id={`${item.id}-answer`}
              role="region"
              aria-labelledby={`${item.id}-question`}
              hidden={!isOpen}
              ref={(node) => {
                panels.current[i] = node;
              }}
            >
              <div className="acc__answer">{item.answer}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------------
   The two height tweens.

   `hidden` is toggled by React on the same commit, so each of these has to
   clear it before it can measure - which is why `expand` sets `hidden = false`
   itself rather than waiting for the render.
   -------------------------------------------------------------------------- */

function expand(panel) {
  if (!panel) return;
  panel.hidden = false;
  const inner = panel.firstElementChild;
  const target = inner?.scrollHeight ?? panel.scrollHeight;

  gsap.fromTo(
    panel,
    { height: 0, opacity: 0 },
    {
      height: target,
      opacity: 1,
      duration: 0.5,
      ease: 'power3.out',
      overwrite: 'auto',
      // Released to auto so a later reflow - a font swap, a rotate, a resize -
      // cannot leave the answer clipped at yesterday's measurement.
      onComplete: () => gsap.set(panel, { height: 'auto' }),
    },
  );

  if (inner) {
    gsap.fromTo(
      inner,
      { y: 12 },
      { y: 0, duration: 0.6, ease: 'power3.out', overwrite: 'auto' },
    );
  }
}

function collapse(panel) {
  if (!panel) return;
  gsap.to(panel, {
    height: 0,
    opacity: 0,
    duration: 0.38,
    ease: 'power2.inOut',
    overwrite: 'auto',
    onComplete: () => {
      panel.hidden = true;
      gsap.set(panel, { clearProps: 'height,opacity' });
    },
  });
}
