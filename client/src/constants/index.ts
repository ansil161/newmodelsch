import type {
  Branch,
  CampusTile,
  EducationCard,
  Feature,
  GalleryItem,
  HeritageChapter,
  JourneyNode,
  Milestone,
  NavRoute,
  Stat,
  Testimonial,
} from '@/types';

import { img } from './media';

/* ==========================================================================
   Institution
   ========================================================================== */

export const SCHOOL = {
  name: 'New Model High School',
  shortName: 'NMHS',
  established: 1962,
  city: 'Hyderabad, India',
  locality: 'Bahadurpura, Hyderabad',
  address: 'Doodh Bowli Road, Kabutar Khana, Bahadurpura, Hyderabad, Telangana',
  phone: '+91 40 2345 6789',
  phoneHref: 'tel:+914023456789',
  email: 'admissions@newmodelhighschool.edu.in',
  session: '2026-27',
} as const;

/* ==========================================================================
   Routes
   --------------------------------------------------------------------------
   Six pages, one per stage of a parent's decision — Discovery, Trust,
   Evaluation, Experience, Decision, Action. One page owns one question, so
   these paths are the whole sitemap; there are no orphan pages below them.

     Discovery  · Is this school right for my child?   · Home
     Trust      · Who are they, and can I trust them?  · About
     Evaluation · What will my child actually learn?   · Academics
     Experience · What will student life look like?    · Student Life
     Decision   · How do I enroll my child?            · Admissions
     Action     · How can I visit or contact them?     · Contact & Visit
   ========================================================================== */

export const ROUTES = {
  home: '/',
  about: '/about',
  academics: '/academics',
  studentLife: '/student-life',
  admissions: '/admissions',
  contact: '/contact',
  /** The one page that sits below a chapter: Student Life's photographic
   *  archive, with a page per academic year and per event beneath it. */
  gallery: '/student-life/gallery',
} as const;

/**
 * Paths from the previous architecture, kept alive as redirects.
 *
 * `/about-education` split into About and Academics — a parent following an
 * old link is asking the trust question, so it lands on About.
 * `/people-achievements` no longer exists at all: its leadership, faculty and
 * alumni are on About, its results on Academics.
 */
export const LEGACY_ROUTES = [
  { from: '/about-education', to: ROUTES.about },
  { from: '/campus-life', to: ROUTES.studentLife },
  { from: '/people-achievements', to: ROUTES.about },
] as const;

/**
 * Sign-in. Kept apart from ROUTES, which is the public sitemap: these pages
 * are not in the navigation, the footer or the 404's list of destinations.
 * There is no registration route - accounts are issued by the school.
 */
export const AUTH_ROUTES = {
  login: '/login',
  /** Where a sign-in lands when it was not sent from a protected page. */
  dashboard: '/dashboard',
} as const;

export const NAV_LINKS: NavRoute[] = [
  { label: 'Home', href: ROUTES.home, blurb: 'The school at a glance' },
  { label: 'About', href: ROUTES.about, blurb: 'Story, values, philosophy and leadership' },
  { label: 'Academics', href: ROUTES.academics, blurb: 'What a child learns, Nursery to Class 10' },
  {
    label: 'Student Life',
    href: ROUTES.studentLife,
    blurb: 'Where the day actually happens',
    children: [{ label: 'Gallery', href: ROUTES.gallery, blurb: 'The living yearbook' }],
  },
  { label: 'Admissions', href: ROUTES.admissions, blurb: 'Everything needed to join' },
  { label: 'Contact & Visit', href: ROUTES.contact, blurb: 'Visit, call or write to us' },
];


/* ==========================================================================
   02 — Heritage
   --------------------------------------------------------------------------
   HERITAGE_FRAMES is the shared archive strip that the Impact section pulls
   stills out of, so it stays a flat list of URLs. The hero keeps its own set
   (HERO_STILLS) — its frames answer to the headline's corner layout, which is
   a constraint nothing else here shares.

   HERITAGE_CHAPTERS is the story the timeline tells — one entry per stop on
   the rail. Entries are meant to be uneven: some carry a photograph, one
   carries a quotation, most carry neither.
   ========================================================================== */

