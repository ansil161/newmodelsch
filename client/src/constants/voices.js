import { TESTIMONIALS } from './index';
import { STUDENT_FILMS } from './campus-life';
import { voiceImages } from './imagery';
import { ALUMNI, LEADERSHIP } from './people';

/* ==========================================================================
   VOICES - the community stories, in four registers
   --------------------------------------------------------------------------
   The home page's testimonial section reads from this file and from nothing
   else. It is composed rather than authored: every quote below is already
   somewhere in the project's content, and this module only decides which of
   them the home page shows, in what order, and which trailing phrase is set
   in the handwritten blue.

   WHERE EACH CATEGORY COMES FROM

     Students   TESTIMONIALS + STUDENT_FILMS. The four students who are on
                film are the four the home page shows, so every student story
                here has a clip behind it.
     Teachers   TESTIMONIALS (the staff-room quotes) + LEADERSHIP.
     Alumni     TESTIMONIALS + ALUMNI.
     Parents    TESTIMONIALS.

   NOTHING HERE IS WRITTEN FOR THIS SECTION. If a category needs more voices,
   the quote is added to its source list - TESTIMONIALS, ALUMNI, LEADERSHIP,
   STUDENT_FILMS - and referenced here. That way a quote a family reads on the
   home page is the same quote, word for word, as the one they meet again on
   Student Life or About.

   Parents currently has two, which is every parent quote the project holds.
   The section renders whatever it is given rather than requiring three - but
   two is thin for the strongest audience this page has, and the fix is more
   entries in TESTIMONIALS, not more entries here.

   THE ACCENT

   `accent` is the tail of the quote, and it has to be exactly that: the
   component checks that `quote` ends with it and sets that fragment in the
   handwritten face. It is not a second string to keep in sync - remove the
   accent and the quote is still whole.

   NOT EXPORTED FROM `constants/index.js`. This module imports from it, so
   re-exporting it there would close a cycle. Import from '@/constants/voices'.
   ========================================================================== */

/** Loud rather than silent: a missing source entry is a content bug, and a
 *  section rendering `undefined` is how one survives to production. */
function need(list, match, what) {
  const found = list.find(match);
  if (!found) throw new Error(`voices.js: ${what} is no longer in its source list.`);
  return found;
}

const said = (id) => need(TESTIMONIALS, (t) => t.id === id, `testimonial ${id}`);
const filmed = (id) => need(STUDENT_FILMS, (f) => f.id === id, `student film ${id}`);
const alum = (id) => need(ALUMNI, (a) => a.id === id, `alumni profile ${id}`);
const staff = (id) => need(LEADERSHIP, (p) => p.id === id, `leadership profile ${id}`);

/* --------------------------------------------------------------------------
   01 - Students

   The four who are also on film in the reel on Student Life, which the
   section's link leads to.
   -------------------------------------------------------------------------- */

const STUDENTS = [
  {
    id: 'aarav',
    name: said('t3').name,
    role: filmed('aarav').role,
    quote: said('t3').quote,
    accent: 'that is when I actually learnt.',
    photo: voiceImages.aarav,
    film: { src: filmed('aarav').src, runtime: filmed('aarav').runtime },
  },
  {
    id: 'kavya',
    name: said('t4').name,
    role: filmed('kavya').role,
    quote: said('t4').quote,
    accent: 'gave them that.',
    photo: voiceImages.kavya,
    film: { src: filmed('kavya').src, runtime: filmed('kavya').runtime },
  },
  {
    id: 'zoya',
    name: filmed('zoya').name,
    role: filmed('zoya').role,
    quote: filmed('zoya').pull,
    accent: 'and that was that.',
    photo: voiceImages.zoya,
    film: { src: filmed('zoya').src, runtime: filmed('zoya').runtime },
  },
  {
    id: 'rohan',
    name: filmed('rohan').name,
    role: filmed('rohan').role,
    quote: filmed('rohan').pull,
    accent: 'between that and my marks.',
    photo: voiceImages.rohan,
    film: { src: filmed('rohan').src, runtime: filmed('rohan').runtime },
  },
];

/* --------------------------------------------------------------------------
   02 - Teachers
   -------------------------------------------------------------------------- */

