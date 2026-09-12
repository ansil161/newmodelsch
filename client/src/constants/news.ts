import type { NewsCategory, NewsItem, Notice, ResourceFile, SchoolEvent } from '@/types';
import { img } from './media';

/* ==========================================================================
   PAGE 06 — News & Resources
   --------------------------------------------------------------------------
   Utility-first and CMS-shaped. Every array here is the shape a CMS would
   return, so swapping the constants for a fetch changes no component.
   ========================================================================== */

export const NEWS_CATEGORIES: readonly ('All' | NewsCategory)[] = [
  'All',
  'Academics',
  'Sports',
  'Arts',
  'Campus',
  'Community',
] as const;

export const NEWS: NewsItem[] = [
  {
    id: 'n1',
    category: 'Academics',
    date: '28 August 2026',
    title: 'Twelfth consecutive 100% board result, and a deeper cohort behind it',
    excerpt:
      'The board cohort cleared in full for the twelfth year running - but the number the staff room is actually talking about is 68%, the share of Class 10 above ninety. Here is what changed in the two years before the exam.',
    image: img('1659985281435-d8d3ea55b55c', 1600),
    imageAlt: 'Students celebrating their board results in the courtyard',
    featured: true,
  },
  {
    id: 'n2',
    category: 'Sports',
    date: '19 August 2026',
    title: 'Three golds at the state athletics meet',
    excerpt:
      'The under-17 squad took the 400m, long jump and 4×100m relay, and finished fourth overall against schools four times our size.',
    image: img('1461896836934-ffe607ba8211', 900),
    imageAlt: 'A school athlete competing on the track',
  },
  {
    id: 'n3',
    category: 'Academics',
    date: '11 August 2026',
    title: 'Fourteen students qualify for the regional Mathematics Olympiad',
    excerpt:
      'The largest group the school has sent, and the first time every one of them came out of the ordinary timetable rather than an extra class.',
    image: img('1509228468518-180dd4864904', 900),
    imageAlt: 'Students working on mathematics problems',
  },
  {
    id: 'n4',
    category: 'Campus',
    date: '02 August 2026',
    title: 'The robotics floor reopens after its summer rebuild',
    excerpt:
      'Twelve new workstations, a dedicated fabrication bay, and enough machines that a Class 6 group no longer shares.',
    image: img('1581092160562-40aa08e78837', 900),
    imageAlt: 'The rebuilt robotics laboratory',
  },
  {
    id: 'n5',
    category: 'Arts',
    date: '24 July 2026',
    title: 'A student-written one-act takes best production',
    excerpt:
      'Written in the literary society, staged by Classes 9 to 12, and awarded at the inter-school theatre festival.',
    image: img('1493225457124-a3eb161ffa5f', 900),
    imageAlt: 'Students performing on stage',
  },
  {
    id: 'n6',
    category: 'Community',
    date: '15 July 2026',
    title: 'Nine hundred service hours logged in a single term',
    excerpt:
      'Classes 8 to 10, working with three partner organisations in Hyderabad. Service hours are reported alongside academics.',
    image: img('1571260899304-425eee4c7efc', 900),
    imageAlt: 'Students working on a community service placement',
  },
  {
    id: 'n7',
    category: 'Campus',
    date: '04 July 2026',
    title: 'The library adds two thousand volumes and a quiet floor',
    excerpt:
      'The reading hall now seats 120, and the upper floor is silent by rule between two and six every afternoon.',
    image: img('1568667256549-094345857637', 900),
    imageAlt: 'The school library reading hall',
  },
  {
    id: 'n8',
    category: 'Sports',
    date: '21 June 2026',
    title: 'Under-15 cricket squad goes unbeaten through the district season',
    excerpt:
      'Nine matches, nine wins, and a bowling attack that came almost entirely out of the Class 8 cohort.',
    image: img('1546519638-68e109498ffc', 900),
    imageAlt: 'The school cricket squad on the field',
  },
  {
    id: 'n9',
    category: 'Academics',
    date: '12 June 2026',
    title: 'The 2026-27 session opens on 12 June',
    excerpt:
      'Two thousand four hundred students returned, including the largest Nursery intake the school has admitted.',
    image: img('1580582932707-520aed937b7b', 900),
    imageAlt: 'A classroom on the first day of the session',
  },
];

export const EVENTS: SchoolEvent[] = [
  {
    id: 'e1',
    date: '2026-09-12',
    day: '12',
    month: 'Sep',
    title: 'Open house - prospective parents',
    detail: 'Walk the campus during a working day and meet the heads of each stage.',
    location: 'Bahadurpura campus',
  },
  {
    id: 'e2',
    date: '2026-09-20',
    day: '20',
    month: 'Sep',
    title: 'Inter-house athletics meet',
    detail: 'All four houses, Classes 4 to 10. Parents welcome from 8:00 am.',
    location: 'Bahadurpura campus ground',
  },
  {
    id: 'e3',
    date: '2026-10-02',
    day: '02',
    month: 'Oct',
    title: 'Founders’ Week begins',
    detail: 'Six days of exhibitions, performances and the alumni return day.',
    location: 'Bahadurpura campus',
  },
  {
    id: 'e4',
    date: '2026-10-18',
    day: '18',
    month: 'Oct',
    title: 'Parent-teacher conference, Term 1',
    detail: 'Slots booked through the school app from 4 October.',
    location: 'By campus',
  },
  {
    id: 'e5',
    date: '2026-11-08',
    day: '08',
    month: 'Nov',
    title: 'Science & robotics exhibition',
    detail: 'Class 6 to 12 projects, judged and open to the public.',
    location: 'Main Campus, robotics floor',
  },
  {
    id: 'e6',
    date: '2026-12-06',
    day: '06',
    month: 'Dec',
    title: 'Annual Day',
    detail: 'The full production, staged twice to fit every family.',
    location: 'Main Campus auditorium',
  },
];