export const HERITAGE_FRAMES = [
  img('1573894997713-de07a124df43', 1600), // a classroom, graded to archival
  img('1580582932707-520aed937b7b', 1600),
  img('1541339907198-e08756dedf3f', 1600),
  img('1562774053-701939374585', 1600),
  img('1573894997713-de07a124df43', 1600),
  img('1561144257-e32e8efc6c4f', 1600),
  img('1571260899304-425eee4c7efc', 1600), // present day, full colour
];

export const HERITAGE_CHAPTERS: HeritageChapter[] = [
  {
    date: 'June 1962',
    headline:
      'Two rented rooms above a stationery shop, forty children, and a promise made to their parents in person.',
    body:
      'The founders had no building, no board affiliation and no second year of funding. What they had was a register with forty names in it and a conviction that a school is a set of standards long before it is a set of walls.',
    media: {
      src: img('1573894997713-de07a124df43', 1200),
      alt: 'The founding classroom, photographed in the school’s first year',
      note: 'The first classroom, 1962',
    },
  },
  {
    date: 'March 1975',
    headline:
      'The first batch walks out with a state rank - and every batch since has inherited the standard.',
    aside:
      'Thirteen years after the first register was opened, a New Model student finished in the state’s top ten. The photograph went up in the corridor. It is still there.',
    media: {
      src: img('1627556704290-2b1f5853ff78', 1200),
      alt: 'Students receiving academic honours at an assembly',
      note: 'The honours board gets its first name',
    },
  },
  {
    date: 'August 1985',
    badge: 'A campus of our own',
    headline:
      'Laboratories, a library and a field replace the rented rooms. The school stops borrowing space and starts building it.',
    body:
      'Purpose-built from the first brick: three science laboratories, a library sized for the whole senior school at once, and a ground long enough to hold a full-length track.',
    media: {
      src: img('1592280771190-3e2e4d571952', 1200),
      alt: 'The purpose-built campus building shortly after completion',
      note: 'Opening week, before the paint had properly dried',
    },
  },
  {
    date: 'January 2000',
    headline:
      'The first computer laboratory opens, and every child - not every senior - gets a keyboard hour.',
    aside:
      'The decision to give the primary years lab time as well was argued over for a full term. It has not been argued over since.',
    media: {
      src: img('1516321318423-f06f85e504b3', 1200),
      alt: 'Students working at the first computer laboratory',
      note: 'Twenty-four machines, one per child',
    },
  },
  {
    date: 'September 2008',
    headline:
      'The Doodh Bowli Road building doubles - a science block, a library and a field, on the same plot.',
    body:
      'Growth was deliberately slow, and deliberately in one place. Every new room opened only once it had its own teacher and its own equipment - never a second address, always a deeper school.',
  },
  {
    date: 'July 2014',
    headline: 'A new campus, built around how children actually learn.',
    quote: {
      text:
        '“We stopped designing rooms that face a blackboard and started designing rooms that face each other. The change in how the children work in them was immediate, and it was not subtle.”',
      author: 'Principal, New Model High School',
    },
    media: {
      src: img('1562774053-701939374585', 1200),
      alt: 'A modern classroom on the new campus',
      note: 'Every room daylit from two sides',
    },
  },
  {
    date: 'April 2020',
    headline:
      'Fourteen days to move an entire school online - and not a single board year is lost.',
    aside:
      'Teachers were trained over a single week. Attendance stayed above ninety per cent across every class for the whole of the first term.',
  },
  {
    date: 'Today',
    badge: 'Sixty-four years in',
    headline:
      'One campus, Nursery through Class 10, and the same standard the first forty children were held to.',
    body:
      'What began as a promise made in person is now made to several thousand families a year. The scale changed. The promise did not.',
    link: { label: 'Read the full story', href: ROUTES.about },
    media: {
      src: img('1571260899304-425eee4c7efc', 1200),
      alt: 'Students on the New Model High School campus today',
      note: 'The campus this morning',
    },
  },
];

/* ==========================================================================
   03 — Legacy timeline
   ========================================================================== */

