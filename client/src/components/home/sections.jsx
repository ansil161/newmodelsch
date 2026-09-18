import { Link } from 'react-router-dom';
import { ADMISSIONS_INTRO, ROUTES } from '@/constants';
import { academicImages, everydayImages, studentImages } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { rise, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import {
  Collage,
  Figure,
  InviteSection,
  Mark,
  Script,
  SectionHead,
} from '@/components/editorial';
import './home.css';

/* ==========================================================================
   HOME - the guided story
   --------------------------------------------------------------------------
   Eleven sections, in the order a parent's attention actually moves: what the
   place is, how long it has been that, why it is different, what a child
   learns, where it happens, who they become, what other families say, who
   runs it, what it looks like, and then the ask.

   The page is deliberately not a stack of equivalent blocks. Its rhythm is
   the argument:

     a split screen        the claim
     a horizontal axis     the sixty-four years behind it
     a held photograph     the four things that make it different
     a pinned journey      the thirteen years, walked
     a drawn legacy        the four figures behind it
     an asymmetric grid    the place
     a drawn line          the child's own path
     one enormous quote    what it is like from outside
     a letter              who is accountable
     a collage, assembled  what a week looks like
     one ask               and nothing else

   No two adjacent sections share a shape. That constraint is doing more work
   than any individual section on this page.
   ========================================================================== */

/* --------------------------------------------------------------------------
   01 - HERO
   --------------------------------------------------------------------------
   A centred composition on a white sheet: a compact masthead, a badge, the
   two-line claim, one button, and two students cut out of their photographs
   standing at the foot of it. Two concentric hairline rings are drawn round
   the whole thing, and the small coloured icons ride them rather than float.
   Its geometry, entrance and orbit live beside this file. See
   `hero/OrbitHero.jsx`.

   That orbit is now HERO 02. HERO 01 - photographs inside the word
   "imagine" - leads, and a small index on the left edge switches between
   them. `HeroDeck` owns the switch; OrbitHero is mounted as it always was.
   See `hero/HeroDeck.jsx` and `hero/ImagineHero.jsx`.
   -------------------------------------------------------------------------- */

export { HeroDeck as HomeHero } from './hero/HeroDeck';

/* --------------------------------------------------------------------------
   02 - WHY CHOOSE US
   --------------------------------------------------------------------------
   The five reasons bound as a prospectus whose pages the reader's scroll
   turns. A pinned, scrubbed piece of choreography with its own page model,
   so it lives beside this file. See `HomeWhy.jsx`.
   -------------------------------------------------------------------------- */

export { HomeWhy } from './HomeWhy';

/* --------------------------------------------------------------------------
   03 - EDUCATION
   --------------------------------------------------------------------------
   The four bands of the thirteen years. Not four cards: a horizontal band of
   stages where the active one is genuinely larger than its neighbours, so the
   row reads as a progression rather than as a menu.
   -------------------------------------------------------------------------- */

const BANDS = [
  {
    id: 'pre-primary',
    band: 'Pre-Primary',
    classes: 'Nursery - UKG',
    ages: 'Ages 3-6',
    line: 'Wanting to come back tomorrow.',
    body: 'The first three years are about what a school day feels like: being part of a group, finishing a thing you started, and learning that a question is rewarded rather than tolerated.',
    photo: studentImages[0],
    tone: 'green',
  },
  {
    id: 'primary',
    band: 'Primary',
    classes: 'Classes 1-5',
    ages: 'Ages 6-11',
    line: 'The years that decide the rest.',
    body: 'Reading, writing and number taught slowly and checked constantly, because a gap opened here is expensive to close later. Subjects separate out and get specialist teachers from Class 3.',
    photo: studentImages[2],
    tone: 'sun',
  },
  {
    id: 'middle',
    band: 'Middle School',
    classes: 'Classes 6-8',
    ages: 'Ages 11-14',
    line: 'The widest years.',
    body: 'Laboratories, the robotics floor, second languages and the stage all open at once. This is where a student finds out what they are actually drawn to - and gets evidence for it.',
    photo: academicImages[2],
    tone: 'blue',
  },
  {
    id: 'secondary',
    band: 'Secondary',
    classes: 'Classes 9-10',
    ages: 'Ages 14-16',
    line: 'Depth first, technique second.',
    body: 'Board years taught as two years rather than one long revision, and an honest conversation about what comes after Class 10 - prepared inside school hours, with no coaching centre.',
    photo: academicImages[0],
    tone: 'coral',
  },
];

export function HomeEducation() {
  const scope = useGsapScope((_, el) => {
    const cards = el.querySelectorAll('.band');
    rise(cards, { trigger: el, y: 34, stagger: 0.09 });
    unmask(el.querySelectorAll('.band .fig'), { trigger: el, stagger: 0.09 });
  }, []);

  return (
    <section ref={scope} className="section education" id="education">
      <div className="wrap">
        <SectionHead
          sticker="The thirteen years"
          title={
            <>
              One school, four <Mark>chapters</Mark>, no handover a child has to
              survive.
            </>
          }
          lead="Nursery to Class 10 on one campus, with the same staff room behind all of it. Nobody changes schools at eleven because the school ran out of years."
        />

        <ol className="education__bands">
          {BANDS.map((band, i) => (
            <li className={`band band--${band.tone}`} key={band.id}>
              <span className="band__rule" aria-hidden="true" />

              <span className="band__index" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>

              <Figure
                photo={band.photo}
                width={520}
                sizes="(max-width: 700px) 90vw, (max-width: 1100px) 46vw, 23vw"
                shape={i % 2 === 0 ? 'arch' : 'blob'}
                ratio="portrait"
                hover
                className="band__fig"
              />

              <div className="band__text">
                <p className="meta band__meta">
                  {band.classes} · {band.ages}
                </p>
                <h3 className="ed-h3 band__title">{band.band}</h3>
                <p className="band__line">{band.line}</p>
                <p className="band__body">{band.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="education__foot">
          <Link className="link" to={ROUTES.academics}>
            See what is taught, year by year
            <Icon name="arrowRight" size={16} />
          </Link>
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   04 - OUR LEGACY
   --------------------------------------------------------------------------
   One photograph of the place and the four figures behind it, joined by a
   line that is drawn as the reader arrives: the photograph, then the year it
   began, the years since, the alumni and the results. The connector is
   measured from the live layout and the reveal is a sequenced timeline, so
   it lives beside this file. See `HomeTransition.jsx`.
   -------------------------------------------------------------------------- */

export { HomeTransition } from './HomeTransition';

/* --------------------------------------------------------------------------
   05 - CAMPUS
   --------------------------------------------------------------------------
   Lives in its own module. It is the second section on this page with real
   animation logic of its own - a pinned stage, a scrubbed master timeline in
   beats, and one handheld drift per photograph - and inlining that here would
   bury the other ten sections under it. See `HomeCampus.jsx`.
   -------------------------------------------------------------------------- */

export { HomeCampus } from './HomeCampus';

/* --------------------------------------------------------------------------
   06 - THE STUDENT JOURNEY
   --------------------------------------------------------------------------
   Five sheets fed past a fixed claim, pinned. It is a section-sized piece of
   choreography rather than a composition, so it lives beside this file rather
   than inside it - the same arrangement as the campus deck above.
   -------------------------------------------------------------------------- */

export { HomeJourney } from './HomeJourney';

/* --------------------------------------------------------------------------
   07 - VOICES
   --------------------------------------------------------------------------
   The community stories section: four categories of witness, one quote at
   display scale, and a rail of the rest underneath. It is the third section
   on this page with real animation logic of its own - a two-halved swap
   between categories, a scrubbed horizontal rail and a film in a dialog - so
   it lives beside this file rather than inside it, the same arrangement as
   the campus deck and the journey above.
   -------------------------------------------------------------------------- */

export { HomeVoices } from './HomeVoices';

/* --------------------------------------------------------------------------
   08 - THE PRINCIPAL
   --------------------------------------------------------------------------
   The letter, typeset as a magazine spread: a running head, a portrait held
   still beside a two-column letter, and a hung pull quote. It has its own
   layered parallax and a sticky column, so it lives beside this file like
   the other sections with choreography of their own. See `HomePrincipal.jsx`.
   -------------------------------------------------------------------------- */

export { HomePrincipal } from './HomePrincipal';

/* --------------------------------------------------------------------------
   09 - WEEKLY LIFE
   --------------------------------------------------------------------------
   One photograph that, under a pinned scroll, sends six more out from behind
   it into a cluster, then opens that cluster into a collage around the
   sentence. A measured, scrubbed timeline of its own, so it lives beside this
   file like the other pinned sections. See `HomeWeek.jsx`.
   -------------------------------------------------------------------------- */

export { HomeWeek } from './HomeWeek';

/* --------------------------------------------------------------------------
   10 - THE ASK
   -------------------------------------------------------------------------- */

/* The strongest composition of the four, and the closest to the reference:
   a tall arch on the lead, a print either side, and the yellow line running
   out from under the headline, round the photograph and away - the journey
   the headline asks about, drawn. */
export function HomeAdmissions() {
  return (
    <InviteSection
      id="admissions"
      className="invite--home"
      eyebrow={
        <>
          Admissions {ADMISSIONS_INTRO.session}
          <span className="invite__status">
            <span className="sr-only">· </span>
            {ADMISSIONS_INTRO.status}
          </span>
        </>
      }
      title={
        <>
          Ready to begin the <Script>journey?</Script>
        </>
      }
      lead="Places are offered for Nursery through Class 10. About six weeks from a first enquiry to a written offer, and every step of it is on one page."
      actions={[
        { label: 'Enquire now', to: `${ROUTES.admissions}#enquiry` },
        { label: 'Visit campus', to: ROUTES.contact },
      ]}
      footnote={ADMISSIONS_INTRO.statusDetail}
      footIcon="calendar"
      collage={
        <Collage
          ratio={1.08}
          smRatio={0.92}
          photos={[
            {
              photo: everydayImages.deskGirls,
              role: 'main',
              shape: 'arch',
              ratio: 0.8,
              x: 24, y: 5, w: 54, depth: 30,
              sm: { x: 16, y: 3, w: 68 },
              sizes: '(max-width: 699px) 68vw, (max-width: 959px) 52vw, 27vw',
            },
            {
              photo: everydayImages.waving,
              role: 'print',
              ratio: 1.25,
              x: 1, y: 11, w: 31, rotate: -6, depth: 80, from: 'left',
              sm: { x: 0, y: 58, w: 44, rotate: -5 },
              sizes: '(max-width: 699px) 44vw, (max-width: 959px) 30vw, 16vw',
            },
            {
              photo: everydayImages.track,
              role: 'print',
              ratio: 1.33,
              x: 65, y: 47, w: 34, rotate: 5, depth: 110, from: 'right',
              sm: { x: 58, y: 7, w: 42, rotate: 5 },
              sizes: '(max-width: 699px) 42vw, (max-width: 959px) 32vw, 18vw',
            },
          ]}
          marks={[
            { kind: 'brush', tone: 'sky', x: 10, y: 3, w: 84, depth: 16, sm: { x: 4, y: 2, w: 92 } },
            { kind: 'loop', x: -22, y: 44, w: 112, depth: -24, sm: { x: -8, y: 58, w: 116 } },
            { kind: 'sparks', x: 74, y: -1, w: 9, rotate: 8, sm: { x: 80, y: 38, w: 13 } },
            { kind: 'star', tone: 'sky', x: 90, y: 32, w: 5.5, depth: 60, sm: false },
            { kind: 'arrow', tone: 'ink', x: 8, y: 48, w: 10, rotate: 22, depth: 70, sm: false },
          ]}
          notes={[{ text: 'Nursery → Class 10', x: -10, y: 41, rotate: -5, depth: 70, sm: false }]}
        />
      }
    />
  );
}
