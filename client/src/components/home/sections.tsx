import { Link } from 'react-router-dom';
import { ADMISSIONS_INTRO, PRINCIPAL, ROUTES, STATS, WHY_CHOOSE } from '@/constants';
import {
  academicImages,
  artsImages,
  campusImages,
  everydayImages,
  facultyImages,
  galleryImages,
  heroImage,
  heroInsets,
  studentImages,
} from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { draw, drift, lines, rise, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import {
  Collage,
  EditorialHero,
  Figure,
  HorizontalGallery,
  InviteSection,
  Mark,
  PhotoBreak,
  Script,
  SectionHead,
  StatReveal,
  Sticker,
  StickyStory,
} from '@/components/editorial';
import type { StoryPanel } from '@/components/editorial';
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
     a full-bleed band     the pause
     an asymmetric grid    the place
     a drawn line          the child's own path
     one enormous quote    what it is like from outside
     a letter              who is accountable
     a wall                what it looks like
     one ask               and nothing else

   No two adjacent sections share a shape. That constraint is doing more work
   than any individual section on this page.
   ========================================================================== */

/* --------------------------------------------------------------------------
   01 - HERO
   -------------------------------------------------------------------------- */

export function HomeHero() {
  return (
    <EditorialHero
      sticker="Bahadurpura, Hyderabad · Est. 1962"
      title={[
        <>Building minds</>,
        <>
          that <Mark>move</Mark> the
        </>,
        <>world.</>,
      ]}
      question="Is this the right school for my child?"
      lead="One campus, Nursery through Class 10, and a rule written into the charter in 1962 that has never been amended: no class grows past the point where a teacher can hold every name."
      photo={heroImage}
      inset={heroInsets[0]}
      figures={[
        { value: '64', label: 'Years of legacy' },
        { value: '13', label: 'Years of learning' },
        { value: '100%', label: 'Board results, 12 years' },
      ]}
      actions={[
        { label: 'Explore the school', to: ROUTES.about, variant: 'primary' },
        { label: 'Start an admission', to: ROUTES.admissions, variant: 'secondary' },
      ]}
      cue="Scroll"
    />
  );
}

/* --------------------------------------------------------------------------
   02 - WHY CHOOSE US
   --------------------------------------------------------------------------
   The five claims the school makes about itself, each held on screen beside
   the photograph that evidences it. Sticky rather than pinned - see
   StickyStory for why that distinction is load-bearing.
   -------------------------------------------------------------------------- */

const STRENGTHS: StoryPanel[] = WHY_CHOOSE.map((item, i) => ({
  id: `why-${item.id}`,
  index: String(i + 1).padStart(2, '0'),
  kicker: ['Curious by design', 'Rooted in values', 'Built for every child', 'Learning beyond marks', 'A place to come back to'][i],
  title: item.title,
  body: item.description,
  photo: [academicImages[0], studentImages[3], studentImages[2], artsImages[0], studentImages[5]][i],
}));

export function HomeWhy() {
  return (
    <section className="section why" id="why">
      <div className="wrap">
        <SectionHead
          sticker="What makes it different"
          stickerTilt={2}
          title={
            <>
              What makes this <br />
              place <Mark kind="ring">different?</Mark>
            </>
          }
          lead="Five answers, and every one of them is something you can check on a campus visit rather than something we can only assert here."
          className="why__head"
        />

        <StickyStory panels={STRENGTHS} media="left" shape="blob" showCounter={false} className="why__story" />
      </div>
    </section>
  );
}

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
] as const;

export function HomeEducation() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const cards = el.querySelectorAll<HTMLElement>('.band');
    rise(cards, { trigger: el, y: 34, stagger: 0.09 });
    unmask(el.querySelectorAll<HTMLElement>('.band .fig'), { trigger: el, stagger: 0.09 });
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
   04 - THE TRANSITION
   --------------------------------------------------------------------------
   The pause between the education and the place. One statement at the largest
   size on the site, over a photograph that drifts behind it.

   It is the only section on the homepage with nothing to read and nothing to
   do. That is its job: the two sections either side of it are dense, and a
   long page loses people at exactly the seam between two dense things.
   -------------------------------------------------------------------------- */

