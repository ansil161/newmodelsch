import { usePageMeta } from '@/hooks/usePageMeta';
import { ChapterRail } from '@/components/editorial';
import {
  AC_CHAPTERS,
  AcBeyond,
  AcCover,
  AcCta,
  AcCurriculum,
  AcMethod,
  AcNext,
  AcProof,
  AcRecord,
} from '@/components/academics';

/**
 * PAGE 03 - Academics. Evaluation: "What will my child actually learn?"
 *
 * The most interactive page on the site, and the one where every interaction
 * is an elaboration rather than a gate. The curriculum map is a tablist, the
 * record is a filterable archive, the method is a sticky sequence - and a
 * parent who never touches any of them still reads the whole page.
 *
 * NOTHING IS BEHIND AN INTERACTION.
 *
 * Three of these sections used to hide their content. The method held one
 * practice at a time on a sticky stage; the map pinned the viewport for four
 * screens and showed one band per screen; the habits shared a fixed-height
 * frame and compressed to their titles. All of it is printed now. The page
 * can be searched, printed, and read on a phone without anyone discovering
 * that something was hidden.
 *
 * THE ANCHORS ARE THE OLD ANCHORS.
 *
 * `#how-we-teach`, `#curriculum`, `#future-skills`, `#achievements` and
 * `#academic-proof` all still resolve, and to the same subject matter.
 * Another page links to two of them, and a bookmark outlives a redesign.
 */
export function AcademicsPage() {
  usePageMeta({
    title: 'Academics - New Model High School',
    description:
      'What a child learns at New Model High School, Hyderabad, stage by stage: Pre-Primary, Primary, Middle and Secondary, the subjects behind each, the skills the syllabus omits, and the board results they produce.',
  });

  return (
    <div className="academics">
      <ChapterRail items={AC_CHAPTERS} title="What a child learns" />

      <AcCover />
      <AcMethod />
      <AcCurriculum />
      <AcNext />
      <AcBeyond />
      <AcRecord />
      <AcProof />
      <AcCta />
    </div>
  );
}