const TEACHERS = [
  {
    id: 'lakshmi',
    name: said('t7').name,
    role: said('t7').role,
    quote: said('t7').quote,
    accent: 'rarer than it should be.',
    photo: said('t7').photo,
  },
  {
    id: 'rahul',
    name: said('t8').name,
    role: said('t8').role,
    quote: said('t8').quote,
    accent: 'before they can name it.',
    photo: said('t8').photo,
  },
  {
    id: 'fatima',
    name: staff('head-pastoral').name,
    role: staff('head-pastoral').role,
    quote: staff('head-pastoral').quote ?? '',
    accent: 'That is the whole design.',
    photo: {
      id: '1573497019940-1c28c88b4f3e',
      alt: `Portrait of ${staff('head-pastoral').name}`,
      focus: '50% 28%',
    },
  },
  {
    id: 'suresh',
    name: staff('head-primary').name,
    role: staff('head-primary').role,
    quote: staff('head-primary').quote ?? '',
    accent: 'We staff them accordingly.',
    photo: {
      id: '1507003211169-0a1dd7228f2d',
      alt: `Portrait of ${staff('head-primary').name}`,
      focus: '50% 26%',
    },
  },
];

/* --------------------------------------------------------------------------
   03 - Alumni
   -------------------------------------------------------------------------- */

const ALUMNI_VOICES = [
  {
    id: 'praveen',
    name: said('t5').name,
    role: said('t5').role,
    quote: said('t5').quote,
    accent: 'it does not end when you leave.',
    photo: said('t5').photo,
  },
  {
    id: 'neha',
    name: said('t6').name,
    role: said('t6').role,
    quote: said('t6').quote,
    accent: 'not the coaching centre.',
    photo: said('t6').photo,
  },
  {
    id: 'karthik',
    name: alum('al3').name,
    role: `${alum('al3').batch} · ${alum('al3').now}`,
    quote: alum('al3').quote,
    accent: 'than any preparation I paid for afterwards.',
    photo: {
      id: '1500648767791-00dcc994a43e',
      alt: `Portrait of ${alum('al3').name}`,
      focus: '50% 26%',
    },
  },
  {
    id: 'shreya',
    name: alum('al4').name,
    role: `${alum('al4').batch} · ${alum('al4').now}`,
    quote: alum('al4').quote,
    accent: 'and then asked me why it failed.',
    photo: {
      id: '1494790108377-be9c29b29330',
      alt: `Portrait of ${alum('al4').name}`,
      focus: '50% 26%',
    },
  },
];

/* --------------------------------------------------------------------------
   04 - Parents
   -------------------------------------------------------------------------- */

const PARENTS = [
  {
    id: 'sridevi',
    name: said('t1').name,
    role: said('t1').role,
    quote: said('t1').quote,
    accent: 'not her roll number.',
    photo: said('t1').photo,
  },
  {
    id: 'imran',
    name: said('t2').name,
    role: said('t2').role,
    quote: said('t2').quote,
    accent: 'Nobody had asked us that.',
    photo: said('t2').photo,
  },
];

/* --------------------------------------------------------------------------
   The section's own copy
   -------------------------------------------------------------------------- */

export const VOICE_SECTION = {
  eyebrow: 'Community stories',
  /** Two lines. The second one is handwritten. */
  title: ['Real Voices,', 'True Journeys'],
  cta: { label: 'Watch their stories', to: '/student-life#voices' },
  ctaNote: 'Real people. Real experiences.',
  railNote: 'More stories',
};

/* --------------------------------------------------------------------------
   The four categories, in the order they are offered
   --------------------------------------------------------------------------
   Students lead, because the reference composition is a student's face and
   because a parent reading a school's own page believes a child's account of
   it before anybody else's. Parents close the set rather than opening it for
   the same reason: a parent quote is the strongest card here, and it lands
   harder after three other kinds of witness than it does cold.
   -------------------------------------------------------------------------- */

export const VOICE_CATEGORIES = [
  {
    id: 'students',
    index: '01',
    label: 'Students',
    eyebrow: 'Student stories',
    lead: 'Hear from our students about their experiences, what changed for them here, and the teachers who changed it.',
    stories: STUDENTS,
  },
  {
    id: 'teachers',
    index: '02',
    label: 'Teachers',
    eyebrow: 'The staff room',
    lead: 'The people who teach here on what the school asks of them, and on the two or three things it will not compromise.',
    stories: TEACHERS,
  },
  {
    id: 'alumni',
    index: '03',
    label: 'Alumni',
    eyebrow: 'After school',
    lead: 'Former students, years and decades on, on what turned out to have mattered once they had left the building.',
    stories: ALUMNI_VOICES,
  },
  {
    id: 'parents',
    index: '04',
    label: 'Parents',
    eyebrow: 'Family voices',
    lead: 'Families who chose this school for their children, on the first meeting, the years since, and whether they would do it again.',
    stories: PARENTS,
  },
];
