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
  AboutTimeline,
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
      <AboutAlumni />
      <AboutCta />
    </div>
  );
}
