import { usePageMeta } from '@/hooks/usePageMeta';
import { ChapterRail } from '@/components/editorial';
import {
  AD_CHAPTERS,
  AdBreak,
  AdCover,
  AdDocuments,
  AdEligibility,
  AdFaq,
  AdProcess,
  AdVisit,
  EnquiryForm,
} from '@/components/admissions';

/**
 * PAGE 05 - Admissions. Decision: "How do I enroll my child?"
 *
 * The site's one conversion journey. Everything a parent needs to apply lives
 * here so nobody has to reconstruct the process across four pages: status,
 * eligibility, the six steps, documents, dates, the questions, a visit, and
 * the enquiry form itself.
 *
 * WHAT THE PAGE DOES NOT DO.
 *
 * It does not re-sell the school - a reader who has reached this page has
 * already been convinced, and a second copy of "why choose us" here is a
 * reason to leave and go and think about it. And it does not close on a
 * generic call to action pointing back at the pages they have finished with.
 * It ends on the form.
 *
 * THE FORM IS OUTSIDE THE NUMBERING.
 *
 * It is not the sixth thing to read; it is what the five chapters are for.
 * Giving it a number would file the destination as another stop on the way.
 * `#enquiry` is the anchor target for every "Enquire" in the chrome.
 */
export function AdmissionsPage() {
  usePageMeta({
    title: 'Admissions 2026-27 - New Model High School',
    description:
      'Admissions open for 2026-27 at New Model High School, Hyderabad. Eligibility from Nursery to Class 10, the six-step process, documents, key dates, FAQs and the enquiry form.',
  });

  return (
    <div className="admissions-page">
      <ChapterRail items={AD_CHAPTERS} title="Plan your admission" />

      <AdCover />

      {/* 01 - who can apply */}
      <AdEligibility />

      {/* 02 - the process */}
      <AdProcess />

      {/* 03 - the paperwork and the calendar behind it */}
      <AdDocuments />

      {/* The halfway pause. Two dense chapters in a row is where this page has
          always lost people. */}
      <AdBreak />

      {/* 04 - the questions the form does not answer */}
      <AdFaq />

      {/* 05 - the visit */}
      <AdVisit />

      {/* Outside the chapters and outside the index: the action the whole
          journey exists for, and the last thing on the page. */}
      <div id="enquiry">
        <EnquiryForm />
      </div>
    </div>
  );
}
