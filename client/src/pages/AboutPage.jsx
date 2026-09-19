import { usePageMeta } from '@/hooks/usePageMeta';
import {
  AboutAlumni,
  AboutCharter,
  AboutCover,
  AboutCta,
  AboutFaculty,
  AboutFilm,
  AboutLeadership,
  AboutPhilosophy,
  AboutPrincipal,
  AboutStory,
  AboutVisionMission,
} from '@/components/about';

export function AboutPage() {
  usePageMeta({
    title: 'About - New Model High School',
    description:
      'Founded in 1962 in Bahadurpura, Hyderabad. Our story, the values written into the charter, what the leadership believes, the people who run the school, and the record behind them.',
  });

  return (
    <div className="about">
      {/* The scroll-scrubbed frame sequence that briefly opened this page is
          gone - see the note in '@/components/about'. Back to the cover. */}
      <AboutCover />
      <AboutStory />
      <AboutFilm />
      {/* The record (five photo pillars) now lives on the home page, after
          the campus. `AboutRecord` is still exported from here. */}
      <AboutVisionMission />
      <AboutCharter />
      <AboutPhilosophy />
      <AboutPrincipal />
      <AboutLeadership />
      <AboutFaculty />
      <AboutAlumni />
      <AboutCta />
    </div>
  );
}