export const MILESTONES: Milestone[] = [
  {
    year: '1962',
    title: 'Foundation',
    description: 'Forty students, two rooms, and a promise made to the first parents.',
    image: img('1573894997713-de07a124df43', 900),
    imageAlt: 'Archival photograph of the founding class',
  },
  {
    year: '1975',
    title: 'First Board Toppers',
    description: 'Our first state rank holder sets a standard every batch inherits.',
    image: img('1627556704290-2b1f5853ff78', 900),
    imageAlt: 'Students receiving academic honours at a ceremony',
  },
  {
    year: '1985',
    title: 'Campus Expansion',
    description: 'A purpose-built campus rises - laboratories, library and a field.',
    image: img('1592280771190-3e2e4d571952', 900),
    imageAlt: 'The expanded school campus building',
  },
  {
    year: '2000',
    title: 'Technology Integration',
    description: 'The first computer lab opens. Every child gets a keyboard hour.',
    image: img('1516321318423-f06f85e504b3', 900),
    imageAlt: 'Students working in the first computer laboratory',
  },
  {
    year: '2010',
    title: 'Sports Excellence',
    description: 'Twenty-two state titles across athletics, cricket and basketball.',
    image: img('1461896836934-ffe607ba8211', 900),
    imageAlt: 'School athletes competing on the track',
  },
  {
    year: '2020',
    title: 'Robotics & Innovation',
    description: 'A dedicated robotics lab puts engineering in Class 6 hands.',
    image: img('1561144257-e32e8efc6c4f', 900),
    imageAlt: 'Students building a robot in the innovation lab',
  },
  {
    year: '2026',
    title: 'Future Vision',
    description: 'One campus. Ten thousand alumni. An AI-ready curriculum.',
    image: img('1571260899304-425eee4c7efc', 900),
    imageAlt: 'The modern campus today',
  },
];

/* ==========================================================================
   04 — Education reimagined
   ========================================================================== */

export const EDUCATION_CARDS: EducationCard[] = [
  {
    id: 'academics',
    index: '01',
    eyebrow: 'Academic Excellence',
    title: 'Results that were never negotiable.',
    description:
      'Small cohorts, subject specialists, and a remediation loop that catches a child in the week they slip - not the term after.',
    chips: [
      { icon: 'users', label: 'Small cohorts' },
      { icon: 'clock', label: 'Weekly remediation' },
    ],
    statValue: '100%',
    statLabel: 'Board results, twelve years running',
    image: img('1524178232363-1fb2b075b655', 1200),
    imageAlt: 'A teacher working through a problem with senior students',
  },
  {
    id: 'robotics',
    index: '02',
    eyebrow: 'STEM & Innovation',
    title: 'Engineering, from Class 6.',
    description:
      'A full robotics and electronics lab where students prototype, fail, iterate and compete - nationally, every single year.',
    chips: [
      { icon: 'book', label: 'From Class 6' },
      { icon: 'globe', label: 'National circuit' },
    ],
    statValue: '48',
    statLabel: 'National robotics medals',
    image: img('1581092160562-40aa08e78837', 1200),
    imageAlt: 'A robotic arm in the school innovation laboratory',
  },
  {
    id: 'sports',
    index: '03',
    eyebrow: 'Sports & Athletics',
    title: 'Discipline, learned on a field.',
    description:
      'Professional coaching across athletics, cricket, basketball and badminton - six periods a week, not an afterthought.',
    chips: [
      { icon: 'clock', label: '6 periods a week' },
      { icon: 'star', label: '4 disciplines' },
    ],
    statValue: '22',
    statLabel: 'State championships',
    image: img('1552674605-db6ffd4facb5', 1200),
    imageAlt: 'School athletes training on the field',
  },
  {
    id: 'arts',
    index: '04',
    eyebrow: 'Arts & Creativity',
    title: 'A studio, not a subject.',
    description:
      'Fine art, Carnatic and Western music, theatre and design - timetabled, examined, and taken as seriously as physics.',
    chips: [
      { icon: 'sparkle', label: '5 disciplines' },
      { icon: 'calendar', label: 'Timetabled & examined' },
    ],
    statValue: '14',
    statLabel: 'Annual productions & exhibitions',
    image: img('1513364776144-60967b0f800f', 1200),
    imageAlt: 'Brushes and paint in the school art studio',
  },
  {
    id: 'leadership',
    index: '05',
    eyebrow: 'Leadership Development',
    title: 'Responsibility, from day one.',
    description:
      'House systems, a student council with a real budget, Model UN and peer mentoring - every child leads something.',
    chips: [
      { icon: 'users', label: '4 programmes' },
      { icon: 'shield', label: 'A real budget' },
    ],
    statValue: '9',
    statLabel: 'Student-run councils & clubs',
    image: img('1571260899304-425eee4c7efc', 1200),
    imageAlt: 'Student council members in discussion',
  },
  {
    id: 'character',
    index: '06',
    eyebrow: 'Character Building',
    title: 'The part that outlasts the marksheet.',
    description:
      'Values education, community service hours, and a pastoral system where every child is somebody’s named responsibility.',
    chips: [
      { icon: 'compass', label: 'Service hours' },
      { icon: 'shield', label: 'A named mentor' },
    ],
    statValue: '10,000+',
    statLabel: 'Alumni who still call it home',
    image: img('1571260899304-425eee4c7efc', 1200),
    imageAlt: 'Students in the school assembly courtyard',
  },
];

