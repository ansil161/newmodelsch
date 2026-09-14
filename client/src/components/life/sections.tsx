import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ACTIVITY_STRANDS,
  CAMPUS_INTRO,
  ROUTES,
  SCHOOL,
  VISIT_CAMPUS,
} from '@/constants';
import {
  artsImages,
  campusImages,
  everydayImages,
  galleryImages,
  sportsImages,
  studentImages,
} from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { draw, drift, rise, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import {
  Collage,
  CTASection,
  Figure,
  HorizontalGallery,
  InviteSection,
  Mark,
  PageCover,
  Script,
  SectionHead,
  StatReveal,
} from '@/components/editorial';
import './life.css';

/* ==========================================================================
   STUDENT LIFE - the human page
   --------------------------------------------------------------------------
   It opens on the school day rather than on the buildings, because a parent
   picturing their child here is picturing a morning, not a floor plan.

   This is the page the site spends its photography on. Everything else stays
   ruled and quiet; this one is allowed to be a magazine.

   THERE IS NO GALLERY SECTION ON THIS PAGE.

   Every photograph here sits inside the section it is evidence for - the
   day, the campus, the strands. The school's archive of photographs, browsed
   by category, year and event, is its own page under this one:
   /student-life/gallery. The wall below links to it.
   ========================================================================== */

/* --------------------------------------------------------------------------
   The cover
   -------------------------------------------------------------------------- */

export function SlCover() {
  return (
    <PageCover
      sticker="Student life"
      title={
        <>
          A day that never <span className="ed-em">stands still.</span>
        </>
      }
      question="What will my child's day feel like here?"
      lead="The shape of an ordinary morning, the spaces it happens in, the things that happen between lessons, and the safety policy behind all of it. Nothing on this page is staged for visitors."
      photo={studentImages[3]}
      facts={CAMPUS_INTRO.facts.map((fact) => ({
        value: fact.value,
        label: fact.label,
        detail: fact.detail,
      }))}
    />
  );
}

/* --------------------------------------------------------------------------
   02 - THE CAMPUS
   --------------------------------------------------------------------------
   A walk through the building rather than a facilities list. Select a space
   and the large frame changes; the list beside it is a floor plan in words.

   IT IS THE ONE SECTION ON THE SITE WHERE THE PHOTOGRAPH IS THE CONTENT, so
   the frame is the biggest single image on any page.
   -------------------------------------------------------------------------- */

const SPACES = [
  { id: 'classrooms', name: 'Classrooms', meta: '48 rooms, all daylit from two sides', photo: campusImages[0] },
  { id: 'labs', name: 'Science laboratories', meta: 'Five benches, one practical per topic from Class 6', photo: campusImages[1] },
  { id: 'robotics', name: 'The robotics floor', meta: 'Open to Classes 6-10, enough machines that nobody shares', photo: campusImages[2] },
  { id: 'library', name: 'The library', meta: '22,000 volumes and a reading hall for 120', photo: campusImages[3] },
  { id: 'sport', name: 'Sports complex', meta: 'A full-length track, courts, and an indoor arena', photo: campusImages[4] },
  { id: 'studio', name: 'Arts studio', meta: 'Fine art, design and ceramics, timetabled and examined', photo: campusImages[5] },
  { id: 'music', name: 'Music wing', meta: 'Carnatic, Western and percussion, with practice rooms', photo: campusImages[6] },
];

export function SlCampus() {
  const [active, setActive] = useState(0);
  const current = SPACES[active];

  const scope = useGsapScope<HTMLElement>((_, el) => {
    unmask(el.querySelectorAll<HTMLElement>('.campex__frame'), { trigger: el, from: 'bottom' });
    rise(el.querySelectorAll<HTMLElement>('.campex__row'), { trigger: el, y: 16, stagger: 0.05 });
    drift(el.querySelector('.campex__frame img'), 60, { trigger: el });
  }, []);

  return (
    <section ref={scope} className="section section--sand campex" id="campus">
      <div className="wrap">
        <SectionHead
          sticker="02 · Four acres"
          stickerTilt={2}
          title={
            <>
              Built around a courtyard, so no corridor is a{' '}
              <Mark>dead end.</Mark>
            </>
          }
          lead={CAMPUS_INTRO.lead}
          className="campex__head"
        />

        <div className="campex__body">
          <div className="campex__frame">
            <Figure
              photo={current.photo}
              width={1200}
              sizes="(max-width: 900px) 92vw, 56vw"
              shape="frame"
              ratio="wide"
              key={current.id}
              decorative
            />
            <p className="campex__caption">
              <b>{current.name}</b>
              <span className="meta">{current.meta}</span>
            </p>
          </div>

          <ul className="campex__list">
            {SPACES.map((space, i) => (
              <li key={space.id}>
                <button
                  type="button"
                  className={`campex__row${i === active ? ' is-on' : ''}`}
                  aria-pressed={i === active}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  data-cursor="View"
                >
                  <span className="campex__num meta">{String(i + 1).padStart(2, '0')}</span>
                  <span className="campex__name">{space.name}</span>
                  <Icon name="arrowRight" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <StatReveal
          items={CAMPUS_INTRO.facts.map((fact) => ({
            value: fact.value,
            label: fact.label,
            detail: fact.detail,
          }))}
          layout="grid"
          className="campex__stats"
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   03 - BEYOND THE CLASSROOM
   --------------------------------------------------------------------------
   Four strands, each with its own accent, its own headline figure and the
   actual list of what runs. The figure is the point: "six periods a week" is
   an answer, "we value sport" is not.
   -------------------------------------------------------------------------- */

export function SlBeyond() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const strands = el.querySelectorAll<HTMLElement>('.strand');
    strands.forEach((strand, i) => {
      unmask(strand.querySelectorAll<HTMLElement>('.fig'), {
        trigger: strand,
        from: i % 2 === 0 ? 'left' : 'right',
      });
      rise(strand.querySelectorAll<HTMLElement>('[data-lift]'), {
        trigger: strand,
        y: 22,
        stagger: 0.06,
      });
      drift(strand.querySelector('img'), 50, { trigger: strand });
    });
    draw(el, { trigger: el, delay: 0.4 });
  }, []);

  return (
    <section ref={scope} className="section beyond-cl" id="beyond">
      <div className="wrap">
        <SectionHead
          sticker="03 · Beyond the classroom"
          title={
            <>
              Every child is in something. Nobody is in a{' '}
              <Mark kind="underline">corridor.</Mark>
            </>
          }
          lead="Sport, arts, clubs and competitions all have timetabled hours and named staff. The figures beside each are what those hours actually are."
          className="beyond-cl__head"
        />

        <ol className="strands">
          {ACTIVITY_STRANDS.map((strand, i) => (
            <li
              className={`strand strand--${strand.accent}`}
              key={strand.id}
              id={`strand-${strand.id}`}
            >
              <Figure
                photo={[sportsImages[0], artsImages[0], studentImages[3], galleryImages[5]][i]}
                width={820}
                sizes="(max-width: 900px) 90vw, 46vw"
                shape={i % 2 === 0 ? 'blob' : 'arch'}
                ratio="landscape"
                hover
                className="strand__fig"
              />

              <div className="strand__text">
                <p className="strand__stat" data-lift>
                  <span className="stat-num">{strand.stat.value}</span>
                  <span>{strand.stat.label}</span>
                </p>
                <h3 className="ed-h2 strand__title" data-lift>
                  {strand.title}
                </h3>
                <p className="meta strand__meta" data-lift>
                  {strand.meta}
                </p>
                <ul className="strand__items" data-lift>
                  {strand.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   03b - THE WALL
   --------------------------------------------------------------------------
   The one place on this page where photographs are just photographs. It sits
   after the strands rather than replacing them, so nothing here is carrying
   information that only exists as a picture.
   -------------------------------------------------------------------------- */

export function SlWall() {
  return (
    <HorizontalGallery
      cue="Drag"
      frames={galleryImages.map((photo, i) => ({
        photo,
        size: (['tall', 'md', 'sm', 'lg', 'md', 'tall', 'sm', 'md', 'lg', 'sm'] as const)[i % 10],
        shape: (['arch', 'frame', 'round', 'frame', 'blob', 'arch', 'round', 'blob', 'frame', 'arch'] as const)[i % 10],
      }))}
    >
      <SectionHead
        sticker="This term"
        stickerTilt={-2.6}
        title={
          <>
            Photographs taken by people who <Mark>work here.</Mark>
          </>
        }
      >
        <Link className="link" to={ROUTES.gallery}>
          Open the school gallery
          <Icon name="arrowRight" size={15} />
        </Link>
      </SectionHead>
    </HorizontalGallery>
  );
}

/* --------------------------------------------------------------------------
   04 - IN THEIR OWN WORDS
   --------------------------------------------------------------------------
   Four students on film, as four panels that open under the pointer. It is
   the one section on the site where the school is not the narrator, and the
   only one with a video player in it, so it lives beside this file rather
   than inside it. See `SlVoices.tsx`.
   -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   05 - SAFETY
   --------------------------------------------------------------------------
   A composed scene with its own master timeline, so it lives beside this file
   rather than inside it - the same arrangement as the day. See `SlSafety.tsx`.
   -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   06 - THE VISIT
   -------------------------------------------------------------------------- */

/* Student life is a collection of ordinary moments, so this spread is the
   busiest of the four: a lesson in the lead, and the ground, the pitch and a
   classmate pinned around it, each with a word written beside it. */
export function SlVisit() {
  return (
    <InviteSection
      id="visit"
      className="invite--visit"
      eyebrow={`06 · ${VISIT_CAMPUS.eyebrow}`}
      title={
        <>
          Come on a Tuesday, while the lessons are <Script>running.</Script>
        </>
      }
      lead={VISIT_CAMPUS.lead}
      actions={[{ label: 'Call to book', href: SCHOOL.phoneHref, icon: 'phone' }]}
      collage={
        <Collage
          ratio={1.12}
          smRatio={0.9}
          photos={[
            {
              photo: everydayImages.deskBoys,
              role: 'main',
              shape: 'blob',
              ratio: 0.8,
              x: 20, y: 10, w: 56, depth: 30,
              sm: { x: 14, y: 6, w: 62 },
              sizes: '(max-width: 699px) 62vw, (max-width: 959px) 52vw, 28vw',
            },
            {
              photo: everydayImages.yoga,
              role: 'print',
              ratio: 1.4,
              x: 62, y: 0, w: 38, rotate: 5, depth: 90, from: 'top',
              sm: { x: 56, y: 0, w: 44, rotate: 4 },
              sizes: '(max-width: 699px) 44vw, (max-width: 959px) 36vw, 20vw',
            },
            {
              photo: everydayImages.football,
              role: 'print',
              ratio: 1.33,
              x: 0, y: 56, w: 34, rotate: -6, depth: 70, from: 'left',
              sm: { x: 0, y: 60, w: 46, rotate: -5 },
              sizes: '(max-width: 699px) 46vw, (max-width: 959px) 32vw, 18vw',
            },
            {
              photo: everydayImages.reading,
              role: 'print',
              ratio: 0.9,
              x: 70, y: 58, w: 28, rotate: 4, depth: 120, from: 'right',
              sm: { x: 62, y: 58, w: 36, rotate: 4 },
              sizes: '(max-width: 699px) 36vw, (max-width: 959px) 26vw, 15vw',
            },
          ]}
          marks={[
            { kind: 'brush', tone: 'sky', x: 14, y: 10, w: 80, depth: 16, sm: { x: 6, y: 6, w: 88 } },
            { kind: 'sparks', x: 13, y: 4, w: 8, rotate: -80, depth: 40, sm: { x: 4, y: 0, w: 12, rotate: -80 } },
            { kind: 'arrow', tone: 'ink', x: 9, y: 29, w: 10, rotate: 18, depth: 60, sm: false },
            { kind: 'arrow-down', tone: 'ink', x: 83, y: 41, w: 5, rotate: 6, depth: 90, sm: false },
            { kind: 'star', tone: 'sky', x: 56, y: 93, w: 5, depth: 50, sm: false },
          ]}
          notes={[
            { text: 'Learn', x: 3, y: 20, rotate: -8, depth: 60, sm: false },
            { text: 'Play', x: 3, y: 88, rotate: -4, depth: 70, sm: false },
            { text: 'Together', x: 72, y: 33, rotate: -5, depth: 90, sm: false },
          ]}
        />
      }
    >
      <ul className="invite__slots">
        {VISIT_CAMPUS.slots.map((slot) => (
          <li className="chip" key={slot}>
            <Icon name="clock" size={13} />
            {slot}
          </li>
        ))}
      </ul>
    </InviteSection>
  );
}

export function SlCta() {
  return (
    <CTASection
      sticker="Admissions 2026-27"
      title={
        <>
          Picture them here on an ordinary{' '}
          <Mark kind="underline">Tuesday.</Mark>
        </>
      }
      lead="Places are offered for Nursery through Class 10. About six weeks from a first enquiry to a written offer."
      photo={studentImages[4]}
      actions={[
        { label: 'Start an enquiry', to: `${ROUTES.admissions}#enquiry`, variant: 'sun' },
        { label: 'Contact the school', to: ROUTES.contact, variant: 'secondary' },
      ]}
      footnote={`${SCHOOL.locality} · ${SCHOOL.phone}`}
    />
  );
}
