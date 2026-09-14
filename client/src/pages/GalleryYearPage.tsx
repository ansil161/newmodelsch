import { useParams } from 'react-router-dom';
import { ROUTES } from '@/constants';
import { findYear } from '@/constants/gallery';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  EventGrid,
  GalleryBreadcrumbs,
  LightboxProvider,
  YearGalleryHeader,
  YearPager,
} from '@/components/gallery';
import { NotFoundPage } from './NotFoundPage';

/**
 * Student Life / Gallery / {year} - one academic year's album.
 *
 * Keyed by the year so moving between years remounts the page and every
 * entrance plays for the new year, rather than the old year's finished state
 * being repainted with new content.
 */
export function GalleryYearPage() {
  const { yearId } = useParams();
  const year = findYear(yearId);

  usePageMeta({
    title: year ? `${year.title} - Gallery - New Model High School` : 'Gallery - New Model High School',
    description: year?.intro ?? 'The New Model High School gallery, by academic year.',
  });

  if (!year) return <NotFoundPage />;

  return (
    <LightboxProvider>
      <div className="gal-page gal-page--year" key={year.id}>
        <GalleryBreadcrumbs
          back={{ label: 'Back to Gallery', to: ROUTES.gallery }}
          trail={[
            { label: 'Student Life', to: ROUTES.studentLife },
            { label: 'Gallery', to: ROUTES.gallery },
            { label: year.title },
          ]}
        />
        <YearGalleryHeader year={year} />
        <EventGrid year={year} />
        <YearPager year={year} />
      </div>
    </LightboxProvider>
  );
}