/* ==========================================================================
   05 — Campus immersion
   ========================================================================== */

export const CAMPUS_HERO: CampusTile = {
  id: 'smart-classrooms',
  title: 'Smart Classrooms',
  meta: '48 rooms · Every grade',
  image: img('1580582932707-520aed937b7b', 1920),
  depth: 1,
};

export const CAMPUS_PAIR: CampusTile[] = [
  {
    id: 'science-labs',
    title: 'Science Labs',
    meta: 'Physics, chemistry, biology',
    image: img('1532094349884-543bc11b234d', 1100),
    depth: 0.6,
  },
  {
    id: 'robotics-lab',
    title: 'Robotics Lab',
    meta: 'Open to Classes 6-10',
    image: img('1581092160562-40aa08e78837', 1100),
    depth: 1.4,
  },
];

export const CAMPUS_WIDE: CampusTile = {
  id: 'library',
  title: 'The Library',
  meta: '22,000 volumes · Reading hall for 120',
  image: img('1568667256549-094345857637', 1920),
  depth: 1,
};

export const CAMPUS_TRIO: CampusTile[] = [
  {
    id: 'sports',
    title: 'Sports Complex',
    meta: 'Track, courts, indoor arena',
    image: img('1546519638-68e109498ffc', 900),
    depth: 0.7,
  },
  {
    id: 'arts',
    title: 'Arts Studio',
    meta: 'Fine art, design, ceramics',
    image: img('1499892477393-f675706cbe6e', 900),
    depth: 1.2,
  },
  {
    id: 'music',
    title: 'Music Wing',
    meta: 'Carnatic, Western, percussion',
    image: img('1511379938547-c1f69419868d', 900),
    depth: 0.9,
  },
];

/* ==========================================================================
   06 — Student journey
   ========================================================================== */

/** Winding path through the 1400 × 520 journey viewBox. */
/**
 * The five stages, drawn as a chart rather than as a road.
 *
 * The x/y co-ordinates these carried until now placed each node on a hand-
 * drawn SVG meander in a 1400x520 viewBox. That diagram is gone — see
 * `Journey.tsx` — and with it the two things it forced: a viewBox nobody could
 * read below 768px, and a second, entirely separate mobile rail kept in step
 * with it by hand. The chart needs no co-ordinates, so the stages carry only
 * what they say.
 *
 * Each one gains a portrait. A five-node chart of empty panels is an org
 * diagram; a face over every panel is what makes it a school.
 */
