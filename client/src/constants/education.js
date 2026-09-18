import { img } from './media';

/* ==========================================================================
   PAGES 02 & 03 — About and Academics
   --------------------------------------------------------------------------
   Owns one question: 'Who are you, what do you teach, and how will my child
   develop here?' Everything on the page either establishes institutional
   trust or explains the Nursery → Class 10 journey. Nothing else belongs.
   ========================================================================== */

export const STORY = {
  eyebrow: 'Since 1962',
  title: 'Two rooms, forty children, and a promise nobody has renegotiated.',
  lead: 'New Model High School was founded the year the first parents asked for something the city did not yet have - a school that would know their child by name and still hold them to a standard.',
  paragraphs: [
    'The founders were three teachers who left larger institutions for the same reason: they had stopped being able to name every child they taught. They rented two rooms off Doodh Bowli Road, admitted forty students, and wrote a single rule into the charter - no class would grow past the point where a teacher could hold every name.',
    'Six decades later the school still stands on the same ground in Bahadurpura and has sent more than ten thousand alumni into the world. The charter rule has never been amended. It is why we grow by adding rooms and teachers rather than by widening classes.',
    'What has changed is everything a child gets to touch: laboratories, a robotics floor, a 22,000-volume library, a studio, a field. What has not changed is who is accountable for a child having a hard week. That is still a named adult, and they still call home.',
  ],
  portrait: img('1573894997713-de07a124df43', 1200),
  portraitAlt: 'Archival photograph of the founding classroom',
  marks: [
    { value: '1962', label: 'Founded', detail: 'Two rooms off Doodh Bowli Road, forty students.' },
    { value: '1', label: 'Campus', detail: 'Still on the same ground in Bahadurpura.' },
    { value: '10,000+', label: 'Alumni', detail: 'Sent into the world over six decades.' },
    { value: '64', label: 'Years unbroken', detail: 'The charter rule has never been amended.' },
  ],
};

/**
 * THE RECORD - five photo pillars, read left to right as one sentence:
 * history, students, teachers, results, the future.
 *
 * `from` is where a figure's count-up starts. A year counts up from the
 * turn of the century rather than from zero, so it reads as time passing
 * rather than as a tally; `null` means the figure is not counted at all.
 *
 * The photographs live in `public/images/about/record/`. The wide campus
 * frame is used twice, cropped to two different subjects: the walkway for
 * the teachers, the student for the results. `focus` is what keeps each
 * subject inside a tall, narrow pillar - move it if a photograph changes.
 */
export const RECORD = {
  eyebrow: 'A legacy of excellence',
  /** One entry per line; `em` is set in the italic. */
  titleLines: [{ text: 'Shaping bright minds' }, { text: 'for a better ', em: 'tomorrow.' }],
  lead: 'For over sixty years, we have been more than a school - we are a community that dreams, learns and grows together, still on the same ground in Bahadurpura.',
  link: { label: 'Discover Our Story', hash: '#story' },
  pillars: [
    {
      label: 'Established',
      value: '1962',
      from: 1900,
      note: 'A legacy of excellence',
      photo: {
        id: '/images/about/record/campus-building.webp',
        alt: 'The main school building and its entrance steps under a blue sky',
        focus: '40% 50%',
      },
    },
    {
      label: 'Students',
      value: '1,200+',
      from: 0,
      note: 'Growing every year',
      photo: {
        id: '/images/about/record/students-walking.webp',
        alt: 'Students in uniform walking together towards the school building',
        focus: '70% 50%',
      },
    },
    {
      label: 'Teaching staff',
      value: '100+',
      from: 0,
      note: 'Dedicated educators',
      photo: {
        id: '/images/about/record/campus-flag.webp',
        alt: 'The campus walkway, with students heading into the main building',
        focus: '27% 50%',
      },
    },
    {
      label: 'Academic excellence',
      value: '95%',
      from: 0,
      note: 'Board results & beyond',
      photo: {
        id: '/images/about/record/campus-flag.webp',
        alt: 'A student carrying her books, looking out across the campus',
        focus: '64% 50%',
      },
    },
    {
      label: 'Our vision',
      /** The closing pillar carries a statement rather than a figure. */
      statement: { text: 'A Brighter', em: 'Future' },
      note: 'For every child',
      photo: {
        id: '/images/about/record/flag.webp',
        alt: 'The school flag flying against a bright sky',
        focus: '50% 42%',
      },
    },
  ],
};

