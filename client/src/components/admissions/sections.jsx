import {
  ADMISSIONS_INTRO,
  ADMISSION_FAQS,
  DOCUMENTS,
  KEY_DATES,
  SCHOOL,
  VISIT_CAMPUS,
} from '@/constants';
import { campusImages } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { draw, lines, rise, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import {
  EditorialAccordion,
  Figure,
  Mark,
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

/* THE COVER lives in `AdmissionsCover.jsx`.
   01 - WHO CAN APPLY lives in `WhoCanApply.jsx`.
   02 - THE SIX STEPS lives in `AdmissionJourney.jsx`. */

/* --------------------------------------------------------------------------
   03 - DOCUMENTS & DATES
   --------------------------------------------------------------------------
   Two lists side by side: what to bring, and when things happen. The calendar
   marks which dates have passed, which is open and which is still ahead -
   because a list of dates with no state on it makes a parent do the arithmetic
   themselves.
   -------------------------------------------------------------------------- */

export function AdDocuments() {
  const scope = useGsapScope((_, el) => {
    rise(el.querySelectorAll('.docs__group'), { trigger: el, y: 20, stagger: 0.08 });
    rise(el.querySelectorAll('.date'), {
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
  const scope = useGsapScope((_, el) => {
    const head = el.querySelector('.visit__title');
    if (head) lines(head, { trigger: el });
    draw(el, { trigger: el, delay: 0.5 });
    unmask(el.querySelectorAll('.visit__fig'), { trigger: el, from: 'right' });
    rise(el.querySelectorAll('.visit__body > *'), { trigger: el, stagger: 0.07, delay: 0.2 });
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
