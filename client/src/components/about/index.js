/* THE SCROLL-SCRUBBED OPENING IS NOT HERE.

   `AboutSequenceHero` and its stylesheet were never committed and are no
   longer on disk, and the frame sequence still sitting in
   `public/assets/hero-sequence/` is the placeholder set its generator
   produced - colour bars with a frame counter, not photography. So the page
   opens with `AboutCover` again, which is what the sequence had replaced.

   To bring the sequence back: restore the component, point AboutPage at it,
   and re-export it here. `AboutCover` stays exported either way. */

export {
  AboutStory,
  AboutFilm,
  AboutTimeline,
  AboutPhilosophy,
  AboutPrincipal,
  AboutFaculty,
  AboutAlumni,
  AboutCta,
} from './sections';

export { AboutCover } from './AboutHero';
export { AboutLedger } from './LegacyLedger';
export { VisionMission as AboutVisionMission } from './VisionMission';
export { CharterScrollSection as AboutCharter } from './CharterScrollSection';
export { AboutLeadership } from './Leadership';
