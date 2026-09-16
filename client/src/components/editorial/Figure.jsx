import { resolve, resolveSet } from '@/constants/imagery';

export function Figure({
  photo,
  width,
  widths,
  sizes,
  shape = 'frame',
  ratio = 'landscape',
  hover = false,
  note,
  eager = false,
  decorative = false,
  className = '',
  style,
  children,
}) {
  // A spread around the requested width, so a 2x screen has something to pick
  // and a small screen is not sent the desktop frame.
  const set = widths ?? [Math.round(width * 0.6), width, Math.round(width * 1.6)];

  const classes = [
    'fig',
    `fig--${shape}`,
    ratio !== 'free' ? `fig--${ratio}` : '',
    hover ? 'fig--hover' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <figure className={classes} style={style}>
      <img
        src={resolve(photo, width)}
        srcSet={resolveSet(photo, set) || undefined}
        sizes={sizes ?? `${width}px`}
        alt={decorative ? '' : photo.alt}
        aria-hidden={decorative || undefined}
        loading={eager ? 'eager' : 'lazy'}
        decoding={eager ? 'sync' : 'async'}
        // @ts-expect-error -- fetchPriority landed in React 19 typings late
        fetchpriority={eager ? 'high' : undefined}
        style={photo.focus ? { objectPosition: photo.focus } : undefined}
      />
      {note ? <figcaption className="fig-note">{note}</figcaption> : null}
      {children}
    </figure>
  );
}
