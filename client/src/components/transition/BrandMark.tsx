import { SCHOOL } from '@/constants';

/* ==========================================================================
   BRAND MARK - the masthead's own lockup, drawn at intro size
   --------------------------------------------------------------------------
   This is not "a logo for the intro". It is a copy of `.nav__brand` - the same
   mark, the same two lines of type, the same 11px gap - built at a multiple of
   the masthead's size and scaled back down onto it.

   WHY IT IS A COPY RATHER THAN SOMETHING OF ITS OWN

   Because the transition ends by landing this element exactly on the
   masthead's brand and swapping one for the other. That swap is invisible
   only if the two are the same object at two sizes, so every measurement here
   is the navigation's measurement multiplied by `--k`, and the transition
   lands by animating a single uniform scale. Nothing is hand-tuned, and the
   two cannot drift apart when the masthead is restyled.

   AND WHY IT IS BUILT LARGE AND SCALED DOWN, RATHER THAN SMALL AND SCALED UP

   Text rasterises at the size it is laid out at. A 17px wordmark blown up to
   3x is a blurry wordmark for the whole second it is centred on screen -
   which is the part of this animation anyone actually looks at. Laid out
   large and scaled down, it is crisp when it is big and crisp when it lands.

   ONE ELEMENT, ONE MOVEMENT

   The mark and the name are a single flex row that is never animated apart.
   There is no separate entrance for the type, no per-letter stagger, and no
   direction: the lockup fades up in the centre of the screen, holds, and
   travels to the masthead as one thing.
   ========================================================================== */

export function BrandMark() {
  /* The masthead breaks the name after the second word - "New Model" over
     "HIGH SCHOOL". Derived rather than retyped so the two cannot disagree. */
  const words = SCHOOL.name.split(' ');
  const title = words.slice(0, 2).join(' ');
  const rest = words.slice(2).join(' ');

  return (
    <div className="pt__lockup">
      <span className="pt__mark" aria-hidden="true">
        <i />
        <i />
        <b />
      </span>

      <span className="pt__name">
        <b>{title}</b>
        <span>{rest}</span>
      </span>
    </div>
  );
}
