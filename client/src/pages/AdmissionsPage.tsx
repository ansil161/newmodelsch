import { usePageMeta } from '@/hooks/usePageMeta';
import {
  AdCover,
  AdDocuments,
  AdEligibility,
  AdFaq,
  AdProcess,
  AdVisit,
  EnquiryForm,
} from '@/components/admissions';

export function AdmissionsPage() {
  usePageMeta({
    title: 'Admissions 2026-27 - New Model High School',
    description:
      'Admissions open for 2026-27 at New Model High School, Hyderabad. Eligibility from Nursery to Class 10, the six-step process, documents, key dates, FAQs and the enquiry form.',
  });

  return (
    <div className="admissions-page">
      <AdCover />

      {/* 01 - who can apply */}
      <AdEligibility />

      {/* 02 - the process */}
      <AdProcess />

      {/* 03 - the paperwork and the calendar behind it */}
      <AdDocuments />

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