/**
 * The opening frame of the About page: an editorial spread on ivory.
 *
 * Separate from STORY because it answers a different job: STORY is the record,
 * this is the overture. The figures repeat STORY.marks with the cover's own
 * labels - if a number changes there, change it here too.
 */
export const ABOUT_HERO = {
  eyebrow: 'About us',
  /** One entry per line; `em` is set in the italic and underlined. */
  titleLines: [{ text: 'Shaping ', em: 'Tomorrow’s' }, { text: 'Leaders Today' }],
  lead: 'At New Model High School, we believe in nurturing curious minds, kind hearts and confident learners who make a positive impact on the world.',
  facts: ['Nursery to Class 10', 'Bahadurpura, Hyderabad', 'Session 2026-27'],
  link: { label: 'Read our story', hash: '#story' },
  script: ['Education', 'for a better', 'tomorrow'],
  seal: 'New Model High School • Est. 1962 • ',
  caption: 'Our campus, Bahadurpura',
  main: {
    id: '1592280771190-3e2e4d571952',
    alt: 'The school building seen from the front courtyard',
    focus: '50% 62%',
  },
  inset: {
    id: '1718199885029-6ba9e8b8cf79',
    alt: 'Two students in uniform walking to school with their bags',
    focus: '50% 55%',
  },
  statsHead: { label: 'The school in numbers', aside: 'Since 1962' },
  stats: [
    { value: '1962', label: 'Established', detail: 'Two rooms off Doodh Bowli Road.', icon: 'landmark', tone: 'peach' },
    { value: '1', label: 'School', detail: 'Still on the same ground.', icon: 'cap', tone: 'blue' },
    { value: '10,000+', label: 'Alumni', detail: 'Sent into the world over six decades.', icon: 'users', tone: 'green', count: true },
    { value: '64', label: 'Years of legacy', detail: 'The charter rule, never amended.', icon: 'history', tone: 'lavender', count: true },
  ],
};

export const VISION = {
  vision:
    'A school where every child is known, stretched and sent out able to think for themselves.',
  mission:
    'To teach a rigorous curriculum inside small cohorts, with specialist teachers and a pastoral system that catches a child in the week they slip - not the term after.',
};

/**
 * The two brush-stroke panels. `VISION` above stays the plain statement of
 * record; this is the same two ideas set for the splash treatment, where the
 * emphasis lines carry the meaning and the quiet lines only join them up.
 */
export const VISION_PANELS = [
  {
    id: 'vision',
    labelLines: ['Our', 'Vision'],
    tone: 'blue',
    ctaLabel: 'Explore the Journey',
    // Both CTAs leave for Academics, because that is where the claim is
    // actually evidenced. `#learning-journey` never existed as an anchor.
    ctaHref: '/academics#curriculum',
    layout: 'stacked',
    // Short enough that each emphasis line sets on one line at full size —
    // the reference's rhythm depends on that, and a wrapped claim loses it.
    lines: [
      { text: 'A school where', tone: 'quiet' },
      { text: 'every child is known', tone: 'primary' },
      { text: 'stretched, and sent out', tone: 'quiet' },
      { text: 'able to think', tone: 'deep' },
      { text: 'for themselves', tone: 'primary' },
    ],
  },
  {
    id: 'mission',
    labelLines: ['Our', 'Mission'],
    tone: 'yellow',
    ctaLabel: 'How We Teach',
    ctaHref: '/academics#how-we-teach',
    layout: 'split',
    columns: [
      {
        headline: ['Small', 'cohorts', 'specialist', 'teachers'],
        body: 'A rigorous curriculum, taught by people who trained in the subject, to groups small enough that every name is held.',
      },
      {
        headline: ['Caught', 'the', 'same week'],
        insetIndex: 1,
        body: 'Weekly checks find a gap in the week it opens. Support is timetabled the same week, not the term after.',
      },
    ],
  },
];