export function HomeTransition() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const head = el.querySelector<HTMLElement>('.tr__title');
    const image = el.querySelector<HTMLElement>('.tr__bg img');
    if (head) lines(head, { trigger: el, start: 'top 78%' });
    if (image) drift(image, 130, { trigger: el });
    draw(el, { trigger: el, delay: 0.6, start: 'top 78%' });
    rise(el.querySelectorAll<HTMLElement>('.tr__foot > *'), { trigger: el, delay: 0.5 });
  }, []);

  return (
    <section ref={scope} className="tr" aria-labelledby="tr-title">
      <div className="tr__bg" aria-hidden="true">
        <Figure
          photo={campusImages[8]}
          width={2000}
          sizes="100vw"
          shape="square"
          ratio="free"
          decorative
        />
        <span className="tr__scrim" />
      </div>

      <div className="tr__inner wrap">
        <h2 className="tr__title ed-mega" id="tr-title">
          Thirteen years.
          <br />
          <Mark kind="underline">One journey.</Mark>
        </h2>

        <div className="tr__foot">
          <p className="tr__lead">
            A child who joins in Nursery leaves in Class 10 having been taught by the same
            institution for their entire school life - by people who watched them learn to read.
          </p>
          <StatReveal
            items={STATS.map((stat) => ({
              value: `${stat.value.toLocaleString('en-IN')}${stat.suffix}`,
              label: stat.label,
              detail: stat.detail,
            }))}
            layout="row"
            className="tr__stats"
          />
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   05 - CAMPUS
   --------------------------------------------------------------------------
   Lives in its own module. It is the second section on this page with real
   animation logic of its own - a pinned stage, a scrubbed master timeline in
   beats, and one handheld drift per photograph - and inlining that here would
   bury the other ten sections under it. See `HomeCampus.tsx`.
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
   A portrait, a pull quote at display scale, and the letter underneath. The
   quote and the letter are the same voice, so the quote is set as the thing
   she says and the letter as the thing she wrote - which is why one is serif
   and the other is not.
   -------------------------------------------------------------------------- */

export function HomePrincipal() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const quote = el.querySelector<HTMLElement>('.principal__quote');
    const frame = el.querySelector<HTMLElement>('.principal__fig');
    if (quote) lines(quote, { trigger: el });
    if (frame) unmask(frame, { trigger: el, from: 'left' });
    draw(el, { trigger: el, delay: 0.6 });
    rise(el.querySelectorAll<HTMLElement>('.principal__letter > *'), {
      trigger: el,
      delay: 0.3,
      stagger: 0.08,
    });
    drift(el.querySelector('.principal__fig img'), 60, { trigger: el });
  }, []);

  return (
    <section ref={scope} className="section principal" id="principal">
      <div className="wrap principal__inner">
        <div className="principal__media">
          <Figure
            photo={facultyImages[0]}
            width={720}
            sizes="(max-width: 900px) 78vw, 34vw"
            shape="arch"
            ratio="portrait"
            className="principal__fig"
          />
          <p className="principal__badge">
            <b>{PRINCIPAL.name}</b>
            <span className="meta">{PRINCIPAL.tenure}</span>
          </p>
        </div>

        <div className="principal__body">
          <Sticker tone="sun" tilt={-2.2}>
            From the principal
          </Sticker>

          <blockquote className="principal__quote ed-h1">
            A school is not a building. It is a community of people who believe in{' '}
            <Mark kind="underline">possibility.</Mark>
          </blockquote>

          <div className="principal__letter">
            {PRINCIPAL.letter.map((paragraph) => (
              <p className="body-text" key={paragraph.slice(0, 24)}>
                {paragraph}
              </p>
            ))}
            <p className="principal__sign">
              <span className="principal__name">{PRINCIPAL.name}</span>
              <span className="meta">{PRINCIPAL.title}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   09 - THE WALL
   -------------------------------------------------------------------------- */

const WALL = galleryImages.map((photo, i) => ({
  photo,
  size: (['md', 'tall', 'sm', 'lg', 'md', 'tall', 'sm', 'lg', 'md', 'tall'] as const)[i % 10],
  shape: (['frame', 'arch', 'round', 'frame', 'blob', 'arch', 'round', 'frame', 'blob', 'arch'] as const)[
    i % 10
  ],
  caption: [
    'Morning assembly',
    'State champions',
    'Chemistry practicals',
    'Annual day',
    'Track & field',
    'Robotics finals',
    'Reading hour',
    'Founders week',
    'The studio',
    'Between lessons',
  ][i],
}));

export function HomeWall() {
  return (
    <HorizontalGallery id="gallery" frames={WALL} cue="Drag">
      <SectionHead
        sticker="An ordinary week"
        stickerTilt={2}
        title={
          <>
            Not a single one of these was <Mark>staged.</Mark>
          </>
        }
        lead="Photographs taken on normal school days, by people who work here."
      />
    </HorizontalGallery>
  );
}

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

/* --------------------------------------------------------------------------
   The pause between the wall and the ask.
   -------------------------------------------------------------------------- */

export function HomeBreak() {
  return <PhotoBreak photos={[studentImages[4], campusImages[8], artsImages[1]]} />;
}
