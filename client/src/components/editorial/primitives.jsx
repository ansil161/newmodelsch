

export function Ed({ as: Tag = 'h2', size = 'h2', className = '', children, id }) {
  return (
    <Tag id={id} className={`ed-${size} ${className}`.trim()}>
      {children}
    </Tag>
  );
}

/** The italic of the same face. Emphasis inside a serif line is never a
 *  second family - a sans word dropped into a serif headline is the move to
 *  avoid. */
export function Em({ children }) {
  return <em className="ed-em">{children}</em>;
}

export function Mark({ kind = 'high', tone = 'sun', children }) {
  const base = kind === 'underline' ? 'mark-ul' : kind === 'ring' ? 'mark-ring' : 'mark';
  // Only the highlighter has tone variants; a coral underline and a coral
  // ring both read as an error state rather than as emphasis.
  const toned = kind === 'high' && tone !== 'sun' ? ` mark--${tone}` : '';
  return <span className={`${base}${toned}`}>{children}</span>;
}

export function Sticker({ children, tone = 'sun', tilt = -2.2, className = '' }) {
  const toned = tone === 'sun' ? '' : ` sticker--${tone}`;
  return (
    <span
      className={`sticker${toned} ${className}`.trim()}
      style={{ '--tilt': `${tilt}deg` }}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Meta - the mono metadata line
   -------------------------------------------------------------------------- */

export function Meta({ children, className = '' }) {
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

export function Numeral({ children, sun = false }) {
  return (
    <span className={`numeral${sun ? ' numeral--sun' : ''}`} aria-hidden="true">
      {children}
    </span>
  );
}
