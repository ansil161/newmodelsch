import type { AdmissionStage, EligibilityRow, FaqItem, KeyDate } from '@/types';
import { img } from './media';

/* ==========================================================================
   PAGE 05 — Admissions
   --------------------------------------------------------------------------
   The one conversion journey on the site. Blueprint rule: clarity beats
   animation — a parent should never be unsure what the next step is.
   ========================================================================== */

export const ADMISSIONS_INTRO = {
  session: '2026-27',
  status: 'Open',
  statusDetail: 'Applications close 28 February 2026',
  title: 'Admissions for 2026-27 are open.',
  lead: 'Places are offered for Nursery through Class 10 at our Bahadurpura campus. The process below is the whole process - there is no separate list, and no step that happens off this page.',
  quickFacts: [
    { value: 'Nursery - 10', label: 'Entry classes' },
    { value: 'CBSE', label: 'Board' },
    { value: 'Nov - Feb', label: 'Application window' },
    { value: '6 weeks', label: 'Enquiry to confirmation' },
  ],
  image: img('1523580494863-6f3031224c94', 1600),
  imageAlt: 'Students arriving at the school gate in the morning',
} as const;

export const WHY_CHOOSE = [
  {
    id: 'known',
    title: 'Your child will be known',
    description:
      'Cohorts capped so a teacher can name every child. A named mentor owns your child\'s year and is the number you call.',
  },
  {
    id: 'results',
    title: 'Results without a coaching centre',
    description:
      'Twelve consecutive years of 100% board results, prepared inside school hours. Nothing is outsourced to an evening class.',
  },
  {
    id: 'breadth',
    title: 'Breadth that is timetabled',
    description:
      'Robotics, studio, field and stage have real hours and specialist teachers - they are not what is left after the syllabus.',
  },
  {
    id: 'honesty',
    title: 'Reports you can act on',
    description:
      'No mark is inflated. You are told what is true early enough to do something about it.',
  },
  {
    id: 'legacy',
    title: 'Sixty-four years of the same standard',
    description:
      'One campus, ten thousand alumni, and more than a thousand second-generation families.',
  },
] as const;

export const ELIGIBILITY: EligibilityRow[] = [
  {
    entry: 'Nursery',
    age: '3 years by 31 March 2026',
    seats: '120 places',
    note: 'Main entry point. Interaction is play-based, with a parent present.',
  },
  {
    entry: 'LKG - UKG',
    age: 'Age-appropriate for the class',
    seats: 'Limited',
    note: 'Offered only against vacancies arising in the Nursery cohort.',
  },
  {
    entry: 'Classes 1-5',
    age: 'Age-appropriate for the class',
    seats: 'Limited',
    note: 'Requires a transfer certificate and the last two report cards.',
  },
  {
    entry: 'Classes 6-8',
    age: 'Age-appropriate for the class',
    seats: 'Limited',
    note: 'Written assessment in English, mathematics and science.',
  },
  {
    entry: 'Class 9',
    age: 'Age-appropriate for the class',
    seats: 'Second major entry point',
    note: 'Written assessment plus an interaction with the student and parents.',
  },
];

export const ADMISSION_STAGES: AdmissionStage[] = [
  {
    id: 's1',
    step: '01',
    title: 'Enquiry',
    description:
      'Submit the form at the bottom of this page or call the admissions office. You are assigned a named coordinator the same working day.',
    owner: 'You',
    duration: 'Same day response',
  },
  {
    id: 's2',
    step: '02',
    title: 'Campus visit',
    description:
      'Walk the campus during a normal school day, meet the head of your child\'s stage, and ask everything. Nothing is staged for visitors.',
    owner: 'You and the school',
    duration: '45 minutes',
  },
  {
    id: 's3',
    step: '03',
    title: 'Application',
    description:
      'Complete the application form and submit the document checklist below.',
    owner: 'You',
    duration: '1 week',
  },
  {
    id: 's4',
    step: '04',
    title: 'Interaction or assessment',
    description:
      'Play-based interaction for early years; a written assessment in core subjects from Class 6. Both are diagnostic - they set the starting point, they are not a filter for coaching.',
    owner: 'Your child',
    duration: '60-90 minutes',
  },
  {
    id: 's5',
    step: '05',
    title: 'Parent conversation',
    description:
      'A conversation with the principal or stage head about your child - what they enjoy, what they find hard, and what you want from a school.',
    owner: 'You and the school',
    duration: '30 minutes',
  },
  {
    id: 's6',
    step: '06',
    title: 'Offer & confirmation',
    description:
      'A written offer, sent in writing to the address on your form. The place is held for fourteen days from the offer date.',
    owner: 'The school',
    duration: 'Within 2 weeks',
  },
];

