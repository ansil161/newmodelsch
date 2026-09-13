import type { ActivityStrand, DayBlock, SafetyMeasure, StudentFilm } from '@/types';
import { voiceImages } from './imagery';
import { img } from './media';

/* ==========================================================================
   PAGE 04 — Student Life
   --------------------------------------------------------------------------
   Owns one question: 'What will my child's day feel like here?' The page is
   deliberately visual and human; the facility grid is reused from the home
   page's campus section rather than re-photographed here.
   ========================================================================== */

export const CAMPUS_INTRO = {
  eyebrow: 'Bahadurpura · Hyderabad',
  title: 'Four acres a child can cross without an adult worrying.',
  lead: 'The main campus was built around a courtyard so that no corridor is a dead end and no child is ever out of sight of a teacher. Everything else - the labs, the field, the library - is arranged off that one idea.',
  facts: [
    { value: '4', label: 'Acres', detail: 'Bahadurpura campus' },
    { value: '48', label: 'Classrooms', detail: 'All naturally lit' },
    { value: '22,000', label: 'Library volumes', detail: 'Reading hall for 120' },
    { value: '11', label: 'Laboratories', detail: 'Science, computing, robotics' },
  ],
  image: img('1562774053-701939374585', 1800),
  imageAlt: 'The main campus courtyard between lessons',
} as const;

export const DAY_BLOCKS: DayBlock[] = [
  {
    time: '07:45',
    tag: 'Open',
    icon: 'users',
    title: 'Arrival',
    description:
      'Gates open to teachers already standing in the courtyard. The first fifteen minutes are unstructured on purpose - friendships happen before the bell, not after it.',
  },
  {
    time: '08:15',
    tag: 'Open',
    icon: 'sparkle',
    title: 'Assembly',
    description:
      'Ten minutes, student-led. A reading, the day\'s notices, and whoever won something yesterday says how. House captains run it; staff watch.',
  },
  {
    time: '08:30',
    tag: 'Academic',
    icon: 'book',
    title: 'First teaching block',
    description:
      'Three periods with the subjects that need the sharpest heads - mathematics, languages, sciences - scheduled where attention actually is.',
  },
  {
    time: '10:45',
    tag: 'Break',
    icon: 'compass',
    title: 'Break',
    description:
      'Twenty minutes outdoors, weather permitting, which in Hyderabad it usually does. Teachers eat in the courtyard with the children, not away from them.',
  },
  {
    time: '11:05',
    tag: 'Practical',
    icon: 'atom',
    title: 'Practical block',
    description:
      'Laboratory, studio, computing or library. This block is protected: it is never surrendered to revision, however close the exams are.',
  },
  {
    time: '12:40',
    tag: 'Break',
    icon: 'users',
    title: 'Lunch',
    description:
      'Mixed-year tables by house. Younger students sit with older ones - the simplest thing we do, and the one alumni mention most.',
  },
  {
    time: '13:20',
    tag: 'Academic',
    icon: 'bulb',
    title: 'Afternoon teaching',
    description:
      'Two periods, then the mentor check-in - fifteen minutes where a named adult asks eighteen children how the day actually went.',
  },
  {
    time: '15:00',
    tag: 'Practical',
    icon: 'star',
    title: 'Activities & support',
    description:
      'Sport, music, theatre, clubs and small-group academic support run side by side. Every child is in something; nobody is in a corridor.',
  },
  {
    time: '16:30',
    tag: 'Close',
    icon: 'clock',
    title: 'Departure',
    description:
      'Staggered by age, supervised to the gate. Teams and rehearsals run on until six, and the library stays open with them.',
  },
];

export const ACTIVITY_STRANDS: ActivityStrand[] = [
  {
    id: 'sports',
    icon: 'star',
    accent: 'coral',
    stat: { value: '6', label: 'Periods a week' },
    title: 'Sport',
    meta: 'Six periods a week · Professional coaching',
    items: [
      'Athletics - track, field, cross country',
      'Cricket - nets, three age-group squads',
      'Basketball and volleyball',
      'Badminton and table tennis',
      'Yoga and conditioning',
    ],
    image: img('1552674605-db6ffd4facb5', 1100),
    imageAlt: 'School athletes training on the field',
  },
  {
    id: 'arts',
    icon: 'sparkle',
    accent: 'violet',
    stat: { value: '14', label: 'Productions a year' },
    title: 'Arts & Music',
    meta: 'Timetabled and examined, 14 productions a year',
    items: [
      'Fine art, drawing and painting',
      'Carnatic and Western vocal',
      'Percussion, keyboard and strings',
      'Theatre and stagecraft',
      'Design and ceramics',
    ],
    image: img('1513364776144-60967b0f800f', 1100),
    imageAlt: 'Students working in the art studio',
  },
  {
    id: 'clubs',
    icon: 'users',
    accent: 'mint',
    stat: { value: '18', label: 'Student-run societies' },
    title: 'Clubs & Councils',
    meta: 'Student-run · Real budgets',
    items: [
      'Student council and house system',
      'Model United Nations',
      'Robotics and coding club',
      'Debate, quiz and literary society',
      'Eco club and community service',
    ],
    image: img('1571260899304-425eee4c7efc', 1100),
    imageAlt: 'Student council members in discussion',
  },
  {
    id: 'competitions',
    icon: 'globe',
    accent: 'blue',
    stat: { value: '40+', label: 'Events entered a year' },
    title: 'Competitions & Trips',
    meta: 'National circuit · Annual expeditions',
    items: [
      'National robotics championship',
      'Inter-school athletics and cricket',
      'Olympiads in mathematics and science',
      'Annual residential expedition, Classes 6-10',
      'Community service placements',
    ],
    image: img('1517420704952-d9f39e95b43e', 1100),
    imageAlt: 'Students competing at a robotics championship',
  },
];

