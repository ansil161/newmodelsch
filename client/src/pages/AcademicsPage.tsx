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
 * The most interactive page on the site. The curriculum map is a pinned,
 * scroll-driven chapter, the record is a filterable archive, the method is a
 * sticky sequence.
 *
 * THE MAP IS THE ONE DELIBERATE EXCEPTION TO "NOTHING IS BEHIND AN
 * INTERACTION".
 *
 * It holds the viewport while the reader scrolls through four stages and
 * shows one stage at a time. Every stage is still a keyboard-reachable tab,
 * it never pins under reduced motion or when the composition does not fit
 * the screen, and on short screens only the supplementary lines (outcome,
 * subjects, assessment) give way while pinned. The other sections print
 * everything, so the rest of the page can still be searched and read on a
 * phone without anyone discovering that something was hidden.
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
