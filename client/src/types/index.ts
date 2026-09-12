/** Shared domain types for the New Model High School site. */

import type { Photo } from '@/constants/imagery';

export interface Milestone {
  year: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}

/**
 * One stop on the heritage timeline. Everything past `date` and `headline` is
 * optional — the chapters are deliberately uneven, because a timeline where
 * every entry carries the same furniture reads as a table, not as a story.
 */
export interface HeritageChapter {
  /** The sticky label on the left rail — ‘1962’, ‘June 1975’, ‘Today’. */
  date: string;
  /** Small pill above the headline, for the two or three chapters that earn one. */
  badge?: string;
  headline: string;
  body?: string;
  /** Secondary paragraph, set smaller and dimmer than `body`. */
  aside?: string;
  link?: { label: string; href: string };
  media?: {
    src: string;
    alt: string;
    /** Hand-annotated note pinned beside the photograph. */
    note?: string;
  };
  quote?: { text: string; author: string };
}

/** One fact chip on an education card — an icon and three or four words. */
export interface EducationChip {
  /** Name from the shared `Icon` sprite. */
  icon: string;
  label: string;
}

export interface EducationCard {
  id: string;
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  /** Two chips read best on one line; a third wraps and unbalances the card. */
  chips: EducationChip[];
  statValue: string;
  statLabel: string;
  image: string;
  imageAlt: string;
}

export interface CampusTile {
  id: string;
  title: string;
  meta: string;
  image: string;
  /** Parallax intensity multiplier — higher reads as nearer to the viewer. */
  depth: number;
}

export interface JourneyNode {
  id: string;
  label: string;
  stage: string;
  detail: string;
  /**
   * The stage said as one sentence, for the card that carries it on the home
   * page. `detail` is a caption - a list of nouns under a small panel -
   * and set at forty pixels in the middle of an otherwise empty sheet it
   * reads as an index entry rather than as a claim the school is making.
   */
  statement: string;
  /** The portrait that sits over the node's panel in the chart. */
  image: string;
  imageAlt: string;
}

export interface Stat {
  value: number;
  suffix: string;
  label: string;
  detail: string;
}

export type TestimonialGroup = 'Parents' | 'Students' | 'Alumni' | 'Teachers';

export interface Testimonial {
  id: string;
  group: TestimonialGroup;
  quote: string;
  name: string;
  role: string;
  photo: Photo;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  /** Key into the ICONS map in components/common/Icon.tsx. */
  icon: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: string;
  image: string;
  /** Grid footprint: [columnSpan, rowSpan]. */
  span: [number, number];
}

export interface Branch {
  name: string;
  address: string;
  phone: string;
}

export interface AdmissionData {
  grade: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  studentName: string;
  studentDob: string;
  currentSchool: string;
  visitDate: string;
}

export type AdmissionErrors = Partial<Record<keyof AdmissionData, string>>;

/* ==========================================================================
   Multi-page blueprint types
   --------------------------------------------------------------------------
   Everything below backs the six-page architecture: Home, About, Academics,
   Student Life, Admissions, Contact & Visit. The single-page section types
   above are unchanged.
   ========================================================================== */

/** A route in the primary navigation. `href` is a path, not a hash. */
export interface NavRoute {
  label: string;
  href: string;
  /** Short line used in the mobile drawer and footer sitemap. */
  blurb?: string;
}

/**
 * One line of the charter.
 *
 * `proof` and `mark` exist because a promise a school makes about itself is
 * worth exactly as much as the thing standing behind it. The charter section
 * opens one principle at a time and gives each of them a moment on its own,
 * and a moment filled with a single sentence of intent is a moment that says
 * nothing - so every principle carries two checkable practices and one
 * figure already reported elsewhere on the site.
 */
export interface ValuePillar {
  id: string;
  index: string;
  title: string;
  description: string;
  /** Two practices a parent could ask to see the paperwork for. */
  proof: string[];
  /** The one figure the reader should leave the principle holding. */
  mark: { value: string; label: string };
}

/* --------------------------------------------------------------------------
   Vision & mission splash panels
   --------------------------------------------------------------------------
   The two brush-stroke panels on About. Each splash opens a panel
   whose body is laid out one of two ways, so the content model carries the
   layout rather than the component guessing from the copy.
   -------------------------------------------------------------------------- */

/** One line of a stacked panel: a quiet connector, or a shouted claim. */
export interface PanelLine {
  text: string;
  /** `quiet` stays sentence-case grey; the others are uppercase emphasis. */
  tone: 'quiet' | 'primary' | 'deep';
}

export interface PanelColumn {
  /** Rendered one line each, uppercase and large. */
  headline: string[];
  /** Index into `headline` rendered small, inside a pale badge. */
  insetIndex?: number;
  body: string;
}

