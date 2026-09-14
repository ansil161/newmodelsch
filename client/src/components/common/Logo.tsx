import { SCHOOL } from '@/constants';

/* ==========================================================================
   LOGO - the official New Model School horizontal lockup
   --------------------------------------------------------------------------
   The artwork is used exactly as supplied: never redrawn, recoloured,
   cropped or stretched. Both files are served unchanged from /public/brand.

     color   the indigo logo, on white and light grounds. The default.
     white   the reversed logo, only on the dark navy ground (the footer).

   The intrinsic size is passed as width/height so the browser knows the
   aspect ratio before the file arrives. Each context sets only a `height`
   and the width follows, so the logo cannot be distorted and the masthead
   does not shift when it loads.
   ========================================================================== */

const SOURCES = {
  color: '/brand/new-model-school-logo.png',
  white: '/brand/new-model-school-logo-white.png',
} as const;

export const LOGO_WIDTH = 1440;
export const LOGO_HEIGHT = 462;

interface LogoProps {
  variant?: keyof typeof SOURCES;
  className?: string;
  /** True where a wrapping link or heading already names the school. */
  decorative?: boolean;
  /** For the masthead and the intro: the first thing on screen. */
  priority?: boolean;
}

export function Logo({ variant = 'color', className, decorative = false, priority = false }: LogoProps) {
  return (
    <img
      className={className ? `logo ${className}` : 'logo'}
      src={SOURCES[variant]}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      alt={decorative ? '' : SCHOOL.name}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      draggable={false}
    />
  );
}
