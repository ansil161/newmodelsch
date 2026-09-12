import { usePageMeta } from '@/hooks/usePageMeta';
import { ChapterRail } from '@/components/editorial';
import {
  SL_CHAPTERS,
  SlBeyond,
  SlCampus,
  SlCover,
  SlCta,
  SlDay,
  SlSafety,
  SlVisit,
  SlWall,
} from '@/components/life';

/**
 * PAGE 04 - Student Life. Experience: "What will student life look like?"
 *
 * The visual, human page, and the one the site spends its photography on.
 * Everything else stays ruled and quiet; this one is allowed to be a magazine.
 *
 * It opens on the school day rather than on the buildings, because a parent
 * picturing their child here is picturing a morning, not a floor plan. It
 * closes on a campus visit rather than a generic call to action, because that
 * is the one ask that follows from what the page just showed.
 */
export function StudentLifePage() {
  usePageMeta({
    title: 'Student Life - New Model High School',
    description:
      'A day at New Model High School: the timetable, four acres in Bahadurpura, classrooms, labs, library and field, sport, arts, clubs and events, the safety policy behind all of it, and how to book a campus visit.',
  });

  return (
    <div className="student-life">
      <ChapterRail items={SL_CHAPTERS} title="Where the day happens" />

      <SlCover />
      <SlDay />
      <SlCampus />
      <SlBeyond />
      <SlWall />
      <SlSafety />
      <SlVisit />
      <SlCta />
    </div>
  );
}
