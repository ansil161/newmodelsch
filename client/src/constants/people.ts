import type {
  Achievement,
  AchievementCategory,
  AlumniProfile,
  FacultyDepartment,
  Person,
  ProofPoint,
} from '@/types';
import { img } from './media';

/* ==========================================================================
   PAGE 02 — About (leadership, faculty, alumni) and PAGE 03 — Academics (results)
   --------------------------------------------------------------------------
   Owns one question: 'Who will guide my child, and what evidence shows the
   school performs well?' The blueprint's rule for this page is strict — only
   authentic portraits, biographies, results and awards. Every figure below is
   placeholder architecture and must be replaced with verified school data.
   ========================================================================== */

export const LEADERSHIP: Person[] = [
  {
    id: 'principal',
    name: 'Dr. Meera Krishnan',
    role: 'Principal',
    detail:
      'Leading since 2009. Doctorate in education policy; taught physics for fourteen years before she stopped teaching to run a school.',
    portrait: img('1508214751196-bcfd4ca60f91', 800),
    quote:
      'Parents rarely ask about our board results first. They ask whether their child will be known here. It is the better question.',
  },
  {
    id: 'vice-principal',
    name: 'Anand Varma',
    role: 'Vice Principal - Academics',
    detail:
      'Owns curriculum, assessment and the remediation loop. Twenty-one years in mathematics teaching, eleven of them here.',
    portrait: img('1560250097-0b93528c311a', 800),
    quote:
      'A weekly check that finds a gap is worth more than a terminal exam that confirms one.',
  },
  {
    id: 'head-pastoral',
    name: 'Fatima Sheikh',
    role: 'Head of Student Wellbeing',
    detail:
      'Runs the mentor system, counselling and child protection. Trained clinical counsellor; joined the school in 2014.',
    portrait: img('1573497019940-1c28c88b4f3e', 800),
    quote:
      'Every child here is somebody\'s named responsibility. That is the whole design.',
  },
  {
    id: 'head-primary',
    name: 'Suresh Reddy',
    role: 'Head of Primary & Early Years',
    detail:
      'Responsible for Nursery through Class 5. Specialist in early literacy; has taught in three states and two boards.',
    portrait: img('1507003211169-0a1dd7228f2d', 800),
    quote:
      'The years before Class 5 decide everything after them. We staff them accordingly.',
  },
];

export const PHILOSOPHY = {
  eyebrow: 'What leadership actually believes',
  title: 'A school is the sum of the adults a child meets in it.',
  paragraphs: [
    'We hire slowly. A teaching appointment here involves a taught lesson in front of real students, a subject interview, and a conversation about what the candidate does when a child is failing. Two of the three are about judgement rather than knowledge.',
    'Once hired, teachers are given time to plan and the freedom to teach. There is no scripted lesson library and no requirement to be at the same page on the same day. What is required is that every child in the room is accounted for.',
    'Management has never asked a teacher to inflate a mark, and it never will. The reports we send home are the reports we hold internally. Families cannot make good decisions on flattering data.',
  ],
  portrait: img('1571260899304-425eee4c7efc', 1400),
  portraitAlt: 'Teachers and students in the school assembly courtyard',
} as const;

export const FACULTY_DEPARTMENTS: FacultyDepartment[] = [
  {
    id: 'languages',
    name: 'Languages',
    strength: '24 teachers',
    description:
      'English, Hindi and Telugu across all stages, with a dedicated early-literacy team for Nursery to Class 2.',
    leads: ['Anjali Menon - Head of English', 'Ravi Shankar - Head of Hindi & Telugu'],
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    strength: '16 teachers',
    description:
      'Specialist teaching from Class 1 upward, with weekly diagnostics and a standing small-group support block.',
    leads: ['Rahul Deshpande - Head of Mathematics'],
  },
  {
    id: 'sciences',
    name: 'Sciences',
    strength: '19 teachers',
    description:
      'Physics, chemistry and biology with matched practicals for every topic from Class 6, across five laboratories.',
    leads: ['Lakshmi Narayanan - Head of Science', 'Zoya Ahmed - Head of Biology'],
  },
  {
    id: 'social',
    name: 'Social Sciences',
    strength: '12 teachers',
    description:
      'History, geography, civics and economics, with the Model UN and debate programmes run out of the department.',
    leads: ['Vikram Joshi - Head of Social Sciences'],
  },
  {
    id: 'computing',
    name: 'Computing & Robotics',
    strength: '9 teachers',
    description:
      'Coding, digital media and the robotics programme that has taken students to the national circuit every year since 2018.',
    leads: ['Nikhil Rao - Head of Computing'],
  },
  {
    id: 'arts-sport',
    name: 'Arts, Music & Sport',
    strength: '21 teachers & coaches',
    description:
      'Fine art, Carnatic and Western music, theatre, and professional coaching across five competitive sports.',
    leads: ['Divya Prasad - Head of Arts', 'Arjun Kulkarni - Director of Sport'],
  },
];

export const FACULTY_STATS = [
  { value: '101', label: 'Teaching staff' },
  { value: '11 yrs', label: 'Average experience' },
  { value: '1:18', label: 'Mentor group ratio' },
  { value: '94%', label: 'Retained year on year' },
] as const;

export const ACHIEVEMENT_CATEGORIES: readonly ('All' | AchievementCategory)[] = [
  'All',
  'Academics',
  'Examinations',
  'Scholarships',
  'Competitions',
] as const;

