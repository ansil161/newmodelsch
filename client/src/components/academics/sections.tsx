import {
  ACADEMIC_PROOF,
  ACHIEVEMENTS,
  ADMISSIONS_INTRO,
  ACHIEVEMENT_CATEGORIES,
  CURRICULUM_NOTE,
  CURRICULUM_ROWS,
  FUTURE_SKILLS,
  NEXT_STEPS,
  ROUTES,
  TEACHING_PRINCIPLES,
} from '@/constants';
import {
  academicImages,
  artsImages,
  campusImages,
  everydayImages,
  galleryImages,
  studentImages,
} from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { draw, drift, lines, rise, unmask } from '@/lib/motion';
import {
  AchievementArchive,
  Collage,
  Figure,
  InviteSection,
  Mark,
  Script,
  PageCover,
  SectionHead,
  StatReveal,
  Sticker,
  StickyStory,
} from '@/components/editorial';
import type { ArchiveEntry, StoryPanel } from '@/components/editorial';
import { CurriculumChapters } from './CurriculumChapters';
import type { Chapter } from './CurriculumChapters';
import './academics.css';

/* ==========================================================================
   ACADEMICS - the page a parent reads most carefully
   --------------------------------------------------------------------------
   It is the only page that answers its question stage by stage rather than in
   aggregate, and it is the most interactive page on the site - but every one
   of those interactions is an elaboration, never a gate. Nothing on this page
   is hidden behind a click: a parent can print it, search it, or read it on a
   phone without ever discovering that something was interactive.

   THE SHAPE OF THE ARGUMENT

     01 Method      six practices, each paired with the thing that proves it
     02 Curriculum  thirteen graded years on one axis, drawn to scale
     03 Beyond      the four things the syllabus does not examine
     04 The record  twelve verified entries, as an archive
     05 Proof       the four figures the whole sequence produces

   The anchors are the ones this page has always carried, because another page
   links to two of them and a bookmark outlives a redesign.
   ========================================================================== */

export const AC_CHAPTERS = [
  { id: 'how-we-teach', index: '01', label: 'Method' },
  { id: 'curriculum', index: '02', label: 'Curriculum' },
  { id: 'future-skills', index: '03', label: 'Beyond' },
  { id: 'achievements', index: '04', label: 'The record' },
  { id: 'academic-proof', index: '05', label: 'Proof' },
];

/* --------------------------------------------------------------------------
   The cover
   -------------------------------------------------------------------------- */

export function AcCover() {
  return (
    <PageCover
      sticker="Academics"
      title={
        <>
          What a child <span className="ed-em">learns.</span>
        </>
      }
      question="What will my child actually learn?"
      lead="Thirteen graded years from Nursery to Class 10, the practices behind them, the skills the syllabus omits, and the board results they produce. Stage by stage, with the evidence attached."
      photo={academicImages[0]}
      facts={[
        { value: '13', label: 'Graded years', detail: 'Nursery to Class 10' },
        { value: 'CBSE', label: 'Board', detail: 'From Class 1' },
        { value: '101', label: 'Teaching staff', detail: 'Average 11 years' },
        { value: '100%', label: 'Board pass rate', detail: 'Twelve years running' },
      ]}
    />
  );
}

/* --------------------------------------------------------------------------
   01 - HOW WE TEACH
   --------------------------------------------------------------------------
   Six practices, each held on screen beside the photograph that evidences it.
   Every one carries a `proof` line - a number, a frequency, a cap - because a
   teaching principle without one is a poster.
   -------------------------------------------------------------------------- */

const METHOD: StoryPanel[] = TEACHING_PRINCIPLES.map((principle, i) => ({
  id: `method-${principle.id}`,
  index: String(i + 1).padStart(2, '0'),
  kicker: [
    'Learning by doing',
    'Asking better questions',
    'Catching it early',
    'Hands on the work',
    'Explaining yourself',
    'Somebody accountable',
  ][i],
  title: principle.title,
  body: principle.description,
  proof: principle.proof,
  photo: [
    academicImages[0],
    academicImages[3],
    academicImages[5],
    academicImages[1],
    studentImages[2],
    studentImages[3],
  ][i],
}));

