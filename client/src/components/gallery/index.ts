/**
 * The gallery - "The Living Yearbook".
 *
 * Three pages (landing, year, event) built from these pieces. The data they
 * render lives in `constants/gallery.ts`; nothing here holds a photograph.
 *
 * The stylesheets are imported once, here, in the same way as the editorial
 * kit. Every class in them is `gal-` prefixed.
 */
import './gallery.css';
import './gallery-home.css';
import './gallery-stories.css';
import './gallery-archive.css';

export { LightboxProvider, useLightbox } from './PhotoLightbox';
export { PhotoTile } from './PhotoTile';
export { GalleryBreadcrumbs } from './GalleryBreadcrumbs';

export { GalleryHero } from './GalleryHero';
export { EditorialPhotoWall } from './EditorialPhotoWall';
export { CategoryMemoryExplorer } from './CategoryMemoryExplorer';
export { YearArchive, YearCard } from './YearArchive';
export { MovingPhotoStrip } from './MovingPhotoStrip';
export { FeaturedMemory } from './FeaturedMemory';
export { GalleryCta } from './GalleryCta';

export { YearGalleryHeader } from './YearGalleryHeader';
export { EventGrid, EventCard, YearPager } from './EventGrid';
export { EventHeader, EventPager } from './EventHeader';
export { PhotoMasonry } from './PhotoMasonry';
