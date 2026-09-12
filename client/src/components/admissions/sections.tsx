import {
  ADMISSIONS_INTRO,
  ADMISSION_FAQS,
  ADMISSION_STAGES,
  DOCUMENTS,
  ELIGIBILITY,
  KEY_DATES,
  SCHOOL,
  VISIT_CAMPUS,
} from '@/constants';
import { admissionImages, campusImages, studentImages } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { draw, grow, lines, rise, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import {
  EditorialAccordion,
  Figure,
  Mark,
  PageCover,
  PhotoBreak,
  SectionHead,
  Sticker,
} from '@/components/editorial';
import './admissions.css';

/* ==========================================================================
   ADMISSIONS - the one conversion journey on the site
   --------------------------------------------------------------------------
   Everything a parent needs to apply is on this page, so nobody has to
   reconstruct the process across four others: status, eligibility, the six
   steps, documents, dates, the questions, a visit, and the form itself.

   CLARITY BEATS ANIMATION HERE, AND THE PAGE IS BUILT THAT WAY.

   This is the one page where a reader is trying to do something rather than
   learn something, so the editorial language is turned down: the compositions
   are simpler, the type is smaller, nothing is behind an interaction, and the
   only real motion is the process spine - which is a progress indicator, not
   a flourish.

   The form is deliberately outside the numbering. It is not the sixth thing
   to read; it is what the five chapters are for, and giving it a number would
   file the destination as another stop on the way.
   ========================================================================== */

export const AD_CHAPTERS = [
  { id: 'admissions-intro', index: '01', label: 'Who can apply' },
  { id: 'process', index: '02', label: 'The six steps' },
  { id: 'documents', index: '03', label: 'Documents & dates' },
  { id: 'faq', index: '04', label: 'Questions' },
  { id: 'visit', index: '05', label: 'Visit the campus' },
];

/* --------------------------------------------------------------------------
   The cover
   -------------------------------------------------------------------------- */

export function AdCover() {
  return (
    <PageCover
      sticker={`Admissions ${ADMISSIONS_INTRO.session} · ${ADMISSIONS_INTRO.status}`}
      title={
        <>
          Your child&rsquo;s next <span className="ed-em">chapter.</span>
        </>
      }
      question="How do we join?"
      lead={ADMISSIONS_INTRO.lead}
      photo={admissionImages[0]}
      facts={ADMISSIONS_INTRO.quickFacts.map((fact) => ({
        value: fact.value,
        label: fact.label,
      }))}
    />
  );
}

/* --------------------------------------------------------------------------
   01 - WHO CAN APPLY
   --------------------------------------------------------------------------
   The eligibility table, as a ruled ledger rather than as five cards. It is a
   table of facts and it should look like one - a parent scanning for their
   child's year needs a column they can run a finger down.
   -------------------------------------------------------------------------- */

export function AdEligibility() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    rise(el.querySelectorAll<HTMLElement>('.elig__row'), { trigger: el, y: 18, stagger: 0.06 });
  }, []);

  return (
    <section ref={scope} className="section elig" id="admissions-intro">
      <div className="wrap">
        <SectionHead
          sticker="01 · Who can apply"
          title={
            <>
              Two main entry points, and we will tell you honestly about{' '}
              <Mark kind="underline">the rest.</Mark>
            </>
          }
          lead="Nursery and Class 9 are where most places are. Everything else depends on vacancies, and your coordinator tells you the position for your class before you apply rather than after."
          className="elig__head"
        />

        <div className="elig__table" role="table" aria-label="Entry classes and eligibility">
          <div className="elig__row elig__row--head" role="row">
            <span role="columnheader">Entry</span>
            <span role="columnheader">Age requirement</span>
            <span role="columnheader">Places</span>
            <span role="columnheader">What is involved</span>
          </div>

          {ELIGIBILITY.map((row) => (
            <div className="elig__row" role="row" key={row.entry}>
              <span className="elig__entry" role="cell">
                {row.entry}
              </span>
              <span className="elig__age" role="cell">
                {row.age}
              </span>
              <span className="elig__seats" role="cell">
                {row.seats}
              </span>
              <span className="elig__note" role="cell">
                {row.note}
              </span>
            </div>
          ))}
        </div>

        <p className="elig__foot">
          <Icon name="clock" size={15} />
          {ADMISSIONS_INTRO.statusDetail}
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   02 - THE SIX STEPS
   --------------------------------------------------------------------------
   A connected vertical process. One spine runs the length of the section and
   is drawn by the reader's own scroll; each step is a node on it, carrying who
   acts and how long it takes.

   WHO ACTS IS THE COLUMN THAT MATTERS.

   Every step says whether it is the family's move or the school's. It is the
   single most common thing a parent does not know during an admissions process
   - whether they are waiting or whether they are late - and it costs one line
   per step to answer.
   -------------------------------------------------------------------------- */

export function AdProcess() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    grow(el.querySelector<HTMLElement>('.proc__spine-fill'), {
      trigger: el.querySelector('.proc__steps'),
      end: 'bottom 65%',
    });

    const steps = el.querySelectorAll<HTMLElement>('.proc__step');
    steps.forEach((step) => {
      rise(step.querySelectorAll<HTMLElement>('[data-lift]'), {
        trigger: step,
        start: 'top 80%',
        y: 20,
        stagger: 0.06,
      });
    });
  }, []);

  return (
    <section ref={scope} className="section section--navy proc" id="process">
      <div className="wrap">
        <div className="proc__head">
          <Sticker tone="paper" tilt={-2}>
            02 · The six steps
          </Sticker>
          <h2 className="ed-h1 proc__title">
            Six steps, about six weeks, and no step happens{' '}
            <Mark kind="underline">off this page.</Mark>
          </h2>
        </div>

        <ol className="proc__steps">
          {/* The spine. One rule with a fill the reader's scroll extends. */}
          <div className="proc__spine" aria-hidden="true">
            <span className="proc__spine-fill" />
          </div>

          {ADMISSION_STAGES.map((stage) => (
            <li className="proc__step" key={stage.id}>
              <span className="proc__node" aria-hidden="true">
                {stage.step}
              </span>

              <div className="proc__text">
                <h3 className="fn-h3 proc__step-title" data-lift>
                  {stage.title}
                </h3>
                <p className="proc__step-body" data-lift>
                  {stage.description}
                </p>
                <p className="proc__step-meta" data-lift>
                  <span className="chip chip--sun">{stage.owner}</span>
                  <span className="meta">{stage.duration}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   03 - DOCUMENTS & DATES
   --------------------------------------------------------------------------
   Two lists side by side: what to bring, and when things happen. The calendar
   marks which dates have passed, which is open and which is still ahead -
   because a list of dates with no state on it makes a parent do the arithmetic
   themselves.
   -------------------------------------------------------------------------- */

export function AdDocuments() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    rise(el.querySelectorAll<HTMLElement>('.docs__group'), { trigger: el, y: 20, stagger: 0.08 });
    rise(el.querySelectorAll<HTMLElement>('.date'), {
      trigger: el.querySelector('.dates'),
      y: 16,
      stagger: 0.05,
    });
  }, []);

  return (
    <section ref={scope} className="section docs" id="documents">
      <div className="wrap">
        <SectionHead
          sticker="03 · Documents & dates"
          stickerTilt={2}
          title={
            <>
              Everything to bring, and everything that <Mark>happens when.</Mark>
            </>
          }
          className="docs__head"
        />

        <div className="docs__body">
          <div className="docs__lists">
            {DOCUMENTS.map((group) => (
              <div className="docs__group" key={group.id}>
                <h3 className="fn-h4 docs__group-name">{group.group}</h3>
                <ul className="docs__items">
                  {group.items.map((item) => (
                    <li key={item}>
                      <Icon name="check" size={14} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <ol className="dates">
            <h3 className="fn-h4 dates__title">Key dates, {ADMISSIONS_INTRO.session}</h3>
            {KEY_DATES.map((entry) => (
              <li className={`date date--${entry.status}`} key={entry.id}>
                <span className="date__when meta">{entry.date}</span>
                <span className="date__what">
                  <b>{entry.title}</b>
                  <span>{entry.detail}</span>
                </span>
                <span className="date__state">
                  {entry.status === 'closed' ? 'Passed' : entry.status === 'open' ? 'Open now' : 'Ahead'}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   04 - THE QUESTIONS
   -------------------------------------------------------------------------- */

export function AdFaq() {
  return (
    <section className="section section--sand faq" id="faq">
      <div className="wrap faq__inner">
        <SectionHead
          sticker="04 · Questions"
          title={
            <>
              The ones parents actually <Mark kind="ring">ask.</Mark>
            </>
          }
          lead="Answered the way the admissions office would answer them on the phone."
          className="faq__head"
        />

        <EditorialAccordion
          items={ADMISSION_FAQS.map((item) => ({
            id: item.id,
            question: item.question,
            answer: item.answer,
          }))}
          className="faq__list"
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   05 - THE VISIT
   -------------------------------------------------------------------------- */

export function AdVisit() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const head = el.querySelector<HTMLElement>('.visit__title');
    if (head) lines(head, { trigger: el });
    draw(el, { trigger: el, delay: 0.5 });
    unmask(el.querySelectorAll<HTMLElement>('.visit__fig'), { trigger: el, from: 'right' });
    rise(el.querySelectorAll<HTMLElement>('.visit__body > *'), { trigger: el, stagger: 0.07, delay: 0.2 });
  }, []);

  return (
    <section ref={scope} className="section visit" id="visit">
      <div className="wrap visit__inner">
        <div className="visit__body">
          <Sticker tone="sun" tilt={-2}>
            05 · {VISIT_CAMPUS.eyebrow}
          </Sticker>

          <h2 className="visit__title ed-h1">
            A website can only get you <Mark kind="underline">so far.</Mark>
          </h2>

          <p className="lead">{VISIT_CAMPUS.lead}</p>

          <ul className="visit__points">
            {VISIT_CAMPUS.points.map((point) => (
              <li key={point}>
                <Icon name="check" size={15} />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          <ul className="visit__slots">
            {VISIT_CAMPUS.slots.map((slot) => (
              <li className="chip" key={slot}>
                <Icon name="clock" size={13} />
                {slot}
              </li>
            ))}
          </ul>

          <div className="visit__actions">
            <a className="btn btn-primary" href={SCHOOL.phoneHref}>
              <span className="btn__label">
                Call to book
                <Icon name="phone" size={16} />
              </span>
            </a>
            <a className="link" href="#enquiry">
              Or use the form below
              <Icon name="arrowDown" size={15} />
            </a>
          </div>
        </div>

        <Figure
          photo={campusImages[8]}
          width={860}
          sizes="(max-width: 900px) 90vw, 44vw"
          shape="arch"
          ratio="portrait"
          className="visit__fig"
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   The pause between the two densest chapters.
   -------------------------------------------------------------------------- */

export function AdBreak() {
  return (
    <PhotoBreak
      photos={[studentImages[4], admissionImages[2], campusImages[8]]}
      caption="An ordinary Tuesday, mid-morning"
    />
  );
}