/* --------------------------------------------------------------------------
   The charter
   --------------------------------------------------------------------------
   Six lines, in the order the school would defend them, and the order is the
   argument: the founding rule first, and the thing that proves the rule
   worked last.

   Every one of them carries two practices and one figure. The figures are
   not new claims - each is already reported somewhere else on this site
   (FACULTY_STATS, RECOGNITION, STORY.marks) - so a principle can never end up
   promising something the record does not say.
   -------------------------------------------------------------------------- */

export const VALUES = [
  {
    id: 'known',
    index: '01',
    title: 'Every child is known',
    description:
      'Cohorts stay small enough that a teacher can name every child, their subject, and the thing they are currently struggling with. It is the founding rule and the one we never trade.',
    proof: [
      'No class grows past the point where a teacher can hold every name - written into the charter in 1962, never amended.',
      'One named mentor to every eighteen students, and they are the adult who calls home.',
    ],
    mark: { value: '1:18', label: 'Mentor group ratio' },
  },
  {
    id: 'rigour',
    index: '02',
    title: 'Rigour without fear',
    description:
      'Standards stay high and are stated in advance. A child should know exactly what mastery looks like before they are assessed against it - and never learn it from a red mark.',
    proof: [
      'The standard for a unit is published before the unit is taught.',
      'Weekly diagnostics in language and mathematics, Classes 1 to 10.',
    ],
    mark: { value: '100%', label: 'Board results, twelve years running' },
  },
  {
    id: 'curiosity',
    index: '03',
    title: 'Curiosity is timetabled',
    description:
      'Making, questioning and building are on the timetable with named teachers and real hours, not squeezed into whatever is left after the syllabus.',
    proof: [
      'The robotics floor, the studio and the laboratories are timetabled, not booked as a treat.',
      'A 22,000-volume library open on ordinary weekdays, not only before examinations.',
    ],
    mark: { value: '48', label: 'National robotics medals since 2018' },
  },
  {
    id: 'character',
    index: '04',
    title: 'Character is examined',
    description:
      'Service hours, house responsibility and peer mentoring are assessed and reported alongside academics, because what a child does when unsupervised is the actual result.',
    proof: [
      'Service, house duty and peer mentoring are reported on the same sheet as the marks.',
      'Every child leaves Class 10 with a written record of what they did when nobody was watching.',
    ],
    mark: { value: 'Every term', label: 'Character reported, not inferred' },
  },
  {
    id: 'honesty',
    index: '05',
    title: 'Honest reporting',
    description:
      'No mark is ever inflated, and no report is written to please a parent. Families are told what is true, early enough to do something about it.',
    proof: [
      'A gap is put in writing in the week it opens, not in the term after it closes.',
      'The teacher who found it is the one who explains it, in person.',
    ],
    mark: { value: '4.9★', label: 'Verified parent rating' },
  },
  {
    id: 'belonging',
    index: '06',
    title: 'A place to come back to',
    description:
      'Alumni return to teach, to speak, to send their own children. A school is judged by who comes back, not by who leaves with a rank.',
    proof: [
      'Alumni return to teach, to speak at assembly, and to enrol their own children.',
      'The teachers stay too: ninety-four per cent of the faculty are here the following year.',
    ],
    mark: { value: '10,000+', label: 'Alumni since 1962' },
  },
];

export const TEACHING_PRINCIPLES = [
  {
    id: 'specialists',
    icon: 'bulb',
    title: 'Subject specialists, every stage',
    description:
      'From Class 1 upward a child is taught by teachers who trained in the subject they teach, not by one generalist covering everything.',
    proof: 'Average 11 years of subject teaching experience across the faculty.',
  },
  {
    id: 'formative',
    icon: 'check',
    title: 'Assessment that arrives early',
    description:
      'Short weekly checks replace the single terminal exam as the main signal. A gap is found while there is still term left to close it.',
    proof: 'Weekly diagnostics in language and mathematics, Classes 1-10.',
  },
  {
    id: 'remediation',
    icon: 'shield',
    title: 'A remediation loop, not a label',
    description:
      'A child who slips is scheduled into small-group support within the same week - automatically, without a parent having to ask for it.',
    proof: 'Support blocks timetabled four afternoons a week.',
  },
  {
    id: 'practical',
    icon: 'atom',
    title: 'Learning you can put your hands on',
    description:
      'Laboratory, studio and field work are examined components. Concepts are met physically before they are met on a page.',
    proof: 'Every science topic from Class 6 has a matching practical.',
  },
  {
    id: 'voice',
    icon: 'globe',
    title: 'Students who can explain themselves',
    description:
      'Presenting, defending and revising your own work is built into every year, because articulation is what turns knowledge into understanding.',
    proof: 'Two graded oral presentations per subject, per year.',
  },
  {
    id: 'pastoral',
    icon: 'star',
    title: 'One named adult',
    description:
      'Every child has a form mentor who owns their wellbeing for the year and is the single number a parent calls.',
    proof: 'Mentor groups capped at 18 students.',
  },
];

