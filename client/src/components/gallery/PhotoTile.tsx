import type { CSSProperties } from 'react';
import type { GalleryPhoto } from '@/constants/gallery';
import { Icon } from '@/components/common/Icon';
import { Figure } from '@/components/editorial';
import type { FigureRatio, FigureShape } from '@/components/editorial';

/* ==========================================================================
   PHOTO TILE - a photograph you can open
   --------------------------------------------------------------------------
   Every clickable photograph in the gallery is one of these: the site's
   Figure inside a real button, with the category label and the view mark
   that surface on hover and on keyboard focus.

   `ratio="free"` takes the photograph's own proportions from the data, so
   the event pages can show each frame at its real shape.
   ========================================================================== */

interface PhotoTileProps {
  photo: GalleryPhoto;
  width: number;
  sizes: string;
  onOpen: () => void;
  shape?: FigureShape;
  ratio?: FigureRatio;
  label?: string;
  eager?: boolean;
  className?: string;
  style?: CSSProperties;
  /** -1 for copies that exist only to make a loop seamless. */
  tabIndex?: number;
}

export function PhotoTile({
  photo,
  width,
  sizes,
  onOpen,
  shape = 'frame',
  ratio = 'free',
  label,
  eager,
  className = '',
  style,
  tabIndex,
}: PhotoTileProps) {
  return (
    <button
      type="button"
      className={`gal-tile ${className}`.trim()}
      onClick={onOpen}
      data-cursor="View"
      style={style}
      tabIndex={tabIndex}
    >
      <Figure
        photo={photo}
        width={width}
        sizes={sizes}
        shape={shape}
        ratio={ratio}
        hover
        eager={eager}
        className="gal-tile__fig"
        style={ratio === 'free' ? { aspectRatio: photo.ratio ?? 4 / 3 } : undefined}
      >
        {label ? (
          <span className="gal-tile__label" aria-hidden="true">
            {label}
          </span>
        ) : null}
        <span className="gal-tile__view" aria-hidden="true">
          <Icon name="arrowUpRight" size={16} />
        </span>
      </Figure>
      <span className="sr-only">Open photograph: {photo.alt}</span>
    </button>
  );
}