export const DOCUMENTS = [
  {
    id: 'd1',
    group: 'For every applicant',
    items: [
      'Birth certificate (original for verification, one photocopy)',
      'Four recent passport-size photographs of the student',
      'Aadhaar card of the student, if issued',
      'Proof of residence - any one of the standard documents',
      'Parent or guardian identity proof',
    ],
  },
  {
    id: 'd2',
    group: 'For Class 1 and above',
    items: [
      'Transfer certificate from the previous school',
      'Report cards for the last two academic years',
      'Migration certificate, if moving from another board',
    ],
  },
  {
    id: 'd4',
    group: 'Where applicable',
    items: [
      'Medical records for any ongoing condition or allergy',
      'Learning support or assessment reports, if any exist',
      'Documentation for sibling or alumni consideration',
    ],
  },
] as const;

export const KEY_DATES: KeyDate[] = [
  {
    id: 'k1',
    date: '01 Nov 2025',
    title: 'Enquiries open',
    detail: 'Admissions office begins accepting enquiries for the 2026-27 session.',
    status: 'closed',
  },
  {
    id: 'k2',
    date: '15 Dec 2025',
    title: 'Campus visit season begins',
    detail: 'Tuesday and Thursday morning visits, plus the first Saturday of each month.',
    status: 'closed',
  },
  {
    id: 'k3',
    date: '05 Jan 2026',
    title: 'Applications open',
    detail: 'Forms and the document checklist accepted at the school office.',
    status: 'open',
  },
  {
    id: 'k4',
    date: '28 Feb 2026',
    title: 'Application deadline',
    detail: 'Last date for submitted applications with complete documentation.',
    status: 'upcoming',
  },
  {
    id: 'k5',
    date: '07-21 Mar 2026',
    title: 'Interactions & assessments',
    detail: 'Scheduled by your admissions coordinator, campus by campus.',
    status: 'upcoming',
  },
  {
    id: 'k6',
    date: '04 Apr 2026',
    title: 'Offers issued',
    detail: 'Written offers issued. Places held fourteen days.',
    status: 'upcoming',
  },
  {
    id: 'k7',
    date: '10 Jun 2026',
    title: 'Session begins',
    detail: 'First day of the 2026-27 academic session.',
    status: 'upcoming',
  },
];

export const ADMISSION_FAQS: FaqItem[] = [
  {
    id: 'f1',
    question: 'How competitive is admission?',
    answer:
      'Nursery and Class 9 are the two main entry points and receive the most applications. Other classes depend entirely on vacancies. Your coordinator will tell you honestly what the position is for your class before you apply.',
  },
  {
    id: 'f2',
    question: 'What is the assessment actually testing?',
    answer:
      'It is diagnostic. It tells us where a child is starting from so they can be placed and supported correctly. It is written against the previous class\'s curriculum, and no coaching is expected or advantaged.',
  },
  {
    id: 'f4',
    question: 'Do siblings get preference?',
    answer:
      'Yes. Siblings of current students and children of alumni are considered ahead of the general list, subject to meeting the same requirements as every other applicant.',
  },
  {
    id: 'f5',
    question: 'Can we transfer mid-session?',
    answer:
      'Where a vacancy exists, yes. Mid-session transfers need a transfer certificate and the current year\'s reports, and the child joins with a four-week support block to close any curriculum gap.',
  },
  {
    id: 'f6',
    question: 'Which board does the school follow?',
    answer:
      'CBSE, from Class 1 through Class 10. The pre-primary years - Nursery, LKG and UKG - run the school\'s own foundation programme, which is designed to lead into the CBSE Class 1 curriculum.',
  },
  {
    id: 'f7',
    question: 'Is transport available to our area?',
    answer:
      'Routes cover most of the old city and central Hyderabad from the Bahadurpura campus. Ask your coordinator to check your address against the current route map before you apply.',
  },
  {
    id: 'f8',
    question: 'What support exists for a child who is struggling?',
    answer:
      'Weekly diagnostics flag a gap in the week it opens, and the child is scheduled into small-group support automatically. Two full-time counsellors handle anything that is not academic.',
  },
  {
    id: 'f9',
    question: 'Is there more than one campus?',
    answer:
      'No. Everything happens on the Bahadurpura site off Doodh Bowli Road - one campus, one staff room, one standard. No child is taught anywhere else.',
  },
  {
    id: 'f10',
    question: 'How long does the whole process take?',
    answer:
      'About six weeks from first enquiry to a written offer, assuming documents are complete. Your coordinator gives you the specific dates for your application at the start.',
  },
];
