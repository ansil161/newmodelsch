import { usePageMeta } from '@/hooks/usePageMeta';
import {
  HomeAdmissions,
  HomeCampus,
  HomeHero,
  HomeJourney,
  HomePrincipal,
  HomeTransition,
  HomeVoices,
  HomeWeek,
  HomeWhy,
} from '@/components/home';

export function HomePage() {
  usePageMeta({
    title: 'New Model High School - Building minds that move the world. Since 1962.',
    description:
      'New Model High School, Bahadurpura, Hyderabad. One campus, Nursery through Class 10, sixty-four years, and twelve consecutive years of full board results prepared inside school hours. Admissions open for 2026-27.',
  });

  return (
    <>
      {/* 01 - the claim */}
      <HomeHero />

      {/* 02 - the five things that make it different, each with its evidence */}
      <HomeWhy />

      {/* 03 - the pause. Nothing to read, nothing to do. */}
      <HomeTransition />

      {/* 04 - the place */}
      <HomeCampus />

      {/* 05 - one child's path through it, drawn as a line */}
      <HomeJourney />

      {/* 06 - what it is like from outside */}
      <HomeVoices />

      {/* 07 - who is accountable */}
      <HomePrincipal />

      {/* 08 - what an ordinary week looks like, as a moving ribbon */}
      <HomeWeek />

      {/* 09 - the ask, and nothing else */}
      <HomeAdmissions />
    </>
  );
}
