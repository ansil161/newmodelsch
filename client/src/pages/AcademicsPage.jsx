import { usePageMeta } from '@/hooks/usePageMeta';
import {
  AcBeyond,
  AcCover,
  AcCta,
  AcCurriculum,
  AcMethod,
  AcNext,
  AcProof,
} from '@/components/academics';

/**
 * PAGE 03 - Academics. Evaluation: "What will my child actually learn?"
 */
export function AcademicsPage() {
  usePageMeta({
    title: 'Academics - New Model High School',
    description:
      'What a child learns at New Model High School, Hyderabad, stage by stage: Pre-Primary, Primary, Middle and Secondary, the subjects behind each, the skills the syllabus omits, and the board results they produce.',
  });

  return (
    <div className="academics">
      <AcCover />
      <AcMethod />
      <AcCurriculum />
      <AcNext />
      <AcBeyond />
      <AcProof />
      <AcCta />
    </div>
  );
}