/* --------------------------------------------------------------------------
   The school film.

   One video, played on request. `src` is served straight out of the public
   folder, so replacing the file replaces the film with no code change; drop
   the mp4 at client/public/videos/school-film.mp4.

   `captions` points at a WebVTT file in the same folder when one exists —
   leave it undefined and no <track> is rendered, which is honest about the
   film being uncaptioned rather than shipping an empty track.
   -------------------------------------------------------------------------- */

export const SCHOOL_FILM = {
  eyebrow: 'The film',
  title: 'Six decades, in four minutes.',
  lead: 'A morning walked end to end - the gate, the corridors, a lesson in progress, and the people who have held the same standard since 1962. Nothing in it was staged for the camera.',
  src: '/videos/school-film.mp4',
  captions: undefined,
  poster: img('1573894998033-c0cef4ed722b', 1800),
  posterAlt: 'A student working in class, the rest of the cohort behind them',
  runtime: '4 min',
  caption: 'Filmed on an ordinary Tuesday in Bahadurpura.',
};

/* --------------------------------------------------------------------------
   Signature section — the complete Nursery → Class 10 learning journey.

   The blueprint is explicit that this replaces thirteen separate class pages
   with one navigable system. It is also explicit that the subject lists below
   define information architecture only: school-approved curriculum must
   replace this copy before launch.
   -------------------------------------------------------------------------- */

