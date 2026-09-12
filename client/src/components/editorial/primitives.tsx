import type { ElementType, ReactNode } from 'react';

/* ==========================================================================
   PRIMITIVES
   --------------------------------------------------------------------------
   The five smallest pieces of the design language. They are components rather
   than bare class names for one reason: each of them encodes a decision that
   is easy to get wrong by hand, and putting the decision in a component means
   it is made once.

     Ed        a statement, in the serif. Picks its own tag and its own size.
     Mark      a word the page draws on. Three strokes, one meaning each.
     Sticker   the section label, as a piece of cut paper.
     Meta      the mono metadata line.
     Rule      a hairline, optionally one the reader draws.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Ed - the serif statement
   --------------------------------------------------------------------------
   `as` is the heading level, which is a document-outline decision. `size` is
   how big it looks, which is a design decision. They are separate props
   because the two are genuinely unrelated: the third <h2> down a page is
   still an <h2> even when the composition wants it at hero scale, and coupling
   them is how sites end up with an <h1> per section.
   -------------------------------------------------------------------------- */

type EdSize = 'mega' | 'hero' | 'h1' | 'h2' | 'h3';

interface EdProps {
  as?: ElementType;
  size?: EdSize;
  className?: string;
  children: ReactNode;
  id?: string;
}

export function Ed({ as: Tag = 'h2', size = 'h2', className = '', children, id }: EdProps) {
  return (
    <Tag id={id} className={`ed-${size} ${className}`.trim()}>
      {children}
    </Tag>
  );
}

/** The italic of the same face. Emphasis inside a serif line is never a
 *  second family - a sans word dropped into a serif headline is the move to
 *  avoid. */
export function Em({ children }: { children: ReactNode }) {
  return <em className="ed-em">{children}</em>;
}

/* --------------------------------------------------------------------------
   Mark - a word the page draws on
   --------------------------------------------------------------------------
   Three strokes, and they are not interchangeable:

     high      a highlighter sweep behind the word. The word stays ink, so the
               sentence still reads at speed. The default, and the one to
               reach for on a short word inside a long line.
     underline a hand-drawn rule beneath it. For a phrase long enough that a
               highlighter would fill half the line, and for any word sitting
               over a photograph, where a filled sweep would fight the image.
     ring      a circle around it. Once a page, at most. It is the loudest
               mark on the site and it stops meaning anything the second time.

   All three rest at their drawn state and are animated by `--mark-scale`, so
   a page with motion off shows a marked-up headline rather than a bare one.
   -------------------------------------------------------------------------- */

interface MarkProps {
  kind?: 'high' | 'underline' | 'ring';
  tone?: 'sun' | 'blue' | 'green' | 'coral';
  children: ReactNode;
}

export function Mark({ kind = 'high', tone = 'sun', children }: MarkProps) {
  const base = kind === 'underline' ? 'mark-ul' : kind === 'ring' ? 'mark-ring' : 'mark';
  // Only the highlighter has tone variants; a coral underline and a coral
  // ring both read as an error state rather than as emphasis.
  const toned = kind === 'high' && tone !== 'sun' ? ` mark--${tone}` : '';
  return <span className={`${base}${toned}`}>{children}</span>;
}

/* --------------------------------------------------------------------------
   Sticker - the section label
   --------------------------------------------------------------------------
   A torn paper tag, rotated a degree or two. What it replaced was an
   uppercase mono eyebrow behind a short rule, which is the correct and
   invisible solution; this one is the school's voice - the thing a teacher
   would have stuck on the noticeboard.

   `tilt` is exposed because a column of stickers all leaning the same way
   reads as a rendering artefact. Alternate the sign down a page.
   -------------------------------------------------------------------------- */

interface StickerProps {
  children: ReactNode;
  tone?: 'sun' | 'blue' | 'green' | 'coral' | 'ink' | 'paper';
  /** Degrees. Keep it under about 3.5 - past that it reads as broken. */
  tilt?: number;
  className?: string;
}

export function Sticker({ children, tone = 'sun', tilt = -2.2, className = '' }: StickerProps) {
  const toned = tone === 'sun' ? '' : ` sticker--${tone}`;
  return (
    <span
      className={`sticker${toned} ${className}`.trim()}
      style={{ '--tilt': `${tilt}deg` } as React.CSSProperties}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Meta - the mono metadata line
   -------------------------------------------------------------------------- */

export function Meta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`meta ${className}`.trim()}>{children}</p>;
}

/* --------------------------------------------------------------------------
   Rule - a hairline
   --------------------------------------------------------------------------
   `draw` marks it as one the reader's own scroll extends. The class is all
   this component contributes; the scrub is bound by the section, because the
   trigger has to be the content the rule divides rather than the rule itself.
   -------------------------------------------------------------------------- */

export function Rule({
  navy = false,
  draw = false,
  className = '',
}: {
  navy?: boolean;
  draw?: boolean;
  className?: string;
}) {
  return (
    <hr
      className={`rule${navy ? ' rule--navy' : ''} ${className}`.trim()}
      data-draw={draw ? '' : undefined}
    />
  );
}

/* --------------------------------------------------------------------------
   Numeral - the oversized chapter number
   --------------------------------------------------------------------------
   Decorative by design: the number is already in the heading or the label
   beside it, so this one is hidden from assistive technology rather than read
   out twice.
   -------------------------------------------------------------------------- */

export function Numeral({ children, sun = false }: { children: ReactNode; sun?: boolean }) {
  return (
    <span className={`numeral${sun ? ' numeral--sun' : ''}`} aria-hidden="true">
      {children}
    </span>
  );
}