export const NOTICES: Notice[] = [
  {
    id: 'no1',
    date: '02 September 2026',
    title: 'Admissions 2026-27: applications open 5 January',
    detail:
      'Enquiries are being accepted now. Campus visits run Tuesday and Thursday mornings, and the first Saturday of each month.',
    urgent: true,
  },
  {
    id: 'no2',
    date: '29 August 2026',
    title: 'Term 1 examination schedule published',
    detail:
      'Datesheets for Classes 6 to 12 are in the downloads section. Practical schedules follow by 10 September.',
  },
  {
    id: 'no3',
    date: '22 August 2026',
    title: 'Revised bus routes for the western corridor',
    detail:
      'Routes 7, 9 and 12 have new pickup points from 1 September. Affected families have been contacted directly.',
  },
  {
    id: 'no4',
    date: '14 August 2026',
    title: 'Independence Day - school closed 15 August',
    detail: 'Flag hoisting at 8:00 am on campus. Attendance is voluntary and parents are welcome.',
  },
  {
    id: 'no5',
    date: '05 August 2026',
    title: 'Annual medical screening, Nursery to Class 5',
    detail:
      'Conducted on campus between 18 and 22 August. Consent forms are due by 14 August.',
  },
  {
    id: 'no6',
    date: '25 July 2026',
    title: 'School app: new attendance and transport notifications',
    detail:
      'Parents now receive bus arrival alerts and same-day absence notifications. Update the app to the latest version.',
  },
];

export const RESOURCES: ResourceFile[] = [
  {
    id: 'rs1',
    group: 'Admissions',
    title: 'Admission application form 2026-27',
    detail: 'Complete and submit with the document checklist at any campus office.',
    format: 'PDF',
    size: '412 KB',
  },
  {
    id: 'rs2',
    group: 'Admissions',
    title: 'Document checklist',
    detail: 'Everything required by entry class, on one page.',
    format: 'PDF',
    size: '186 KB',
  },
  {
    id: 'rs3',
    group: 'Admissions',
    title: 'Transport route map',
    detail: 'Current routes and pickup points for the Bahadurpura campus.',
    format: 'PDF',
    size: '2.1 MB',
  },
  {
    id: 'rs4',
    group: 'Academics',
    title: 'Academic calendar 2026-27',
    detail: 'Terms, holidays, examination windows and event dates.',
    format: 'PDF',
    size: '340 KB',
  },
  {
    id: 'rs5',
    group: 'Academics',
    title: 'Term 1 examination datesheet',
    detail: 'Classes 6 to 12, including practical schedules.',
    format: 'PDF',
    size: '224 KB',
  },
  {
    id: 'rs6',
    group: 'Academics',
    title: 'Book and stationery list by class',
    detail: 'Nursery through Class 10, with approved editions.',
    format: 'PDF',
    size: '508 KB',
  },
  {
    id: 'rs7',
    group: 'Parent information',
    title: 'Parent handbook',
    detail: 'Timings, uniform, attendance, communication and school policy.',
    format: 'PDF',
    size: '1.4 MB',
  },
  {
    id: 'rs8',
    group: 'Parent information',
    title: 'Child protection & anti-bullying policy',
    detail: 'Procedure, reporting routes and named safeguarding leads.',
    format: 'PDF',
    size: '298 KB',
  },
  {
    id: 'rs9',
    group: 'Parent information',
    title: 'Medical and consent forms',
    detail: 'Annual screening, allergies, and trip consent.',
    format: 'DOCX',
    size: '96 KB',
  },
  {
    id: 'rs10',
    group: 'Circulars',
    title: 'Circular - revised bus routes, September',
    detail: 'Routes 7, 9 and 12, effective 1 September 2026.',
    format: 'PDF',
    size: '142 KB',
  },
  {
    id: 'rs11',
    group: 'Circulars',
    title: 'Circular - Founders’ Week programme',
    detail: 'Six-day schedule with alumni return day details.',
    format: 'PDF',
    size: '760 KB',
  },
  {
    id: 'rs12',
    group: 'Circulars',
    title: 'Circular - parent-teacher conference booking',
    detail: 'How to book Term 1 slots through the school app.',
    format: 'PDF',
    size: '118 KB',
  },
];

export const RESOURCE_GROUPS = [
  'Admissions',
  'Academics',
  'Parent information',
  'Circulars',
] as const;
