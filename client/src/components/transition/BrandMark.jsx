import { Logo } from '@/components/common/Logo';

/* ==========================================================================
   BRAND MARK - the masthead's logo, laid out at intro size
   --------------------------------------------------------------------------
   The same official logo the navigation shows, sized at `--k` times the
   masthead's logo height and scaled back down onto it.

   WHY IT IS A COPY RATHER THAN SOMETHING OF ITS OWN

   The transition ends by landing this element exactly on `.nav__brand` and
   swapping one for the other. That swap is invisible only if the two are the
   same object at two sizes - which, for a single image with a fixed aspect
   ratio, they are by construction.

   AND WHY IT IS LAID OUT LARGE AND SCALED DOWN

   The source artwork is 1440px wide, so the logo is sharp when it is centred
   on screen and sharp when it lands.
   ========================================================================== */

export function BrandMark() {
  return (
    <div className="pt__lockup">
      <Logo className="pt__logo" decorative priority />
    </div>
  );
}
