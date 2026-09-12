import { useCallback, useEffect, useRef, useState } from 'react';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { draw, lines, reduced, rise } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Figure } from './Figure';

/* ==========================================================================
   QUOTE SECTION - what people actually said
   --------------------------------------------------------------------------
   The site's testimonial treatment, and it is deliberately not a card.

   A row of three quote cards is the most reliable way to make a real thing a
   parent said read as marketing copy: three of them, all the same length, all
   the same weight, arranged like a pricing table. Here there is one quote at
   a time, set at display scale, with a face and a name under it. It is the
   size that does the work - a sentence set this large is being read out, not
   displayed.

   HOW IT MOVES BETWEEN THEM

   The quotes advance horizontally: the outgoing one leaves to the left while
   the incoming one arrives from the right, on a short overlap. There is no
   auto-advance. A quote that changes itself while a parent is halfway through
   reading it is a quote they will not finish, and every carousel that does it
   is optimising for the impression of activity over the person reading.

   ACCESSIBILITY, WHICH IS THE HARD PART OF A CAROUSEL

     - The whole thing is a labelled group with `aria-roledescription`.
     - Only the current quote is in the accessibility tree; the others are
       `inert`, so tabbing does not walk into an off-screen slide.
     - The live region announces "Quote 3 of 8" on change, politely.
     - Arrow keys move it, and the buttons are real buttons with real labels.
   ========================================================================== */

export interface QuoteEntry {
  id: string;
  quote: string;
  name: string;
  /** 'Parent, Class 7' - the relationship, which is what makes it evidence. */
  role: string;
  photo?: Photo;
  /** Optional grouping shown as a tag: Parents, Students, Alumni, Teachers. */
  group?: string;
}

interface QuoteSectionProps {
  entries: QuoteEntry[];
  className?: string;
  id?: string;
}

export function QuoteSection({ entries, className = '', id }: QuoteSectionProps) {
  const [index, setIndex] = useState(0);
  const previous = useRef(0);
  const slides = useRef<(HTMLLIElement | null)[]>([]);

  const go = useCallback(
    (next: number) => {
      setIndex(((next % entries.length) + entries.length) % entries.length);
    },
    [entries.length],
  );

  const scope = useGsapScope<HTMLElement>((_, el) => {
    const first = el.querySelector<HTMLElement>('.quote__text');
    if (first) lines(first, { trigger: el });
    draw(el, { trigger: el, delay: 0.5 });
    rise(el.querySelectorAll<HTMLElement>('[data-lift]'), { trigger: el, delay: 0.45 });
  }, []);

  // The transition between quotes. Imperative because it is a hand-off
  // between two elements, and expressing that as declarative state means
  // holding "which one is leaving" in React for the length of an animation.
  useEffect(() => {
    if (reduced()) {
      previous.current = index;
      return;
    }
    const from = slides.current[previous.current];
    const to = slides.current[index];
    if (!to || from === to) {
      previous.current = index;
      return;
    }

    const forward = index > previous.current || (previous.current === entries.length - 1 && index === 0);
    const dir = forward ? 1 : -1;

    if (from) {
      gsap.to(from, {
        xPercent: -12 * dir,
        autoAlpha: 0,
        duration: 0.42,
        ease: 'power2.in',
        overwrite: 'auto',
      });
    }
    gsap.fromTo(
      to,
      { xPercent: 14 * dir, autoAlpha: 0 },
      { xPercent: 0, autoAlpha: 1, duration: 0.66, ease: 'power3.out', delay: 0.12, overwrite: 'auto' },
    );

    previous.current = index;
  }, [index, entries.length]);

  const current = entries[index];

  return (
    <section
      ref={scope}
      id={id}
      className={`quote ${className}`.trim()}
      aria-roledescription="carousel"
      aria-label="What families, students and staff say"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          go(index + 1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          go(index - 1);
        }
      }}
    >
      <ul className="quote__stage">
        {entries.map((entry, i) => (
          <li
            key={entry.id}
            ref={(node) => {
              slides.current[i] = node;
            }}
            className={`quote__slide${i === index ? ' is-current' : ''}`}
            // `inert` keeps the off-screen quotes out of the tab order and out
            // of the accessibility tree entirely - the thing a carousel built
            // with `opacity: 0` always gets wrong.
            inert={i !== index}
            aria-hidden={i === index ? undefined : true}
          >
            <figure className="quote__fig">
              <blockquote className="quote__text ed-h1">{entry.quote}</blockquote>
              <figcaption className="quote__by">
                {entry.photo ? (
                  <Figure
                    photo={entry.photo}
                    width={140}
                    widths={[140, 280]}
                    sizes="70px"
                    shape="round"
                    ratio="square-ar"
                    className="quote__face"
                    decorative
                  />
                ) : null}
                <span className="quote__who">
                  <b className="quote__name">{entry.name}</b>
                  <span className="meta">{entry.role}</span>
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>

      <div className="quote__bar" data-lift>
        <p className="quote__count meta" aria-hidden="true">
          <span>{String(index + 1).padStart(2, '0')}</span>
          <i />
          <span>{String(entries.length).padStart(2, '0')}</span>
        </p>

        <div className="quote__nav">
          <button
            type="button"
            className="quote__btn"
            onClick={() => go(index - 1)}
            aria-label="Previous quote"
          >
            <Icon name="arrowRight" size={18} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button
            type="button"
            className="quote__btn"
            onClick={() => go(index + 1)}
            aria-label="Next quote"
          >
            <Icon name="arrowRight" size={18} />
          </button>
        </div>

        {current.group ? <span className="chip quote__group">{current.group}</span> : null}
      </div>

      {/* Politely announced, so a screen-reader user who presses Next hears
          what happened without the page shouting over whatever else it was
          reading. */}
      <p className="sr-only" aria-live="polite">
        Quote {index + 1} of {entries.length}. {current.name}, {current.role}.
      </p>
    </section>
  );
}
