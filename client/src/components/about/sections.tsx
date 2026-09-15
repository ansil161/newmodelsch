import { useState } from 'react';
import {
  ALUMNI,
  ALUMNI_REACH,
  FACULTY_DEPARTMENTS,
  FACULTY_STATS,
  HERITAGE_CHAPTERS,
  PHILOSOPHY,
  ROUTES,
  SCHOOL,
  SCHOOL_FILM,
  STORY,
} from '@/constants';
import {
  academicImages,
  artsImages,
  campusImages,
  everydayImages,
  facultyImages,
  heritageImages,
  studentImages,
} from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { draw, drift, lines, rise, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import {
  Collage,
  EditorialTimeline,
  Figure,
  InviteSection,
  Mark,
  Script,
  PageCover,
  SectionHead,
  StatReveal,
  Sticker,
} from '@/components/editorial';
import type { TimelineEntry } from '@/components/editorial';
import './about.css';

/* ==========================================================================
   ABOUT - the institutional archive
   --------------------------------------------------------------------------
   The page answers one question: who are these people, and can I trust them?
   Everything on it is either a record or a person, and it closes on evidence
   rather than on another call to action.

   The whole page is built to be checkable. Every claim is next to the thing
   that proves it - a date, a photograph, a name, a number - because the way a
   school earns trust in writing is by being specific in places it could have
   been vague.
   ========================================================================== */

/* --------------------------------------------------------------------------
   The cover
   -------------------------------------------------------------------------- */

export function AboutCover() {
  return (
    <PageCover
      sticker="About the school"
      title={
        <>
          Our <span className="ed-em">story.</span>
        </>
      }
      question="Who are they, and can I trust them?"
      lead={STORY.lead}
      photo={heritageImages[0]}
      facts={STORY.marks.map((mark) => ({ value: mark.value, label: mark.label }))}
    />
  );
}

/* --------------------------------------------------------------------------
   01 - THE STORY
   --------------------------------------------------------------------------
   The record, told straight. A single column of running prose beside one tall
   photograph, which is the shape a page uses when it wants to be believed
   rather than admired.
   -------------------------------------------------------------------------- */

export function AboutStory() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const head = el.querySelector<HTMLElement>('.story__title');
    if (head) lines(head, { trigger: el });
    draw(el, { trigger: el, delay: 0.55 });
    unmask(el.querySelectorAll<HTMLElement>('.story__fig'), { trigger: el, from: 'bottom' });
    drift(el.querySelector('.story__fig img'), 70, { trigger: el });
    rise(el.querySelectorAll<HTMLElement>('.story__prose > *'), {
      trigger: el,
      delay: 0.25,
      stagger: 0.08,
    });
  }, []);

  return (
    <section ref={scope} className="section story" id="story">
      <div className="wrap story__inner">
        <div className="story__head">
          <Sticker tone="sun" tilt={-2.2}>
            {STORY.eyebrow}
          </Sticker>
          <h2 className="story__title ed-h1">
            Two rooms, forty children, and a promise nobody has{' '}
            <Mark kind="underline">renegotiated.</Mark>
          </h2>
        </div>

        <Figure
          photo={heritageImages[0]}
          width={720}
          sizes="(max-width: 900px) 88vw, 34vw"
          shape="frame"
          ratio="tall"
          className="story__fig"
          note="The first classroom, 1962"
        />

        <div className="story__prose">
          {STORY.paragraphs.map((paragraph) => (
            <p className="body-text" key={paragraph.slice(0, 22)}>
              {paragraph}
            </p>
          ))}
        </div>

        {/* A sibling of the prose, not a child of it: from 900px the prose
            column is a third of the page, too narrow for four figures, so the
            marks take their own row across all three columns. */}
        <StatReveal
          items={STORY.marks.map((mark) => ({ value: mark.value, label: mark.label }))}
          layout="grid"
          className="story__marks"
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   02 - THE FILM
   --------------------------------------------------------------------------
   A poster that becomes a player on request.

   IT DOES NOT AUTOPLAY, AND IT IS NOT A BACKGROUND VIDEO.

   A four-minute film is a real request for someone's time, so it is asked for
   rather than started: nothing downloads until the play button is pressed
   (`preload="none"`), and what arrives has controls, because a person
   watching a film wants to be able to pause it.

   The file may genuinely not be there - it is served straight out of
   `public/videos/`, so the school can drop the mp4 in without a code change,
   and until they do the src 404s. That is handled rather than ignored: the
   error state says what happened and leaves the poster up.
   -------------------------------------------------------------------------- */

export function AboutFilm() {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const scope = useGsapScope<HTMLElement>((_, el) => {
    unmask(el.querySelectorAll<HTMLElement>('.film__frame'), { trigger: el, from: 'bottom' });
    rise(el.querySelectorAll<HTMLElement>('.film__text > *'), { trigger: el, stagger: 0.08 });
  }, []);

  return (
    <section ref={scope} className="section film" id="film">
      <div className="wrap film__inner">
        <div className="film__text">
          <Sticker tone="paper" tilt={2}>
            {SCHOOL_FILM.eyebrow}
          </Sticker>
          <h2 className="ed-h2 film__title">{SCHOOL_FILM.title}</h2>
          <p className="lead film__lead">{SCHOOL_FILM.lead}</p>
          <p className="meta film__cap">
            {SCHOOL_FILM.runtime} · {SCHOOL_FILM.caption}
          </p>
        </div>

        <div className="film__frame">
          {playing && !failed ? (
            <video
              className="film__video"
              src={SCHOOL_FILM.src}
              poster={SCHOOL_FILM.poster}
              controls
              autoPlay
              playsInline
              preload="none"
              onError={() => {
                setFailed(true);
                setPlaying(false);
              }}
            >
              {SCHOOL_FILM.captions ? (
                <track kind="captions" src={SCHOOL_FILM.captions} srcLang="en" label="English" default />
              ) : null}
            </video>
          ) : (
            <>
              <Figure
                photo={studentImages[0]}
                width={1400}
                sizes="(max-width: 900px) 92vw, 60vw"
                shape="frame"
                ratio="wide"
                decorative
              />
              <span className="film__scrim" aria-hidden="true" />

              <button
                type="button"
                className="film__play"
                onClick={() => {
                  setFailed(false);
                  setPlaying(true);
                }}
                data-cursor="Play"
              >
                <span className="film__play-ring" aria-hidden="true">
                  <Icon name="play" size={22} />
                </span>
                <span className="film__play-label">
                  {failed ? 'Try again' : `Play the film · ${SCHOOL_FILM.runtime}`}
                </span>
              </button>

              {failed ? (
                <p className="film__error" role="status">
                  The film is not on the server yet. Drop the file at{' '}
                  <code>public{SCHOOL_FILM.src}</code> and this plays with no other change.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   03 - THE TIMELINE
   --------------------------------------------------------------------------
   The same horizontal axis the homepage uses, carrying the long version. The
   homepage prints seven milestones; this prints the eight chapters, with the
   quotations and the asides the homepage has no room for.
   -------------------------------------------------------------------------- */

const CHAPTERS: TimelineEntry[] = HERITAGE_CHAPTERS.map((chapter, i) => ({
  id: `chapter-${i}`,
  year: chapter.date.split(' ').pop() ?? chapter.date,
  title: chapter.badge ?? chapter.headline.split(/[-–—]/)[0].split(',')[0],
  body: chapter.body ?? chapter.aside ?? chapter.quote?.text,
  photo: heritageImages[i],
  note: chapter.media?.note,
  major: Boolean(chapter.badge) || i === 0 || i === HERITAGE_CHAPTERS.length - 1,
}));

export function AboutTimeline() {
  return (
    <EditorialTimeline id="timeline" entries={CHAPTERS}>
      <SectionHead
        sticker="The record"
        stickerTilt={2}
        title={
          <>
            Every year of it is written <Mark>down.</Mark>
          </>
        }
        size="h3"
        className="sec-head--wide"
      />
    </EditorialTimeline>
  );
}

/* --------------------------------------------------------------------------
   06 - PHILOSOPHY
   -------------------------------------------------------------------------- */

export function AboutPhilosophy() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const head = el.querySelector<HTMLElement>('.phil__title');
    if (head) lines(head, { trigger: el });
    draw(el, { trigger: el, delay: 0.55 });
    unmask(el.querySelectorAll<HTMLElement>('.phil__fig'), { trigger: el, from: 'left' });
    drift(el.querySelector('.phil__fig img'), 60, { trigger: el });
    rise(el.querySelectorAll<HTMLElement>('.phil__prose > *'), { trigger: el, stagger: 0.08, delay: 0.2 });
  }, []);

  return (
    <section ref={scope} className="section phil" id="philosophy">
      <div className="wrap phil__inner">
        <Figure
          photo={academicImages[0]}
          width={760}
          sizes="(max-width: 900px) 88vw, 40vw"
          shape="arch"
          ratio="portrait"
          className="phil__fig"
        />

        <div className="phil__body">
          <Sticker tone="sun" tilt={2}>
            {PHILOSOPHY.eyebrow}
          </Sticker>
          <h2 className="phil__title ed-h1">
            A school is the sum of the adults a child <Mark>meets in it.</Mark>
          </h2>
          <div className="phil__prose">
            {PHILOSOPHY.paragraphs.map((paragraph) => (
              <p className="body-text" key={paragraph.slice(0, 22)}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   06 - THE PRINCIPAL
   --------------------------------------------------------------------------
   The shared dark feature, with the whole message. The Charter's call to
   action scrolls to its `#principal` anchor. See `components/principal`.
   -------------------------------------------------------------------------- */

export { AboutPrincipal } from '@/components/principal/PrincipalMessage';

/* --------------------------------------------------------------------------
   08 - THE FACULTY ARCHIVE
   --------------------------------------------------------------------------
   Six departments as an index a reader opens, rather than six cards they
   scroll past.

   IT IS A LIST OF BUTTONS AND ONE PANEL, NOT A TAB WIDGET.

   Real buttons with `aria-expanded`, one open at a time, and the detail
   printed into a live region so a screen reader is told what changed rather
   than being left to discover it. The strength figure stays visible on every
   row whether it is open or not, because that number is the actual answer to
   "how big is the department" and hiding it behind an interaction would be
   hiding the content behind the interface.
   -------------------------------------------------------------------------- */

export function AboutFaculty() {
  const [open, setOpen] = useState(0);

  const scope = useGsapScope<HTMLElement>((_, el) => {
    rise(el.querySelectorAll<HTMLElement>('.dept'), { trigger: el, y: 18, stagger: 0.05 });
  }, []);

  const current = FACULTY_DEPARTMENTS[open];

  return (
    <section ref={scope} className="section faculty" id="faculty">
      <div className="wrap">
        <SectionHead
          sticker="The staff room"
          stickerTilt={2}
          title={
            <>
              A hundred and one teachers, and we hire <Mark kind="underline">slowly.</Mark>
            </>
          }
          lead="Six departments. Every appointment involves a taught lesson in front of real students before it involves an offer."
        />

        <div className="faculty__body">
          <ul className="faculty__list">
            {FACULTY_DEPARTMENTS.map((dept, i) => (
              <li key={dept.id}>
                <button
                  type="button"
                  className={`dept${i === open ? ' is-open' : ''}`}
                  aria-expanded={i === open}
                  aria-controls="faculty-detail"
                  onClick={() => setOpen(i)}
                >
                  <span className="dept__name">{dept.name}</span>
                  <span className="dept__strength meta">{dept.strength}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="faculty__detail" id="faculty-detail" aria-live="polite">
            <Figure
              photo={[academicImages[3], academicImages[1], academicImages[2], campusImages[3], academicImages[7], artsImages[0]][open]}
              width={720}
              sizes="(max-width: 900px) 88vw, 38vw"
              shape="frame"
              ratio="landscape"
              key={current.id}
              decorative
            />
            <h3 className="fn-h3 faculty__dept-name">{current.name}</h3>
            <p className="body-text">{current.description}</p>
            <ul className="faculty__leads">
              {current.leads.map((leadName) => (
                <li key={leadName}>{leadName}</li>
              ))}
            </ul>
          </div>
        </div>

        <StatReveal
          items={FACULTY_STATS.map((stat) => ({ value: stat.value, label: stat.label }))}
          layout="grid"
          className="faculty__stats"
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   10 - ALUMNI
   --------------------------------------------------------------------------
   Four people, told as stories rather than as a card grid: a portrait, what
   they do now, and one sentence in their own words. Set alternating left and
   right so the column reads as a correspondence rather than as a directory.
   -------------------------------------------------------------------------- */

export function AboutAlumni() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const items = el.querySelectorAll<HTMLElement>('.alum');
    items.forEach((item, i) => {
      unmask(item.querySelectorAll<HTMLElement>('.fig'), {
        trigger: item,
        from: i % 2 === 0 ? 'left' : 'right',
      });
      rise(item.querySelectorAll<HTMLElement>('[data-lift]'), { trigger: item, stagger: 0.07, y: 22 });
    });
  }, []);

  return (
    <section ref={scope} className="section alumni" id="alumni">
      <div className="wrap">
        <SectionHead
          sticker="Where they went"
          title={
            <>
              A school is judged by who comes <Mark>back.</Mark>
            </>
          }
          lead="Ten thousand alumni in thirty countries, nineteen of whom now teach here, and more than a thousand families sending a second generation."
        />

        <ol className="alumni__list">
          {ALUMNI.map((person, i) => (
            <li className="alum" key={person.id}>
              <Figure
                photo={facultyImages[5 + (i % 4)]}
                width={480}
                sizes="(max-width: 800px) 46vw, 22vw"
                shape={i % 2 === 0 ? 'blob' : 'arch'}
                ratio="portrait"
                hover
                className="alum__fig"
              />
              <div className="alum__text">
                <p className="meta" data-lift>
                  {person.batch}
                </p>
                <blockquote className="ed-h3 alum__quote" data-lift>
                  &ldquo;{person.quote}&rdquo;
                </blockquote>
                <p className="alum__who" data-lift>
                  <b>{person.name}</b>
                  <span>{person.now}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>

        <StatReveal
          items={ALUMNI_REACH.map((reach) => ({ value: reach.value, label: reach.label }))}
          layout="grid"
          className="alumni__stats"
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   The ask.
   -------------------------------------------------------------------------- */

/* The quietest of the four, and the widest. One photograph - two children
   walking in - run off the edge of the page, so it reads as a view rather
   than a picture; one print laid over its corner; and the pen does only one
   thing, which is circle the two of them. The invitation is to walk the same
   route, so the spread gives the route the room. */
export function AboutCta() {
  return (
    <InviteSection
      bleed
      className="invite--about"
      eyebrow="Come and look"
      title={
        <>
          The rest of it only makes sense <Script>in person.</Script>
        </>
      }
      lead={`Visits run every Tuesday and Thursday morning during term, and on the first Saturday of each month. Forty-five minutes, walked by a member of the senior team.`}
      actions={[
        { label: 'Book a visit', to: ROUTES.contact },
        { label: 'See what is taught', to: ROUTES.academics },
      ]}
      footnote={`${SCHOOL.locality} · ${SCHOOL.phone}`}
      footIcon="pin"
      collage={
        <Collage
          ratio={1.25}
          smRatio={1.1}
          photos={[
            {
              photo: everydayImages.walk,
              role: 'main',
              shape: 'bleed',
              ratio: 1.5,
              x: 6, y: 8, w: 94, depth: 24,
              sm: { x: 0, y: 4, w: 100 },
              sizes: '(max-width: 959px) 100vw, 56vw',
            },
            {
              photo: everydayImages.friends,
              role: 'print',
              ratio: 1.33,
              x: -6, y: 60, w: 36, rotate: -5, depth: 90, from: 'left',
              sm: { x: 2, y: 60, w: 50, rotate: -4 },
              sizes: '(max-width: 699px) 50vw, (max-width: 959px) 34vw, 20vw',
            },
            {
              photo: everydayImages.classroom,
              role: 'print',
              ratio: 1.33,
              x: 0, y: 0, w: 25, rotate: -4, depth: 120, from: 'top',
              sm: false,
              sizes: '14vw',
            },
          ]}
          marks={[
            { kind: 'brush', tone: 'sky', x: -12, y: 50, w: 50, depth: 16, sm: false },
            { kind: 'ring', x: 23, y: 31, w: 54, rotate: -3, depth: 24, sm: { x: 19, y: 24, w: 58 } },
            { kind: 'sparks', x: 74, y: 24, w: 7, rotate: 14, depth: 40, sm: false },
            { kind: 'arrow-down', tone: 'ink', x: 60, y: 2, w: 5, rotate: 14, depth: 60, sm: false },
          ]}
          notes={[{ text: '45 minutes, on foot', x: 44, y: -3, rotate: -3, depth: 60, sm: false }]}
        />
      }
    />
  );
}
