import type { ReactNode } from 'react';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { drift, unmask } from '@/lib/motion';
import { Figure } from './Figure';

/* ==========================================================================
   PHOTO BREAK - the pause between two dense sections
   --------------------------------------------------------------------------
   Three photographs at three different scales, drifting at three different
   speeds, with nothing to read.

   It exists because of a specific failure: two heavy sections in a row is
   where a long page loses people, and the usual fix - a pull quote, a stat
   band, a "did you know" - gives the reader one more thing to process at
   exactly the moment they needed one fewer. This gives them somewhere to
   rest.

   THE THREE FRAMES ARE NOT A GRID.

   They are three different sizes, three different shapes and three different
   vertical offsets, and they overlap. A row of three equal images is a
   gallery; three unequal overlapping ones is a composition, and the reader
   registers the difference without being able to name it.

   IT IS DECORATIVE, AND IT SAYS SO.

   Every frame here is `aria-hidden`. These photographs carry no information -
   that is the whole point of the section - and announcing three alt texts to
   a screen-reader user in the gap between two chapters is three interruptions
   for no content.
   ========================================================================== */

interface PhotoBreakProps {
  photos: [Photo, Photo, Photo];
  /** One short line, set in the mono, laid across the composition. Optional. */
  caption?: ReactNode;
  /** Reverses which frame is largest, so two breaks on a page differ. */
  flip?: boolean;
  className?: string;
}

export function PhotoBreak({ photos, caption, flip = false, className = '' }: PhotoBreakProps) {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const frames = el.querySelectorAll<HTMLElement>('.pbreak__frame');
    unmask(frames, { trigger: el, from: 'bottom', stagger: 0.14 });

    // Three speeds. The largest frame moves least, which is what makes the
    // small ones read as being nearer to the reader.
    const [a, b, c] = Array.from(frames);
    if (a) drift(a.querySelector('img'), 42, { trigger: el });
    if (b) drift(b.querySelector('img'), 96, { trigger: el });
    if (c) drift(c.querySelector('img'), 66, { trigger: el });
  }, []);

  return (
    <section
      ref={scope}
      className={`pbreak${flip ? ' pbreak--flip' : ''} ${className}`.trim()}
      aria-hidden="true"
    >
      <div className="pbreak__inner wrap">
        <div className="pbreak__frame pbreak__frame--a">
          <Figure photo={photos[0]} width={420} sizes="(max-width: 900px) 40vw, 20vw" shape="blob" ratio="portrait" decorative />
        </div>
        <div className="pbreak__frame pbreak__frame--b">
          <Figure photo={photos[1]} width={860} sizes="(max-width: 900px) 78vw, 42vw" shape="frame" ratio="landscape" decorative />
        </div>
        <div className="pbreak__frame pbreak__frame--c">
          <Figure photo={photos[2]} width={360} sizes="(max-width: 900px) 34vw, 17vw" shape="round" ratio="square-ar" decorative />
        </div>

        {caption ? <p className="pbreak__caption meta">{caption}</p> : null}
      </div>
    </section>
  );
}
