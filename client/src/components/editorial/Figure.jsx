import { resolve, resolveSet } from '@/constants/imagery';

export function Figure({
  photo,
  width,
  widths,
  sizes,
  shape = 'frame',
  ratio = 'landscape',
  phoneRatio,
  phoneFocus,
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

  // Art direction for phones (<600px). Optional and additive: a figure that
  // passes neither prop, and a photo without `focusSm`, renders exactly as
  // before. The crop point travels as custom properties so the stylesheet
  // can swap it per breakpoint without a second <img>.
  const smFocus = phoneFocus ?? photo.focusSm;
  const art = Boolean(smFocus || phoneRatio);

  const classes = [
    'fig',
    `fig--${shape}`,
    ratio !== 'free' ? `fig--${ratio}` : '',
    hover ? 'fig--hover' : '',
    art ? 'fig--art' : '',
    phoneRatio ? `fig--sm-${phoneRatio}` : '',
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
        fetchPriority={eager ? 'high' : undefined}
        style={
          art
            ? { '--fig-focus': photo.focus ?? '50% 50%', '--fig-focus-sm': smFocus ?? photo.focus ?? '50% 50%' }
            : photo.focus
              ? { objectPosition: photo.focus }
              : undefined
        }
      />
      {note ? <figcaption className="fig-note">{note}</figcaption> : null}
      {children}
    </figure>
  );
}
