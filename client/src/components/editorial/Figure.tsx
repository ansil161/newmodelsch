import type { CSSProperties, ReactNode } from 'react';
import type { Photo } from '@/constants/imagery';
import { resolve, resolveSet } from '@/constants/imagery';

/* ==========================================================================
   FIGURE - every photograph on the site goes through here
   --------------------------------------------------------------------------
   It exists to make four decisions once instead of two hundred times:

   1. THE CROP.
      This site crops photography into arches, circles and organic squircles.
      A portrait cropped to a circle on its default centre loses the face,
      every time. The entry in `imagery.ts` carries a `focus`, and this is the
      only component that reads it.

   2. THE SIZE.
      `width` is what the slot actually renders at, and `widths` is the set the
      browser gets to choose from. Passing the source width here is the single
      most common way a site like this gets slow, so the prop is required and
      the srcset is built for you.

   3. THE RESERVED SPACE.
      Every figure has an aspect ratio before its image arrives. Without one,
      each photograph that loads pushes the page down under a ScrollTrigger
      that was measured against the old height - and a one-shot reveal whose
      start drifted past the viewport never fires at all.

   4. THE LOADING STRATEGY.
      Lazy and async-decoded by default. `eager` is for the two or three
      frames above the fold, where lazy-loading the thing a person came to see
      is a self-inflicted wound.

   THE SHAPES CARRY MEANING

     arch    a doorway. Portraits, and anything that is a person.
     blob    an organic squircle. Candid photography, things in motion.
     frame   a plain generous radius. Places, buildings, wide frames.
     round   a circle. Thumbnails, and the horizontal strips.
     square  no radius. The archive, where the frame should read as a document.
   ========================================================================== */

export type FigureShape = 'arch' | 'blob' | 'blob-2' | 'frame' | 'round' | 'square';
export type FigureRatio =
  | 'portrait'
  | 'tall'
  | 'square-ar'
  | 'landscape'
  | 'wide'
  | 'cinema'
  | 'free';

interface FigureProps {
  photo: Photo;
  /** The width the slot renders at, in CSS pixels at 1x. Not the source width. */
  width: number;
  /** Candidate widths for the srcset. Defaults to a spread around `width`. */
  widths?: number[];
  /** How wide the slot is, for the browser's own picking. e.g. '(max-width: 900px) 100vw, 46vw' */
  sizes?: string;
  shape?: FigureShape;
  ratio?: FigureRatio;
  /** Zooms slightly on hover. For figures that are, or sit inside, a link. */
  hover?: boolean;
  /** The pinned caption in the corner of the frame. */
  note?: string;
  /** Skips lazy-loading. For above-the-fold frames only. */
  eager?: boolean;
  /**
   * Marks the image decorative. Use when the caption or heading beside it
   * already says everything the photograph contributes - which, for the
   * archive strips and the photo walls, it does.
   */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Anything laid over the frame: a label, a play button, a stat. */
  children?: ReactNode;
}

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
}: FigureProps) {
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