export interface VisionPanel {
  id: string;
  /** Two lines, as they sit on the splash. */
  labelLines: [string, string];
  /** Which of the two brush colours this panel owns. */
  tone: 'blue' | 'yellow';
  ctaLabel: string;
  /** Where the CTA goes. A router path, so it may leave the page. */
  ctaHref: string;
  /** `stacked` is the alternating-line treatment; `split` is two columns. */
  layout: 'stacked' | 'split';
  lines?: PanelLine[];
  columns?: [PanelColumn, PanelColumn];
}

export interface TeachingPrinciple {
  id: string;
  icon: string;
  title: string;
  description: string;
  /** The concrete practice that makes the principle checkable. */
  proof: string;
}

/**
 * One rung of the Nursery → Class 10 learning journey.
 *
 * `focus` is the promise of the stage; `learning` and `skills` are what the
 * school actually timetables. Copy here is placeholder architecture — the
 * blueprint requires school-approved curriculum before launch.
 */
export interface LearningStage {
  id: string;
  /** Display label, e.g. 'LKG' or 'Classes 9–10'. */
  label: string;
  /** Band the stage belongs to, e.g. 'Pre-Primary'. */
  band: string;
  ages: string;
  focus: string;
  summary: string;
  learning: string[];
  skills: string[];
  outcome: string;
  image: string;
  imageAlt: string;
  /** Palette key for the stage's gradient — defined in LearningJourney.css. */
  accent: string;
  /** Name from the shared `Icon` sprite. */
  icon: string;
}

export interface CurriculumRow {
  stage: string;
  classes: string;
  board: string;
  subjects: string;
  assessment: string;
}

export interface ProofPoint {
  id: string;
  value: string;
  label: string;
  detail: string;
}

export interface DayBlock {
  time: string;
  title: string;
  description: string;
  /** Which part of the day this belongs to — drives the card's accent. */
  tag: 'Open' | 'Academic' | 'Practical' | 'Break' | 'Pastoral' | 'Close';
  icon: string;
}

export interface ActivityStrand {
  id: string;
  title: string;
  meta: string;
  items: string[];
  image: string;
  imageAlt: string;
  icon: string;
  /** Accent key — the section mirrors it so the whole strand recolours. */
  accent: 'blue' | 'coral' | 'violet' | 'mint';
  /** Headline number for the strand's floating badge. */
  stat: { value: string; label: string };
}

export interface SafetyMeasure {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  detail: string;
  portrait: string;
  /** Optional pull-quote shown on leadership cards. */
  quote?: string;
}

export interface FacultyDepartment {
  id: string;
  name: string;
  strength: string;
  description: string;
  leads: string[];
}

export type AchievementCategory =
  | 'Academics'
  | 'Examinations'
  | 'Scholarships'
  | 'Competitions';

export interface Achievement {
  id: string;
  category: AchievementCategory;
  year: string;
  title: string;
  detail: string;
  /** The frame that runs beside the entry in the record. Decorative. */
  image: string;
}

export interface AlumniProfile {
  id: string;
  name: string;
  batch: string;
  now: string;
  quote: string;
  portrait: string;
}

export interface AdmissionStage {
  id: string;
  step: string;
  title: string;
  description: string;
  /** Who acts at this step — sets parent expectations. */
  owner: string;
  duration: string;
}

export interface EligibilityRow {
  entry: string;
  age: string;
  seats: string;
  note: string;
}

export interface KeyDate {
  id: string;
  date: string;
  title: string;
  detail: string;
  status: 'open' | 'upcoming' | 'closed';
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export type NewsCategory = 'Academics' | 'Sports' | 'Arts' | 'Campus' | 'Community';

export interface NewsItem {
  id: string;
  category: NewsCategory;
  date: string;
  title: string;
  excerpt: string;
  image: string;
  imageAlt: string;
  /** Marks the single story that owns the Featured Update slot. */
  featured?: boolean;
}

export interface SchoolEvent {
  id: string;
  date: string;
  day: string;
  month: string;
  title: string;
  detail: string;
  location: string;
}

export interface Notice {
  id: string;
  date: string;
  title: string;
  detail: string;
  urgent?: boolean;
}

export interface ResourceFile {
  id: string;
  group: string;
  title: string;
  detail: string;
  format: string;
  size: string;
}

export interface ContactChannel {
  id: string;
  icon: string;
  label: string;
  value: string;
  href: string;
  detail: string;
}

export interface EnquiryData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

export type EnquiryErrors = Partial<Record<keyof EnquiryData, string>>;

export interface LoginFormData {
  email: string;
  password: string;
}

export type LoginFormErrors = Partial<Record<keyof LoginFormData, string>>;