export const JOURNEY_NODES: JourneyNode[] = [
  {
    id: 'admissions',
    stage: 'Step 01',
    label: 'Admissions',
    detail: 'A conversation, not an interrogation.',
    statement: 'It begins with a conversation, not an interrogation.',
    image: img('1523580494863-6f3031224c94', 640),
    imageAlt: 'A family meeting the admissions team',
  },
  {
    id: 'foundation',
    stage: 'Classes 1-5',
    label: 'Foundation',
    detail: 'Literacy, numeracy, curiosity, habits.',
    statement: 'Literacy, numeracy, and the habits that carry everything after.',
    image: img('1572847748080-bac263fae977', 640),
    imageAlt: 'A primary-age student at work in class',
  },
  {
    id: 'exploration',
    stage: 'Classes 6-8',
    label: 'Exploration',
    detail: 'Labs, robotics, sport, stage, studio.',
    statement: 'The lab, the studio, the field and the stage - all of it, before choosing.',
    image: img('1571260899304-425eee4c7efc', 640),
    imageAlt: 'Middle-school students between lessons',
  },
  {
    id: 'leadership',
    stage: 'Class 9',
    label: 'Leadership',
    detail: 'Councils, houses, mentoring juniors.',
    statement: 'Running a house, and answering for how it goes.',
    image: img('1659985281435-d8d3ea55b55c', 640),
    imageAlt: 'A senior student leading a group',
  },
  {
    id: 'excellence',
    stage: 'Class 10',
    label: 'Excellence',
    detail: 'Boards cleared. Character built.',
    statement: 'Boards cleared inside school hours, and a character built alongside them.',
    image: img('1541339907198-e08756dedf3f', 640),
    imageAlt: 'School leavers throwing their caps at the end of Class 10',
  },
];

/**
 * The one full-size photograph beside the chart.
 *
 * Five small circles cannot carry a section on their own — the eye needs one
 * picture to settle on while it reads. Deliberately not one of the five: a
 * photograph that also appears inside the chart would read as the chart's
 * caption rather than as the section's image.
 */
export const JOURNEY_PLATE = {
  image: img('1573894997713-de07a124df43', 1200),
  alt: 'A New Model classroom mid-lesson',
} as const;

/* ==========================================================================
   07 — The numbers
   ========================================================================== */

export const STATS: Stat[] = [
  { value: 60, suffix: '+', label: 'Years', detail: 'Unbroken since 1962' },
  { value: 100, suffix: '%', label: 'Board Results', detail: 'Twelve years running' },
  { value: 13, suffix: '', label: 'Grades', detail: 'Nursery to Class 10' },
  { value: 10000, suffix: '+', label: 'Alumni', detail: 'In 30 countries' },
];

/* ==========================================================================
   08 — Parent voices
   ========================================================================== */

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    group: 'Parents',
    quote:
      'We moved across the city for this school. Three years in, I would do it again tomorrow. The teachers know my daughter - not her roll number.',
    name: 'Sridevi Rao',
    role: 'Parent, Class 7',
    photo: { id: '1573497019940-1c28c88b4f3e', alt: 'Portrait of Sridevi Rao', focus: '50% 28%' },
  },
  {
    id: 't2',
    group: 'Parents',
    quote:
      'What sold us was the first meeting. No brochure, no sales pitch. The principal asked what our son was afraid of. Nobody had asked us that.',
    name: 'Imran Qureshi',
    role: 'Parent, Class 4',
    photo: { id: '1507003211169-0a1dd7228f2d', alt: 'Portrait of Imran Qureshi', focus: '50% 26%' },
  },
  {
    id: 't3',
    group: 'Students',
    quote:
      'I built my first robot in Class 6 here. It did not work. My teacher made me present the failure to the whole class - that is when I actually learnt.',
    name: 'Aarav Menon',
    role: 'Class 10',
    photo: { id: '1500648767791-00dcc994a43e', alt: 'Portrait of Aarav Menon', focus: '50% 26%' },
  },
  {
    id: 't4',
    group: 'Students',
    quote:
      'The house system meant I was leading a team of twelve at fourteen. No other school my friends went to gave them that.',
    name: 'Kavya Reddy',
    role: 'Class 9 · House Captain',
    photo: { id: '1494790108377-be9c29b29330', alt: 'Portrait of Kavya Reddy', focus: '50% 26%' },
  },
  {
    id: 't5',
    group: 'Alumni',
    quote:
      'Twenty-two years later I still write to my Class 8 maths teacher. That is the thing about this place - it does not end when you leave.',
    name: 'Dr. Praveen Kumar',
    role: 'Batch of 2003 · Cardiologist',
    photo: { id: '1472099645785-5658abf4ff4e', alt: 'Portrait of Dr. Praveen Kumar', focus: '50% 26%' },
  },
  {
    id: 't6',
    group: 'Alumni',
    quote:
      'I arrived at IIT and realised I had already been taught how to work. That was New Model, not the coaching centre.',
    name: 'Neha Iyer',
    role: 'Batch of 2011 · Product Engineer',
    photo: { id: '1544005313-94ddf0286df2', alt: 'Portrait of Neha Iyer', focus: '50% 26%' },
  },
  {
    id: 't7',
    group: 'Teachers',
    quote:
      'I have taught here for nineteen years. The management has never once asked me to inflate a mark. That is rarer than it should be.',
    name: 'Lakshmi Narayanan',
    role: 'Head of Science',
    photo: { id: '1607746882042-944635dfe10e', alt: 'Portrait of Lakshmi Narayanan', focus: '50% 26%' },
  },
  {
    id: 't8',
    group: 'Teachers',
    quote:
      'We are given time to plan, and the freedom to teach. The children feel that difference before they can name it.',
    name: 'Rahul Deshpande',
    role: 'Mathematics, Classes 9-10',
    photo: { id: '1560250097-0b93528c311a', alt: 'Portrait of Rahul Deshpande', focus: '50% 26%' },
  },
];

