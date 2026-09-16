import { resolve, resolveSet } from '@/constants/imagery';
import { Hand } from './Hand';

/* The widths the layout can actually produce. A lead is at most ~620px wide
   on a 1440 screen, so 1280 covers it at 2x and 1800 is there for 1920+. */
const MAIN_WIDTHS = [640, 960, 1280, 1800];
const PRINT_WIDTHS = [360, 540, 760, 1000];

function placement(item) {
  const vars = {
    '--x': `${item.x}%`,
    '--y': `${item.y}%`,
    '--r': `${item.rotate ?? 0}deg`,
  };
  if (item.w !== undefined) vars['--w'] = `${item.w}%`;
  if (item.sm) {
    vars['--xs'] = `${item.sm.x}%`;
    vars['--ys'] = `${item.sm.y}%`;
    vars['--rs'] = `${item.sm.rotate ?? item.rotate ?? 0}deg`;
    if (item.sm.w !== undefined) vars['--ws'] = `${item.sm.w}%`;
  }
  if (item.z !== undefined) vars.zIndex = item.z;
  return vars;
}

const deskOnly = (item) => (item.sm === false ? ' is-desk-only' : '');

export function Collage({ photos, marks = [], notes = [], ratio, smRatio, className = '' }) {
  return (
    <div
      className={`clg ${className}`.trim()}
      style={{ '--ratio': ratio, '--ratio-sm': smRatio ?? ratio }}
    >
      {marks.map((mark, i) => (
        <div
          key={`mark-${i}`}
          className={`clg__item clg__mark clg__mark--${mark.kind}${deskOnly(mark)}`}
          data-depth={mark.depth ?? 0}
          style={placement(mark)}
        >
          <Hand kind={mark.kind} tone={mark.tone} flip={mark.flip} />
        </div>
      ))}

      {photos.map((item) => {
        const main = item.role === 'main';
        return (
          <figure
            key={item.photo.id}
            className={`clg__item clg__photo clg__photo--${item.role}${
              item.shape ? ` clg__photo--${item.shape}` : ''
            }${deskOnly(item)}`}
            data-depth={item.depth ?? 0}
            data-from={item.from ?? 'bottom'}
            style={{ ...placement(item), '--ar': item.ratio }}
          >
            {/* Three layers, one job each, so no two animations ever fight
                over the same transform: the figure drifts with the scroll,
                `enter` carries the entrance, `print` holds the resting tilt
                and the hover. */}
            <div className="clg__enter">
              <div className="clg__print">
                <img
                  src={resolve(item.photo, main ? 1280 : 760)}
                  srcSet={resolveSet(item.photo, main ? MAIN_WIDTHS : PRINT_WIDTHS)}
                  sizes={item.sizes}
                  alt={item.photo.alt}
                  loading="lazy"
                  decoding="async"
                  style={item.photo.focus ? { objectPosition: item.photo.focus } : undefined}
                />
              </div>
            </div>
          </figure>
        );
      })}

      {/* The handwriting. Hidden from assistive tech: it restates, in a
          person's voice, something the copy beside it already says. */}
      {notes.map((note, i) => (
        <p
          key={`note-${i}`}
          className={`clg__item clg__note${deskOnly(note)}`}
          data-depth={note.depth ?? 0}
          style={placement(note)}
          aria-hidden="true"
        >
          <span className="clg__ink">{note.text}</span>
        </p>
      ))}
    </div>
  );
}
