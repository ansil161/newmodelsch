import { usePageMeta } from '@/hooks/usePageMeta';
import {
  SlBeyond,
  SlCampus,
  SlCta,
  SlDay,
  SlHero,
  SlSafety,
  SlVisit,
  SlVoices,
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
 *
 * The reel sits between the photographs and the safety policy on purpose. By
 * that point the page has spent four sections telling a parent what happens
 * here; the reel is where it stops talking and lets four students say it
 * instead, and the policy that follows reads differently for having heard
 * them first.
 */
export function StudentLifePage() {
  usePageMeta({
    title: 'Student Life - New Model High School',
    description:
      'A day at New Model High School: the timetable, four acres in Bahadurpura, classrooms, labs, library and field, sport, arts, clubs and events, four students on film, the safety policy behind all of it, and how to book a campus visit.',
  });

  return (
    <div className="student-life">
      <SlHero />
      <SlDay />
      <SlCampus />
      <SlBeyond />
      <SlWall />
      <SlVoices />
      <SlSafety />
      <SlVisit />
      <SlCta />
    </div>
  );
}