/* --------------------------------------------------------------------------
   The academic record.

   Four years, four categories, twelve entries, and every one of them is
   something a parent could ask to see the paperwork for: a board result, an
   examination score, a funded place, a competition placing. Sport and culture
   used to be counted here and are not any more — they belong to student life,
   and mixing them in made the record answer 'what does this school do' when
   the only question it should answer is 'how do its students perform'.

   The images are placeholder photography, sized for the frame beside the
   entry. They carry no information the title does not, which is why they are
   marked decorative in the markup.
   -------------------------------------------------------------------------- */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'a1',
    category: 'Examinations',
    year: '2025',
    title: 'Twelfth consecutive 100% board result',
    detail: 'Classes 10 and 12, with 68% of the cohort placed above 90 per cent.',
    image: img('1523580494863-6f3031224c94', 900),
  },
  {
    id: 'a2',
    category: 'Academics',
    year: '2025',
    title: 'Two state rank holders',
    detail: 'State ranks 4 and 9 in the AISSCE Science stream.',
    image: img('1573894997713-de07a124df43', 900),
  },
  {
    id: 'a3',
    category: 'Scholarships',
    year: '2025',
    title: 'Eleven merit scholarships awarded',
    detail: 'Funded undergraduate places across engineering, medicine and design.',
    image: img('1524178232363-1fb2b075b655', 900),
  },
  {
    id: 'a4',
    category: 'Competitions',
    year: '2024',
    title: 'Mathematics Olympiad - fourteen qualifiers',
    detail: 'The largest cohort the school has sent to the regional round.',
    image: img('1509228468518-180dd4864904', 900),
  },
  {
    id: 'a5',
    category: 'Examinations',
    year: '2024',
    title: 'Nine perfect subject scores',
    detail: 'Mathematics, physics and computer science in the Class 12 board.',
    image: img('1572847748080-bac263fae977', 900),
  },
  {
    id: 'a6',
    category: 'Scholarships',
    year: '2024',
    title: 'Two national talent scholarships',
    detail: 'Awarded on the stage-two national examination, held from Class 10.',
    image: img('1546519638-68e109498ffc', 900),
  },
  {
    id: 'a7',
    category: 'Competitions',
    year: '2023',
    title: 'National science exhibition - selected',
    detail: 'A Class 8 water-conservation project taken to the national round.',
    image: img('1517457373958-b7bdd4587205', 900),
  },
  {
    id: 'a8',
    category: 'Academics',
    year: '2023',
    title: 'First university offers from abroad',
    detail: 'Undergraduate places at four institutions across three countries.',
    image: img('1541339907198-e08756dedf3f', 900),
  },
  {
    id: 'a9',
    category: 'Examinations',
    year: '2023',
    title: 'Highest Class 10 average on record',
    detail: 'A cohort mean of 88.4 per cent across all five papers.',
    image: img('1481627834876-b7833e8f5570', 900),
  },
  {
    id: 'a10',
    category: 'Competitions',
    year: '2022',
    title: 'Model United Nations - best delegation',
    detail: 'Awarded at the largest inter-school conference in the state.',
    image: img('1507003211169-0a1dd7228f2d', 900),
  },
  {
    id: 'a11',
    category: 'Scholarships',
    year: '2022',
    title: 'First endowed scholar admitted',
    detail: "The school's own fund opened with one fully funded place from Class 6.",
    image: img('1580582932707-520aed937b7b', 900),
  },
  {
    id: 'a12',
    category: 'Academics',
    year: '2022',
    title: 'Senior research programme opened',
    detail: 'Eighteen students completed their first supervised paper in-house.',
    image: img('1592280771190-3e2e4d571952', 900),
  },
];

export const RECOGNITION: ProofPoint[] = [
  {
    id: 'r1',
    value: '100%',
    label: 'Board results',
    detail: 'Twelve consecutive years, Classes 10 and 12',
  },
  {
    id: 'r2',
    value: '22',
    label: 'State championships',
    detail: 'Across athletics, cricket and basketball',
  },
  {
    id: 'r3',
    value: '48',
    label: 'National robotics medals',
    detail: 'Since the programme opened in 2018',
  },
  {
    id: 'r4',
    value: '4.9★',
    label: 'Parent rating',
    detail: 'Across verified public review platforms',
  },
];

export const ACCREDITATIONS = [
  'CBSE Affiliated',
  'ISO 9001 Certified',
  'Govt. Recognised Excellence',
  'Member - National Schools Association',
] as const;

export const ALUMNI: AlumniProfile[] = [
  {
    id: 'al1',
    name: 'Dr. Praveen Kumar',
    batch: 'Batch of 2003',
    now: 'Cardiologist, Apollo Hospitals',
    quote:
      'Twenty-two years later I still write to my Class 8 maths teacher. That is the thing about this place - it does not end when you leave.',
    portrait: img('1472099645785-5658abf4ff4e', 600),
  },
  {
    id: 'al2',
    name: 'Neha Iyer',
    batch: 'Batch of 2011',
    now: 'Product Engineer, Bengaluru',
    quote:
      'I arrived at IIT and realised I had already been taught how to work. That was New Model, not the coaching centre.',
    portrait: img('1544005313-94ddf0286df2', 600),
  },
  {
    id: 'al3',
    name: 'Karthik Subramanian',
    batch: 'Batch of 2008',
    now: 'Civil Services, Government of India',
    quote:
      'The debate society did more for my interview than any preparation I paid for afterwards.',
    portrait: img('1500648767791-00dcc994a43e', 600),
  },
  {
    id: 'al4',
    name: 'Shreya Nair',
    batch: 'Batch of 2015',
    now: 'Architect, returned to teach design here',
    quote:
      'I came back because somebody here once let me build something badly and then asked me why it failed.',
    portrait: img('1494790108377-be9c29b29330', 600),
  },
];

export const ALUMNI_REACH = [
  { value: '10,000+', label: 'Alumni' },
  { value: '30', label: 'Countries' },
  { value: '19', label: 'Alumni now teaching here' },
  { value: '1,200+', label: 'Second-generation families' },
] as const;
