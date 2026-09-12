import type { ReactNode } from 'react';
import { useGsapScope } from '@/hooks/useGsapScope';
import { draw, lines, rise } from '@/lib/motion';
import { Sticker } from './primitives';

/* ==========================================================================
   SECTION HEAD
   --------------------------------------------------------------------------
   The opening of a section: a sticker, a serif statement, and optionally a
   paragraph of lead. It is one component rather than three because the timing
   between the three is the thing that has to be right, and getting it right
   by hand in forty sections means getting it wrong in some of them.

   THE CHOREOGRAPHY, WHICH IS THE POINT

     0.00  the sticker lands, slightly late off the mark
     0.10  the headline arrives line by line from under its mask
     0.55  the highlighter is drawn under the marked word
     0.60  the lead and anything after it rises

   The mark landing *after* the headline has settled is what makes it read as
   someone marking the sentence having written it, rather than as one more
   thing sliding in. It is the single most characteristic beat on the site.

   ALIGNMENT

   `align` is a composition decision, not a content one. The default is left,
   because this is an editorial layout and centred type in an asymmetric grid
   reads as a slide deck. `centre` exists for the two or three places that are
   genuinely a title card.
   ========================================================================== */

interface SectionHeadProps {
  sticker?: ReactNode;
  stickerTone?: 'sun' | 'blue' | 'green' | 'coral' | 'ink' | 'paper';
  stickerTilt?: number;
  /** The serif statement. Pass `<Mark>` inside it to have a word drawn on. */
  title: ReactNode;
  /** Rendered as the given heading level; the size is set by `size`. */
  as?: 'h1' | 'h2' | 'h3';
  size?: 'mega' | 'hero' | 'h1' | 'h2' | 'h3';
  lead?: ReactNode;
  /** Buttons, links, a fact row - anything that follows the lead. */
  children?: ReactNode;
  align?: 'left' | 'centre';
  className?: string;
  id?: string;
}

export function SectionHead({
  sticker,
  stickerTone = 'sun',
  stickerTilt = -2.2,
  title,
  as: Tag = 'h2',
  size = 'h1',
  lead,
  children,
  align = 'left',
  className = '',
  id,
}: SectionHeadProps) {
  const scope = useGsapScope<HTMLDivElement>((_, el) => {
    const head = el.querySelector<HTMLElement>('[data-sh-title]');
    const tag = el.querySelector<HTMLElement>('[data-sh-sticker]');
    const tail = el.querySelectorAll<HTMLElement>('[data-sh-tail] > *');

    if (tag) rise(tag, { trigger: el, y: 14, delay: 0 });
    if (head) lines(head, { trigger: el, delay: 0.1 });
    draw(el, { trigger: el, delay: 0.55 });
    if (tail.length) rise(tail, { trigger: el, delay: 0.6, y: 20 });
  }, []);

  return (
    <div
      ref={scope}
      id={id}
      className={`sec-head${align === 'centre' ? ' sec-head--centre' : ''} ${className}`.trim()}
    >
      {sticker ? (
        <div data-sh-sticker className="sec-head__tag">
          <Sticker tone={stickerTone} tilt={stickerTilt}>
            {sticker}
          </Sticker>
        </div>
      ) : null}

      <Tag data-sh-title className={`ed-${size} sec-head__title`}>
        {title}
      </Tag>

      {lead || children ? (
        <div data-sh-tail className="sec-head__tail">
          {lead ? <p className="lead sec-head__lead">{lead}</p> : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}