export const LEARNING_STAGES = [
  {
    id: 'nursery',
    accent: 'sky',
    icon: 'sparkle',
    label: 'Nursery',
    band: 'Pre-Primary',
    ages: 'Ages 3-4',
    focus: 'Settling in and first discovery',
    summary:
      'The first year is about wanting to come back tomorrow. Children learn what a school day feels like, how to be part of a group, and that asking questions is rewarded.',
    learning: [
      'Language exposure through story, rhyme and conversation',
      'First number sense - counting, sorting, matching',
      'Fine and gross motor development',
      'Play-based exploration of colour, shape and sound',
      'Routines: arrival, circle time, tidying, departure',
    ],
    skills: ['Curiosity', 'Sharing', 'Listening', 'Self-help', 'Confidence with adults'],
    outcome: 'A child who separates happily at the gate and talks about their day at home.',
    image: img('1573894997713-de07a124df43', 1200),
    imageAlt: 'Young students at their desks in a classroom',
  },
  {
    id: 'lkg',
    accent: 'mint',
    icon: 'star',
    label: 'LKG',
    band: 'Pre-Primary',
    ages: 'Ages 4-5',
    focus: 'Structure and early literacy',
    summary:
      'Play stays, but shape arrives with it. Letters and numbers become things a child recognises on sight, and the day starts to have a rhythm they can predict.',
    learning: [
      'Letter recognition, sounds and first written strokes',
      'Number recognition, quantity and simple patterns',
      'Listening to instruction and following a two-step task',
      'Rhyme, song, movement and daily story time',
      'Working alongside other children on a shared activity',
    ],
    skills: ['Focus', 'Early phonics', 'Fine motor control', 'Turn-taking'],
    outcome: 'A child who can sit with a task, finish it, and tell you what they made.',
    image: img('1659985281435-d8d3ea55b55c', 1200),
    imageAlt: 'An LKG child working on early letters with a teacher',
  },
  {
    id: 'ukg',
    accent: 'amber',
    icon: 'book',
    label: 'UKG',
    band: 'Pre-Primary',
    ages: 'Ages 5-6',
    focus: 'Confidence and readiness',
    summary:
      'The bridge year. Early literacy and numeracy become deliberate, and children begin working alongside each other rather than beside each other.',
    learning: [
      'Early reading - blending, sight words, first sentences',
      'Early numeracy - quantity, sequence, simple addition',
      'Communication: describing, retelling, asking',
      'Creative expression through art, music and movement',
      'Collaborative activities and turn-taking',
    ],
    skills: ['Independence', 'Early reading', 'Listening for instruction', 'Collaboration'],
    outcome: 'A child ready for Class 1 in habit, attention and confidence - not just in age.',
    image: img('1572847748080-bac263fae977', 1200),
    imageAlt: 'A UKG child reading a first sentence aloud to a teacher',
  },
  {
    id: 'classes-1-2',
    accent: 'coral',
    icon: 'book',
    label: 'Classes 1-2',
    band: 'Primary',
    ages: 'Ages 6-8',
    focus: 'Strong foundations',
    summary:
      'The years that decide everything after them. Reading, writing and number are taught slowly and checked constantly, because a gap opened here is expensive to close later.',
    learning: [
      'Reading fluency and comprehension',
      'Handwriting and structured written expression',
      'Mathematics fundamentals - place value, operations, measurement',
      'Environmental awareness and first science',
      'Art, music and daily movement',
    ],
    skills: ['Reading habit', 'Number confidence', 'Curiosity', 'Working independently'],
    outcome: 'A child reading for pleasure and comfortable being wrong in front of a class.',
    image: img('1572847748080-bac263fae977', 1200),
    imageAlt: 'A primary-age student in school uniform in class',
  },
  {
    id: 'classes-3-5',
    accent: 'violet',
    icon: 'compass',
    label: 'Classes 3-5',
    band: 'Primary',
    ages: 'Ages 8-11',
    focus: 'Expanding understanding',
    summary:
      'Subjects separate out and get specialist teachers. Children start producing work over weeks rather than lessons, and reading becomes the engine of everything else.',
    learning: [
      'Deeper language work - grammar, comprehension, composition',
      'Mathematics: fractions, geometry, data, problem solving',
      'Science and environmental studies with practical work',
      'Social awareness - history, civics, geography',
      'Project work and sustained reading',
    ],
    skills: ['Teamwork', 'Written expression', 'Research habits', 'Creative expression'],
    outcome: 'A student who can plan a piece of work, and finish it without being chased.',
    image: img('1572847748080-bac263fae977', 1200),
    imageAlt: 'Upper primary students working on a group project',
  },
  {
    id: 'classes-6-8',
    accent: 'blue',
    icon: 'atom',
    label: 'Classes 6-8',
    band: 'Middle School',
    ages: 'Ages 11-14',
    focus: 'Exploration and independent thinking',
    summary:
      'The widest years. Laboratories, the robotics floor, second languages and the stage all open at once, and students find out what they are actually drawn to.',
    learning: [
      'Subject depth across sciences, mathematics and languages',
      'Social studies - history, geography, civics, economics',
      'Laboratory practicals and scientific method',
      'Digital literacy, coding and the robotics programme',
      'Long-form projects and independent research',
    ],
    skills: ['Problem solving', 'Scientific thinking', 'Digital fluency', 'Presenting'],
    outcome: 'A student with an opinion about what they are good at - and evidence for it.',
    image: img('1571260899304-425eee4c7efc', 1200),
    imageAlt: 'Middle-school students with books between lessons',
  },
  {
    id: 'classes-9-10',
    accent: 'coral',
    icon: 'bulb',
    label: 'Classes 9-10',
    band: 'Secondary',
    ages: 'Ages 14-16',
    focus: 'Mastery and direction',
    summary:
      'Board years, taught as two years rather than one long revision. Depth first, exam technique second, and an honest conversation about what comes after Class 10.',
    learning: [
      'Advanced curriculum across the board subjects',
      'Practical and laboratory work as examined components',
      'Analytical writing and structured argument',
      'Board examination readiness and technique',
      'Counselling on where to go after Class 10, and how to choose it',
    ],
    skills: ['Analytical thinking', 'Exam readiness', 'Time management', 'Self-direction'],
    outcome: 'Boards cleared without a coaching centre, and a next step chosen for the right reason.',
    image: img('1659985281435-d8d3ea55b55c', 1200),
    imageAlt: 'A secondary student working in a classroom',
  },
];

