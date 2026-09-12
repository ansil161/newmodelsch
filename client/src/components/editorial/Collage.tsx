import type { CSSProperties } from 'react';
import type { Photo } from '@/constants/imagery';
import { resolve, resolveSet } from '@/constants/imagery';
import { Hand } from './Hand';
import type { HandKind, HandTone } from './Hand';

/* ==========================================================================
   COLLAGE - photographs arranged on the page by hand
   --------------------------------------------------------------------------
   One large photograph the spread is about, two or three smaller prints laid
   over and around it, a few pen marks, and a line or two of handwriting. The
   invitation spreads (see `InviteSection`) are built out of it.

   THE COMPOSITION IS DATA, FOR THE SAME REASON THE CURRICULUM'S IS.

   Every spread that uses this is meant to look different - a different lead,
   different overlaps, a different direction of travel - and writing that as
   bespoke CSS per section is four layouts that drift apart. So each item is a
   position, a width, a rotation and a depth, as percentages of the plate, and
   the renderer is one loop. Re-art-directing a spread is moving numbers.

   PHONES GET THEIR OWN ARRANGEMENT, NOT A SHRUNK ONE.

   Every item takes an `sm` placement that replaces its desktop one below the
   tablet breakpoint, or `sm: false` to leave it off a phone altogether. A
   desktop paste-up scaled to 360px is four postage stamps and a note nobody
   can read; the phone version is a composition in its own right.

   NOTHING HERE IS A CARD. Prints have a paper border and a contact shadow,
   not a radius and an elevation token. The lead photograph is the only thing
   given a shape, and the shape is one of the kit's own (arch, blob).
   ========================================================================== */

export interface Place {
  /** Left edge, as a percentage of the plate's width. */
  x: number;
  /** Top edge, as a percentage of the plate's height. */
  y: number;
  /** Width, as a percentage of the plate's width. Notes may omit it. */
  w?: number;
  /** Degrees. Kept under about 7 - past that it reads as dropped, not placed. */
  rotate?: number;
}

interface Placed extends Place {
  /** The phone arrangement. `false` leaves the item off phones entirely. */
  sm?: Place | false;
  /** Parallax travel in px across the scroll. The lead moves least. */
  depth?: number;
  z?: number;
}

export interface CollagePhoto extends Placed {
  photo: Photo;
  /** `main` is the photograph the spread is about; `print` supports it. */
  role: 'main' | 'print';
  /** Width over height. */
  ratio: number;
  /** The lead's shape. `bleed` runs off the plate's right edge. */
  shape?: 'arch' | 'blob' | 'soft' | 'bleed';
  /** The side a print is slid in from as it is placed. */
  from?: 'left' | 'right' | 'top' | 'bottom';
  /** The slot's rendered width, for the browser's srcset choice. */
  sizes: string;
}

export interface CollageMark extends Placed {
  kind: HandKind;
  tone?: HandTone;
  flip?: boolean;
}

export interface CollageNote extends Placed {
  text: string;
}

interface CollageProps {
  photos: CollagePhoto[];
  marks?: CollageMark[];
  notes?: CollageNote[];
  /** The plate's aspect ratio (w / h) on desktop and on phones. */
  ratio: number;
  smRatio?: number;
  className?: string;
}

/* The widths the layout can actually produce. A lead is at most ~620px wide
   on a 1440 screen, so 1280 covers it at 2x and 1800 is there for 1920+. */
const MAIN_WIDTHS = [640, 960, 1280, 1800];
const PRINT_WIDTHS = [360, 540, 760, 1000];

function placement(item: Placed): CSSProperties {
  const vars: Record<string, string | number> = {
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
  return vars as CSSProperties;
}

const deskOnly = (item: Placed) => (item.sm === false ? ' is-desk-only' : '');

export function Collage({ photos, marks = [], notes = [], ratio, smRatio, className = '' }: CollageProps) {
  return (
    <div
      className={`clg ${className}`.trim()}
      style={{ '--ratio': ratio, '--ratio-sm': smRatio ?? ratio } as CSSProperties}
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
            style={{ ...placement(item), '--ar': item.ratio } as CSSProperties}
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
