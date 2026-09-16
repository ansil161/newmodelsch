import { Icon } from '@/components/common/Icon';
import { Figure } from '@/components/editorial';

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
}) {
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
