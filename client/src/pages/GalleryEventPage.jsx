import { useParams } from 'react-router-dom';
import { ROUTES } from '@/constants';
import { findEvent, findYear, yearHref } from '@/constants/gallery';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  EventHeader,
  EventPager,
  GalleryBreadcrumbs,
  LightboxProvider,
  PhotoMasonry,
} from '@/components/gallery';
import { NotFoundPage } from './NotFoundPage';

/**
 * Student Life / Gallery / {year} / {event} - one event, as an exhibition.
 */
export function GalleryEventPage() {
  const { yearId, eventId } = useParams();
  const year = findYear(yearId);
  const event = findEvent(yearId, eventId);

  usePageMeta({
    title:
      year && event
        ? `${event.title}, ${year.title} - Gallery - New Model High School`
        : 'Gallery - New Model High School',
    description: event?.description ?? 'An event from the New Model High School gallery.',
  });

  if (!year || !event) return <NotFoundPage />;

  return (
    <LightboxProvider>
      <div className="gal-page gal-page--event" key={`${year.id}/${event.id}`}>
        <GalleryBreadcrumbs
          back={{ label: `Back to ${year.title}`, to: yearHref(year) }}
          trail={[
            { label: 'Gallery', to: ROUTES.gallery },
            { label: year.title, to: yearHref(year) },
            { label: event.title },
          ]}
        />
        <EventHeader year={year} event={event} />
        <section className="section section--tight gal-exhibit" aria-label={`Photographs from ${event.title}`}>
          <div className="wrap">
            <PhotoMasonry photos={event.photos} title={event.title} />
          </div>
        </section>
        <EventPager year={year} event={event} />
      </div>
    </LightboxProvider>
  );
}