export const SAFETY_MEASURES: SafetyMeasure[] = [
  {
    id: 'access',
    icon: 'lock',
    title: 'Single controlled entry',
    description:
      'One supervised gate. Visitors are logged, badged and escorted; children are released only to a registered guardian or an authorised pickup.',
  },
  {
    id: 'cctv',
    icon: 'camera',
    title: 'Monitored common areas',
    description:
      'Corridors, courtyards, stairwells and gates are camera-covered and reviewed. Classrooms, changing rooms and washrooms are not - by policy.',
  },
  {
    id: 'medical',
    icon: 'plus',
    title: 'Full-time medical room',
    description:
      'A qualified nurse on site through the school day, a tied-up hospital nine minutes away, and a parent call on every incident however small.',
  },
  {
    id: 'transport',
    icon: 'bus',
    title: 'GPS-tracked transport',
    description:
      'Every bus is tracked and staffed with an attendant. Parents see the live route and get an arrival notification on the school app.',
  },
  {
    id: 'staff',
    icon: 'star',
    title: 'Verified staff',
    description:
      'Background verification for every adult on campus, teaching or otherwise, plus annual child-protection training for all staff.',
  },
  {
    id: 'wellbeing',
    icon: 'users',
    title: 'Counselling and anti-bullying',
    description:
      'Two full-time counsellors, a published anti-bullying procedure, and a reporting route a child can use without going through their own teacher.',
  },
];

/* ==========================================================================
   The student films — four clips, on the reel
   --------------------------------------------------------------------------
   WHY THIS EXISTS WHEN THE PAGE ALREADY HAS QUOTES ON IT.

   A printed quote is the school's account of what a child said. A child on
   film saying it is the child. The whole value of this section is that it is
   the one place on the site where the school is not the narrator, so the copy
   here has to sound like the student and not like the prospectus — no
   ‘nurturing environment’, no ‘holistic’, and no sentence a fourteen-year-old
   would not say out loud.

   FOUR, AND NOT MORE.

   Four fits one row on a laptop without any of them collapsing to a sliver,
   and four is about as many strangers as a parent will actually sit through.
   A fifth is not more evidence; it is a queue.

   The names are the ones already quoted elsewhere on the site wherever they
   exist, so a parent who read Aarav on the homepage meets the same Aarav
   here. Replace these with real students and real clips before launch.
   ========================================================================== */

export const STUDENT_VOICES = {
  eyebrow: 'In their own words',
  lead: 'Four students, filmed in one afternoon, each asked the same question and none of them shown the answer first. Nothing below is a script, and nothing was re-recorded.',
  footnote: 'Filmed in the courtyard and the library. Every family gave written permission.',
} as const;

export const STUDENT_FILMS: StudentFilm[] = [
  {
    id: 'aarav',
    name: 'Aarav Menon',
    role: 'Class 10 · Robotics',
    pull: 'I built my first robot in Class 6 and it did not work. My teacher made me present the failure to the whole class. That is when I actually learnt something.',
    runtime: '1:12',
    src: '/videos/voices/aarav.mp4',
    poster: voiceImages.aarav,
  },
  {
    id: 'kavya',
    name: 'Kavya Reddy',
    role: 'Class 9 · House captain',
    pull: 'I was running a team of twelve at fourteen. Nobody checked whether I was ready. They just told me Thursday was mine.',
    runtime: '0:58',
    src: '/videos/voices/kavya.mp4',
    poster: voiceImages.kavya,
  },
  {
    id: 'zoya',
    name: 'Zoya Fatima',
    role: 'Class 7 · Library monitor',
    pull: 'I was the quiet one in my old school and I stayed quiet for a term here too. Then somebody put me in charge of the reading hour, and that was that.',
    runtime: '1:04',
    src: '/videos/voices/zoya.mp4',
    poster: voiceImages.zoya,
  },
  {
    id: 'rohan',
    name: 'Rohan Deshpande',
    role: 'Class 10 · Athletics',
    pull: 'Training is before school, so I am on the track at six. No teacher has ever once asked me to choose between that and my marks.',
    runtime: '1:21',
    src: '/videos/voices/rohan.mp4',
    poster: voiceImages.rohan,
  },
];

export const VISIT_CAMPUS = {
  eyebrow: 'See it for yourself',
  title: 'A website can only get you so far.',
  lead: 'Campus visits run every Tuesday and Thursday morning during term, and on the first Saturday of each month. You will see ordinary lessons in progress - we do not stage them.',
  points: [
    'Forty-five minutes, walked by a member of the senior team',
    'Classrooms, labs, library, field and the dining hall',
    'Time with the head of your child\'s prospective stage',
    'No obligation, and no admissions pitch at the end',
  ],
  slots: ['Tuesday · 9:30 am', 'Thursday · 9:30 am', 'First Saturday · 10:00 am'],
  image: img('1571260899304-425eee4c7efc', 1400),
  imageAlt: 'The school entrance on a weekday morning',
} as const;
