/**
 * The editorial kit.
 *
 * Every page on the site is composed out of these. A section that needs
 * something none of them do is a section that either wants a new member of the
 * kit - added here, documented, and then reusable - or wants to be rethought,
 * because the number of genuinely one-off compositions on a six-page site is
 * very close to zero.
 *
 * The stylesheet is imported once, here, rather than by each component. Vite
 * is configured with `cssCodeSplit: false` so it lands in one file regardless,
 * and importing it in fifteen places only makes the dependency graph harder to
 * read.
 */
import './editorial.css';

export { Ed, Em, Mark, Sticker, Meta, Rule, Numeral } from './primitives';
export { Figure } from './Figure';
export type { FigureShape, FigureRatio } from './Figure';

export { SectionHead } from './SectionHead';
export { StatReveal } from './StatReveal';
export type { StatItem } from './StatReveal';

export { EditorialHero } from './EditorialHero';
export type { HeroFigure } from './EditorialHero';
export { PageCover } from './PageCover';

export { StickyStory } from './StickyStory';
export type { StoryPanel } from './StickyStory';

export { HorizontalGallery } from './HorizontalGallery';
export type { GalleryFrame } from './HorizontalGallery';

export { EditorialTimeline } from './EditorialTimeline';
export type { TimelineEntry } from './EditorialTimeline';

export { QuoteSection } from './QuoteSection';
export type { QuoteEntry } from './QuoteSection';

export { EditorialAccordion } from './EditorialAccordion';
export type { AccordionItem } from './EditorialAccordion';

export { JourneyPath } from './JourneyPath';
export type { JourneyStop } from './JourneyPath';

export { PhotoBreak } from './PhotoBreak';
export { CTASection } from './CTASection';

/* The invitation spreads: a closing section built as a collage rather than a
   band. The section, the plate it lays out, and the pen marks on both. */
export { InviteSection, Script } from './InviteSection';
export type { InviteAction } from './InviteSection';
export { Collage } from './Collage';
export type { CollagePhoto, CollageMark, CollageNote, Place } from './Collage';
export { Hand } from './Hand';
export type { HandKind, HandTone } from './Hand';

/* The curriculum is not in the kit. It is a single heavily art-directed spread
   that exists once, on Academics, and lives beside the page it belongs to at
   `components/academics/CurriculumChapters.tsx`. A component used once is not
   reusable - it is just a component, and putting it here would only imply that
   the next page could have one too. */

export { AchievementArchive } from './AchievementArchive';
export type { ArchiveEntry } from './AchievementArchive';