export const TRUST_BADGES = [
  '4.9 ★ Parent Rating',
  'CBSE Affiliated',
  'ISO 9001 Certified',
  'Govt. Recognised Excellence',
] as const;

/* ==========================================================================
   09 — Future ready
   ========================================================================== */

export const FEATURES: Feature[] = [
  {
    id: 'ai',
    icon: 'circuit',
    title: 'AI-Integrated Learning',
    description: 'Personalised pathways driven by real assessment data.',
  },
  {
    id: 'robotics',
    icon: 'robot',
    title: 'Robotics Lab',
    description: 'Hands-on STEM from Class 6 upward.',
  },
  {
    id: 'science',
    icon: 'atom',
    title: 'Advanced Science',
    description: 'State-of-the-art physics, chemistry and biology labs.',
  },
  {
    id: 'digital',
    icon: 'globe',
    title: 'Digital Literacy',
    description: 'Coding, design and media as core literacy.',
  },
  {
    id: 'innovation',
    icon: 'bulb',
    title: 'Innovation Studio',
    description: 'Weekly maker sessions with no syllabus attached.',
  },
  {
    id: 'values',
    icon: 'shield',
    title: 'Values & Ethics',
    description: 'Character-first education, examined and mentored.',
  },
];

/* ==========================================================================
   10 — Principal
   ========================================================================== */

export const PRINCIPAL = {
  name: 'Dr. Meera Krishnan',
  title: 'Principal, New Model High School',
  tenure: 'Leading since 2009',
  since: 2009,
  portrait: img('1508214751196-bcfd4ca60f91', 900),
  quote:
    'Education is not just about preparing students for exams. It is about preparing them for life.',
  letter: [
    'When a parent walks into my office for the first time, they rarely ask about our board results. They ask whether their child will be known here. It is the better question, and it is the one this school has answered the same way for sixty-four years.',
    'We are unfashionably strict about two things: what a child is taught, and who teaches them. Everything else - the robotics lab, the studio, the field, the councils - exists so a student discovers what they are good at before the world tells them what they should be.',
    'Our alumni are cardiologists and cricketers, engineers and entrepreneurs, teachers who came back to teach here. What they share is not a rank. It is a way of working that started in a classroom on this campus.',
  ],
} as const;

/* ==========================================================================
   11 — Life at New Model
   ========================================================================== */