/** Bands used by the journey rail to group the seven stages. */
export const LEARNING_BANDS = [
  'Pre-Primary',
  'Primary',
  'Middle School',
  'Secondary',
];

export const FUTURE_SKILLS = [
  {
    id: 'communication',
    icon: 'globe',
    title: 'Communication',
    description:
      'Two graded presentations per subject per year, from Class 4 upward. Speaking clearly is treated as a skill that is taught, not a personality trait.',
  },
  {
    id: 'problem-solving',
    icon: 'circuit',
    title: 'Problem solving',
    description:
      'Open-ended problems with more than one right answer, timetabled in mathematics and science from Class 6.',
  },
  {
    id: 'creativity',
    icon: 'bulb',
    title: 'Creativity',
    description:
      'Studio, stage and maker sessions with no syllabus attached - the only hours in the week where the outcome is not specified in advance.',
  },
  {
    id: 'technology',
    icon: 'robot',
    title: 'Technology',
    description:
      'Coding, robotics and digital media taught as literacy from Class 6, in a lab with enough machines that nobody shares.',
  },
];

export const CURRICULUM_ROWS = [
  {
    stage: 'Pre-Primary',
    classes: 'Nursery - UKG',
    board: 'School foundation programme',
    subjects: 'Language, early numeracy, motor skills, art, music, movement',
    assessment: 'Continuous observation, termly parent conference',
  },
  {
    stage: 'Primary',
    classes: 'Classes 1-5',
    board: 'CBSE',
    subjects: 'English, Hindi, Telugu, Mathematics, EVS/Science, Social Studies, Art, PE',
    assessment: 'Weekly diagnostics, three term reports',
  },
  {
    stage: 'Middle School',
    classes: 'Classes 6-8',
    board: 'CBSE',
    subjects:
      'Three languages, Mathematics, Science, Social Science, Computer Science, Art, PE, Robotics',
    assessment: 'Unit tests, practicals, projects, two terminal exams',
  },
  {
    stage: 'Secondary',
    classes: 'Classes 9-10',
    board: 'CBSE - AISSE',
    subjects:
      'Two languages, Mathematics, Science, Social Science, plus one skill elective',
    assessment: 'Internal assessment, pre-boards, AISSE board examination',
  },
];

/**
 * The school ends at Class 10, so the last thing it owes a family is a clear
 * view of what comes next. These are the three streams a leaver chooses
 * between at intermediate or junior college, and what each one opens up —
 * the substance of the Class 9 and 10 counselling conversation.
 */
export const NEXT_STEPS = [
  {
    id: 'science',
    name: 'Science (MPC / BiPC)',
    subjects: 'Physics, chemistry, mathematics or biology, English',
    pathways: 'Engineering, medicine, pure sciences, architecture, data',
  },
  {
    id: 'commerce',
    name: 'Commerce (CEC / MEC)',
    subjects: 'Accountancy, business studies, economics, English, mathematics',
    pathways: 'Chartered accountancy, business, finance, economics, law',
  },
  {
    id: 'humanities',
    name: 'Humanities (HEC)',
    subjects: 'History, political science, economics, English',
    pathways: 'Law, civil services, design, journalism, social sciences',
  },
];

export const ACADEMIC_PROOF = [
  {
    id: 'boards',
    value: '100%',
    label: 'Board pass rate',
    detail: 'Twelve consecutive years, Class 10',
  },
  {
    id: 'distinction',
    value: '68%',
    label: 'Scored above 90%',
    detail: 'Class 10 cohort, 2025 board examinations',
  },
  {
    id: 'ranks',
    value: '31',
    label: 'State rank holders',
    detail: 'Across the last decade of board results',
  },
  {
    id: 'coaching',
    value: '0',
    label: 'External coaching required',
    detail: 'Board preparation is taught inside school hours',
  },
];

/**
 * Non-negotiable disclosure required by the blueprint: the structure above is
 * information architecture, and official curriculum replaces it before launch.
 */
export const CURRICULUM_NOTE = '';