export function AcMethod() {
  return (
    <section className="section method" id="how-we-teach">
      <div className="wrap">
        <SectionHead
          sticker="01 · Method"
          title={
            <>
              Six practices, and each one has a number <Mark>attached to it.</Mark>
            </>
          }
          lead="Anything below that could have been written by any school is followed by the specific thing this one does about it."
          className="method__head"
        />

        <StickyStory panels={METHOD} media="right" shape="frame" />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   02 - THE CURRICULUM, AS A SCHOOL ANNUAL
   --------------------------------------------------------------------------
   Four chapters of a printed publication. Each one is a different paste-up:
   a different lead photograph, a different number of fragments behind it, a
   different rhythm, and a different note in the margin.

   THE NUMBERS BELOW ARE THE ART DIRECTION.

   `x`, `y` and `w` are percentages of the plate; `rotate` is the angle the
   print was pasted down at; `depth` is how far it drifts on scroll. Frames are
   listed back to front. Moving a photograph is moving a number here, not
   editing a stylesheet - which is the point of holding a composition as data.

   Three rules the four compositions keep between them:
     - exactly one `lead`, in colour, and it is the largest thing on the plate
     - everything behind it is photocopied to grey, so the eye never has two
       colour photographs competing
     - no two chapters put the lead in the same place
   -------------------------------------------------------------------------- */

const CHAPTERS: Chapter[] = [
  {
    /* 01 - open on a face, high and left, with the room behind it. The calmest
       plate of the four: three frames, generous air bottom-right. */
    id: 'pre-primary',
    index: '01',
    band: 'Pre-Primary',
    classes: 'Nursery - UKG',
    ages: 'Ages 3-6',
    focus: 'Wanting to come back tomorrow.',
    note: 'The first three years are barely a syllabus. They are about what a school day feels like: being part of a group, finishing a thing you started, and learning that a question is rewarded rather than tolerated. A child who separates happily at the gate and talks about their day at home has had the year we intended.',
    subjects: CURRICULUM_ROWS[0].subjects,
    assessment: CURRICULUM_ROWS[0].assessment,
    frames: [
      { photo: campusImages[0], role: 'behind', x: 40, y: 3, w: 52, rotate: 2.4, tone: 'mono', depth: 96 },
      { photo: studentImages[1], role: 'scrap', x: 58, y: 58, w: 30, rotate: -5, tone: 'mono', depth: 66, torn: true },
      {
        photo: studentImages[0],
        role: 'lead',
        x: 4,
        y: 16,
        w: 56,
        rotate: -1.6,
        tone: 'colour',
        depth: 24,
        tape: [
          { at: 'tl', rotate: -8 },
          { at: 'br', rotate: -5 },
        ],
      },
    ],
    annotation: { text: 'A strong start.', x: 2, y: 1, rotate: -3.4, arrow: 'down' },
  },

  {
    /* 02 - the lead drops right and turns landscape; a tall sliver is cropped
       by the left edge of the plate so the composition runs off the page. */
    id: 'primary',
    index: '02',
    band: 'Primary',
    classes: 'Classes 1-5',
    ages: 'Ages 6-11',
    focus: 'The years that decide the ones after them.',
    note: 'Reading, writing and number are taught slowly and checked constantly, because a gap opened here is expensive to close later. Subjects separate out and get specialist teachers from Class 3, and children start producing work over weeks rather than over lessons.',
    subjects: CURRICULUM_ROWS[1].subjects,
    assessment: CURRICULUM_ROWS[1].assessment,
    frames: [
      { photo: campusImages[3], role: 'behind', x: 26, y: 2, w: 56, rotate: -2.2, tone: 'mono', depth: 104 },
      { photo: academicImages[3], role: 'scrap', x: -6, y: 40, w: 26, rotate: -6.5, tone: 'mono', depth: 74 },
      { photo: galleryImages[6], role: 'scrap', x: 74, y: 62, w: 26, rotate: 4.5, tone: 'mono', depth: 58, torn: true },
      {
        photo: studentImages[2],
        role: 'lead',
        x: 20,
        y: 26,
        w: 58,
        rotate: 1.4,
        tone: 'colour',
        depth: 22,
        tape: [{ at: 't', rotate: 4 }],
      },
    ],
    annotation: { text: 'Learning by doing.', x: 20, y: 84, rotate: 2.2, arrow: 'right' },
  },

  {
    /* 03 - the busiest plate, because these are the widest years. Five frames,
       the lead smaller than in the other three, fragments at three scales. */
    id: 'middle',
    index: '03',
    band: 'Middle School',
    classes: 'Classes 6-8',
    ages: 'Ages 11-14',
    focus: 'The widest years.',
    note: 'Laboratories, the robotics floor, second languages and the stage all open at once, and a student finds out what they are actually drawn to - with evidence for it. Practical work is examined rather than optional, and concepts are met physically before they are met on a page.',
    subjects: CURRICULUM_ROWS[2].subjects,
    assessment: CURRICULUM_ROWS[2].assessment,
    frames: [
      { photo: academicImages[1], role: 'behind', x: 2, y: 0, w: 50, rotate: -3, tone: 'mono', depth: 110 },
      { photo: campusImages[2], role: 'behind', x: 54, y: 30, w: 46, rotate: 2.6, tone: 'mono', depth: 88 },
      { photo: academicImages[7], role: 'scrap', x: 68, y: 2, w: 22, rotate: 6, tone: 'mono', depth: 70, torn: true },
      { photo: academicImages[4], role: 'scrap', x: 0, y: 70, w: 24, rotate: -4.5, tone: 'mono', depth: 54 },
      {
        photo: studentImages[3],
        role: 'lead',
        x: 22,
        y: 34,
        w: 50,
        rotate: -0.8,
        tone: 'colour',
        depth: 20,
        tape: [
          { at: 'tr', rotate: 7 },
          { at: 'bl', rotate: -9 },
        ],
      },
    ],
    annotation: { text: 'Curious minds.', x: 62, y: 82, rotate: -4.2, arrow: 'left' },
  },

  {
    /* 04 - quiet again, and the largest lead of the four. One photocopy behind
       it and one scrap: the chapter is about depth, so the plate is. */
    id: 'secondary',
    index: '04',
    band: 'Secondary',
    classes: 'Classes 9-10',
    ages: 'Ages 14-16',
    focus: 'Depth first, exam technique second.',
    note: 'Board years taught as two years rather than one long revision. Analytical writing, examined practicals, and an honest conversation about what comes after Class 10 - all of it prepared inside school hours, with no coaching centre in the arrangement.',
    subjects: CURRICULUM_ROWS[3].subjects,
    assessment: CURRICULUM_ROWS[3].assessment,
    frames: [
      { photo: academicImages[5], role: 'behind', x: 34, y: 0, w: 58, rotate: 2, tone: 'mono', depth: 92 },
      { photo: studentImages[5], role: 'scrap', x: 2, y: 66, w: 28, rotate: -5.5, tone: 'mono', depth: 60, torn: true },
      {
        photo: academicImages[0],
        role: 'lead',
        x: 8,
        y: 14,
        w: 62,
        rotate: -1.2,
        tone: 'colour',
        depth: 18,
        tape: [
          { at: 'tr', rotate: 6 },
          { at: 'bl', rotate: -7 },
        ],
      },
    ],
    annotation: { text: 'Small steps. Bigger futures.', x: 68, y: 52, rotate: -2.2, arrow: 'left' },
  },
];

export function AcCurriculum() {
  return <CurriculumChapters id="curriculum" chapters={CHAPTERS} colophon={CURRICULUM_NOTE} />;
}

/* --------------------------------------------------------------------------
   02b - AFTER CLASS 10
   --------------------------------------------------------------------------
   The school ends at Class 10, so the last thing it owes a family is a clear
   view of what comes next. Three streams, printed rather than counselled at.
   -------------------------------------------------------------------------- */

export function AcNext() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    rise(el.querySelectorAll<HTMLElement>('.next__row'), { trigger: el, y: 20, stagger: 0.08 });
  }, []);

  return (
    <section ref={scope} className="section section--sand next" id="after-ten">
      <div className="wrap next__inner">
        <SectionHead
          sticker="And then?"
          title={
            <>
              We stop at Class 10. We do not stop{' '}
              <Mark kind="underline">advising there.</Mark>
            </>
          }
          lead="The three streams a leaver chooses between, and what each one opens up. This is the substance of the Class 9 and 10 counselling conversation, written down."
          className="next__head"
        />

        <ol className="next__rows">
          {NEXT_STEPS.map((step, i) => (
            <li className="next__row" key={step.id}>
              <span className="next__num meta">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="fn-h3 next__name">{step.name}</h3>
              <p className="next__subjects">{step.subjects}</p>
              <p className="next__paths">{step.pathways}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   03 - BEYOND THE SYLLABUS
   --------------------------------------------------------------------------
   The four things the board does not examine, set as large as the things it
   does. That equivalence in scale is the argument the section is making, so
   the type size here is not decoration.
   -------------------------------------------------------------------------- */

export function AcBeyond() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const items = el.querySelectorAll<HTMLElement>('.skill');
    items.forEach((item) => {
      const title = item.querySelector<HTMLElement>('.skill__title');
      if (title) lines(title, { trigger: item });
      rise(item.querySelectorAll<HTMLElement>('[data-lift]'), { trigger: item, delay: 0.2, y: 20 });
      unmask(item.querySelectorAll<HTMLElement>('.fig'), { trigger: item, from: 'bottom' });
      drift(item.querySelector('img'), 50, { trigger: item });
    });
    draw(el, { trigger: el, delay: 0.4 });
  }, []);

  return (
    <section ref={scope} className="section beyond" id="future-skills">
      <div className="wrap">
        <SectionHead
          sticker="03 · Beyond the syllabus"
          title={
            <>
              The four things no board <Mark>examines.</Mark>
            </>
          }
          lead="Each of these has timetabled hours and a named teacher. They are not what is left over after the syllabus."
          className="beyond__head"
        />

        <ol className="beyond__list">
          {FUTURE_SKILLS.map((skill, i) => (
            <li className="skill" key={skill.id}>
              <span className="skill__index" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>

              <div className="skill__text">
                <h3 className="skill__title ed-h1">{skill.title}</h3>
                <p className="body-text" data-lift>
                  {skill.description}
                </p>
              </div>

              <Figure
                photo={[studentImages[2], academicImages[7], artsImages[1], academicImages[2]][i]}
                width={480}
                sizes="(max-width: 900px) 60vw, 26vw"
                shape={i % 2 === 0 ? 'blob' : 'arch'}
                ratio="landscape"
                hover
                className="skill__fig"
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   04 - THE RECORD
   -------------------------------------------------------------------------- */

const RECORD: ArchiveEntry[] = ACHIEVEMENTS.map((achievement, i) => ({
  id: achievement.id,
  year: achievement.year,
  category: achievement.category,
  title: achievement.title,
  detail: achievement.detail,
  photo: academicImages[i % academicImages.length],
}));

export function AcRecord() {
  return (
    <AchievementArchive
      id="achievements"
      entries={RECORD}
      categories={ACHIEVEMENT_CATEGORIES}
      className="record"
    >
      <SectionHead
        sticker="04 · The record"
        stickerTilt={2}
        title={
          <>
            The <Mark kind="ring">record.</Mark>
          </>
        }
        lead="Four years, four categories, twelve entries, and every one of them is something a parent could ask to see the paperwork for."
      />
    </AchievementArchive>
  );
}

/* --------------------------------------------------------------------------
   05 - ACADEMIC PROOF
   -------------------------------------------------------------------------- */

export function AcProof() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const head = el.querySelector<HTMLElement>('.proof__title');
    if (head) lines(head, { trigger: el });
    draw(el, { trigger: el, delay: 0.5 });
  }, []);

  return (
    <section ref={scope} className="section section--navy proof" id="academic-proof">
      <div className="wrap">
        <div className="proof__head">
          <Sticker tone="paper" tilt={-2}>
            05 · Proof
          </Sticker>
          <h2 className="proof__title ed-h1">
            What the whole sequence <Mark kind="underline">produces.</Mark>
          </h2>
        </div>

        <StatReveal
          items={ACADEMIC_PROOF.map((point) => ({
            value: point.value,
            label: point.label,
            detail: point.detail,
          }))}
          layout="grid"
          large
          className="proof__stats"
        />

        <p className="proof__foot meta">
          Board preparation happens inside school hours. No family is expected to buy an evening
          class to reach these figures.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   The ask.
   -------------------------------------------------------------------------- */

/* Mirrored: the collage on the left, the copy on the right, and the year set
   as the display line - on an admissions spread, the session is the news.
   The yellow path leaves the lesson and runs across towards the copy, the
   one line on the spread that ties the photographs to the headline. */
export function AcCta() {
  return (
    <InviteSection
      side="right"
      className="invite--academics"
      year={{ label: 'Admissions', figure: ADMISSIONS_INTRO.session.replace('-', '–') }}
      title={
        <>
          Come and watch a lesson you were not <Script>expected at.</Script>
        </>
      }
      lead="Campus visits run while school is in session. Nothing is staged, and the classrooms are full."
      actions={[
        { label: 'Start an enquiry', to: `${ROUTES.admissions}#enquiry` },
        { label: 'See student life', to: ROUTES.studentLife },
      ]}
      footnote="Curriculum detail on this page is confirmed by the school and republished before each academic session."
      footIcon="document"
      collage={
        <Collage
          ratio={1.2}
          smRatio={1}
          photos={[
            {
              photo: everydayImages.lesson,
              role: 'main',
              shape: 'soft',
              ratio: 1.5,
              x: 6, y: 18, w: 80, depth: 30,
              sm: { x: 0, y: 20, w: 100 },
              sizes: '(max-width: 959px) 92vw, 44vw',
            },
            {
              photo: everydayImages.attentive,
              role: 'print',
              ratio: 1.5,
              x: 56, y: 0, w: 40, rotate: 4, depth: 90, from: 'top',
              sm: { x: 50, y: 0, w: 48, rotate: 4 },
              sizes: '(max-width: 699px) 48vw, (max-width: 959px) 38vw, 22vw',
            },
            {
              photo: everydayImages.deskBooks,
              role: 'print',
              ratio: 1.1,
              x: 0, y: 61, w: 34, rotate: -5, depth: 110, from: 'left',
              sm: { x: 3, y: 62, w: 40, rotate: -4 },
              sizes: '(max-width: 699px) 40vw, (max-width: 959px) 32vw, 18vw',
            },
          ]}
          marks={[
            { kind: 'brush', tone: 'sky', x: 4, y: 8, w: 86, depth: 16, sm: { x: 4, y: 6, w: 92 } },
            { kind: 'path', x: 50, y: 70, w: 64, depth: -20, sm: false },
            { kind: 'sparks', x: 93, y: 30, w: 8, rotate: 12, depth: 60, sm: { x: 40, y: 0, w: 12 } },
            { kind: 'star', tone: 'sky', x: 1, y: 8, w: 5.5, depth: 50, sm: false },
            { kind: 'arrow', tone: 'ink', flip: true, x: 30, y: 83, w: 9, rotate: -10, depth: 70, sm: false },
          ]}
          notes={[{ text: 'a real lesson', x: 40, y: 86, rotate: -4, depth: 70, sm: false }]}
        />
      }
    />
  );
}