export const GALLERY: GalleryItem[] = [
  {
    id: 'g1',
    title: 'Morning Assembly',
    category: 'Campus Life',
    image: img('1523580494863-6f3031224c94', 1200),
    span: [2, 2],
  },
  {
    id: 'g2',
    title: 'State Champions',
    category: 'Achievements',
    image: img('1519861531473-9200262188bf', 800),
    span: [1, 1],
  },
  {
    id: 'g3',
    title: 'Chemistry Practicals',
    category: 'Labs',
    image: img('1532094349884-543bc11b234d', 800),
    span: [1, 1],
  },
  {
    id: 'g4',
    title: 'Annual Day',
    category: 'Events',
    image: img('1493225457124-a3eb161ffa5f', 800),
    span: [1, 2],
  },
  {
    id: 'g5',
    title: 'Track & Field',
    category: 'Sports',
    image: img('1461896836934-ffe607ba8211', 800),
    span: [1, 1],
  },
  {
    id: 'g6',
    title: 'Robotics Finals',
    category: 'Labs',
    image: img('1517420704952-d9f39e95b43e', 800),
    span: [1, 1],
  },
  {
    id: 'g7',
    title: 'Reading Hour',
    category: 'Campus Life',
    image: img('1481627834876-b7833e8f5570', 800),
    span: [1, 1],
  },
  {
    id: 'g8',
    title: 'Founders’ Week',
    category: 'Festivals',
    image: img('1517457373958-b7bdd4587205', 1200),
    span: [2, 1],
  },
];

export const GALLERY_CATEGORIES = [
  'All',
  'Campus Life',
  'Achievements',
  'Sports',
  'Labs',
  'Events',
  'Festivals',
] as const;

/* ==========================================================================
   12 — Admissions
   ========================================================================== */

/**
 * Entry classes offered in the enquiry form. Kept in step with the eligibility
 * table on the admissions page — a parent who reads 'Nursery through Class 10'
 * there and then cannot select Nursery here has been told two different things.
 */
export const GRADES = [
  'Nursery',
  'LKG',
  'UKG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
] as const;

export const ADMISSION_STEPS = ['Class', 'Details', 'Student', 'Schedule'] as const;

/* ==========================================================================
   Footer
   ========================================================================== */

export const BRANCHES: Branch[] = [
  {
    name: 'Campus - Bahadurpura',
    address: 'Doodh Bowli Road, Kabutar Khana, Bahadurpura, Hyderabad, Telangana',
    phone: '+91 40 2345 6789',
  },
];

export const SOCIALS = [
  { label: 'Instagram', href: 'https://instagram.com', icon: 'instagram' },
  { label: 'YouTube', href: 'https://youtube.com', icon: 'youtube' },
  { label: 'Facebook', href: 'https://facebook.com', icon: 'facebook' },
  { label: 'LinkedIn', href: 'https://linkedin.com', icon: 'linkedin' },
] as const;

/**
 * The footer's directory, grouped by what a reader is doing rather than by
 * sitemap order: reading about the school, or getting into it. Every href is
 * a real page or a real anchor on one - `#enquiry` is the form on Admissions,
 * `#visit` the booking band at the foot of Contact.
 */
export const FOOTER_NAV: { title: string; links: NavRoute[] }[] = [
  {
    title: 'The school',
    links: [
      { label: 'Home', href: ROUTES.home },
      { label: 'About', href: ROUTES.about },
      { label: 'Academics', href: ROUTES.academics },
      { label: 'Student Life', href: ROUTES.studentLife },
      { label: 'Gallery', href: ROUTES.gallery },
    ],
  },
  {
    title: 'Joining',
    links: [
      { label: 'Admissions', href: ROUTES.admissions },
      { label: 'Enquiry form', href: `${ROUTES.admissions}#enquiry` },
      { label: 'Book a visit', href: `${ROUTES.contact}#visit` },
      { label: 'Contact', href: ROUTES.contact },
    ],
  },
];

/* ==========================================================================
   Page content modules
   --------------------------------------------------------------------------
   Re-exported so every component keeps importing from '@/constants'.
   ========================================================================== */

export * from './education';
export * from './campus-life';
export * from './people';
export * from './admissions';
export * from './news';
export * from './contact';
export { img } from './media';
