import { usePageMeta } from '@/hooks/usePageMeta';
import { ChapterRail } from '@/components/editorial';
import {
  AboutAlumni,
  AboutBreak,
  AboutCharter,
  AboutCover,
  AboutCta,
  AboutFaculty,
  AboutFilm,
  AboutLeadership,
  AboutPhilosophy,
  AboutPrincipal,
  AboutRecognition,
  AboutStory,
  AboutTimeline,
  AboutVisionMission,
} from '@/components/about';

/**
 * PAGE 02 - About. Trust: "Who are they, and can I trust them?"
 *
 * An institutional archive. Every section is either a record or a person, and
 * the page closes on evidence before it closes on an ask.
 *
 * THE ORDER IS THE ARGUMENT
 *
 *   The cover      the chapter, named
 *   01 Story       where it came from, in prose
 *   02 Film        what it looks like, if you have four minutes
 *   03 Timeline    every year of it, on an axis
 *   04 Vision      the two statements, painted, and read by scrolling
 *   05 Charter     the six things it will not trade
 *   06 Philosophy  what leadership actually believes about teaching
 *   07 Principal   the letter, from the person accountable for all of it
 *   08 Leadership  the four who run the school, face by face
 *   09 Faculty     a hundred and one teachers, by department
 *   10 Recognition the figures, stated plainly
 *   11 Alumni      who came back
 *
 * The anchors are the ones this page has always carried - `#story`,
 * `#timeline`, `#vision`, `#principal`, `#faculty`, `#recognition`, `#alumni`
 * - because another page links to two of them and a bookmark outlives a
 * redesign. `#vision` stays on the statements themselves, which is what it
 * has always meant; the charter that used to share that section with them is
 * now its own chapter at `#values`.
 */

/** The running index in the left margin, and the only place it is written. */
const CHAPTERS = [
  { id: 'story', index: '01', label: 'The story' },
  { id: 'film', index: '02', label: 'The film' },
  { id: 'timeline', index: '03', label: 'The timeline' },
  { id: 'vision', index: '04', label: 'Vision & mission' },
  { id: 'values', index: '05', label: 'The charter' },
  { id: 'philosophy', index: '06', label: 'Philosophy' },
  { id: 'principal', index: '07', label: 'The principal' },
  { id: 'leadership', index: '08', label: 'Leadership' },
  { id: 'faculty', index: '09', label: 'The faculty' },
  { id: 'recognition', index: '10', label: 'Recognition' },
  { id: 'alumni', index: '11', label: 'Alumni' },
];

export function AboutPage() {
  usePageMeta({
    title: 'About - New Model High School',
    description:
      'Founded in 1962 in Bahadurpura, Hyderabad. Our story, the values written into the charter, what the leadership believes, the people who run the school, and the record behind them.',
  });

  return (
    <div className="about">
      <ChapterRail items={CHAPTERS} title="About the school" />

      <AboutCover />
      <AboutStory />
      <AboutFilm />
      <AboutTimeline />
      <AboutVisionMission />
      <AboutCharter />
      <AboutPhilosophy />
      <AboutPrincipal />
      <AboutLeadership />
      <AboutFaculty />
      <AboutBreak />
      <AboutRecognition />
      <AboutAlumni />
      <AboutCta />
    </div>
  );
}
