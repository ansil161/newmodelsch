import { usePageMeta } from '@/hooks/usePageMeta';
import {
  CategoryMemoryExplorer,
  EditorialPhotoWall,
  FeaturedMemory,
  GalleryCta,
  GalleryHero,
  LightboxProvider,
  MovingPhotoStrip,
  YearArchive,
} from '@/components/gallery';

/**
 * Student Life / Gallery - "The Living Yearbook".
 *
 * The one page on the site where the photographs are the content rather than
 * the evidence for it. It opens on pictures, not on year cards: a composed
 * hero, then an editorial wall of ordinary days, then the ways of looking -
 * by category, by year, as a moving strip, as one featured story - and only
 * closes on the archive itself.
 *
 * Every photograph opens in the same viewer, provided once here so each
 * section only has to say which set it belongs to.
 */
export function GalleryPage() {
  usePageMeta({
    title: 'Gallery - Student Life - New Model High School',
    description:
      'The living yearbook of New Model High School: celebrations, sport, learning, the arts and everyday moments, browsable by category, by academic year and by event.',
  });

  return (
    <LightboxProvider>
      <div className="gal-page">
        <GalleryHero />
        <EditorialPhotoWall />
        <CategoryMemoryExplorer />
        <YearArchive />
        <MovingPhotoStrip />
        <FeaturedMemory />
        <GalleryCta />
      </div>
    </LightboxProvider>
  );
}
