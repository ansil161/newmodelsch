import { useRef, useState } from 'react';
import { gsap } from '@/lib/gsap';
import type { EnquiryData, EnquiryErrors } from '@/types';
import { ENQUIRY_SUBJECTS, SCHOOL } from '@/constants';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import { Icon } from '@/components/common/Icon';
import { Mark, Sticker } from '@/components/editorial';
import { validateEnquiry } from '@/utils';
import { cx } from '@/utils';
import './enquiry-short.css';

const EMPTY: EnquiryData = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

/**
 * Contact 04 — Quick Enquiry.
 *
 * Five fields, one of them optional. The admissions page owns the long
 * multi-step form; this is for the parent who has a single question and does
 * not want to start an application to ask it.
 *
 * Nothing is wired to a backend yet, so the confirmation is honest about what
 * happened and gives the phone number as the route that definitely works.
 *
 * Dark ground, glass card. The two forms on this site should not look alike:
 * the admissions form is a process on a white card, and this one is a note
 * being passed — shorter, quieter, and over in one screen.
 */
export function EnquiryShort() {
  const [data, setData] = useState<EnquiryData>(EMPTY);
  const [errors, setErrors] = useState<EnquiryErrors>({});
  const [sent, setSent] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const reduceMotion = useReducedMotion();

  const scopeRef = useGsapScope<HTMLElement>(
    (_ctx, scope) => {
      if (reduceMotion) return;

      gsap.from(scope.querySelectorAll('.qe__field'), {
        y: 24,
        opacity: 0,
        duration: 0.7,
        stagger: 0.06,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.qe__form', start: 'top 86%', once: true },
      });
    },
    [reduceMotion],
  );

  const set = (key: keyof EnquiryData) => (value: string) => {
    setData((current) => ({ ...current, [key]: value }));
    // Clear a field's error the moment it is touched, not on the next submit.
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateEnquiry(data);
    setErrors(found);

    if (Object.keys(found).length) {
      const firstKey = Object.keys(found)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${firstKey}"]`)?.focus();
      return;
    }

    setSent(true);
    setData(EMPTY);
  };

  return (
    <section
      id="enquiry"
      ref={scopeRef}
      className="section qe section--navy"
    >
      <div className="wrap qe__inner">
        <header className="qe__head">
          <Sticker tone="paper" tilt={-2}>
            Write to us
          </Sticker>

          <h2 className="ed-h2 qe__title">
            Ask one question. Get one <Mark kind="underline">answer.</Mark>
          </h2>

          <p className="qe__lead">
            Five fields, one of them optional. Answered by a person in the admissions office
            within one working day - or call and skip the form entirely.
          </p>

          <div className="qe__direct">
            <a className="qe__phone" href={SCHOOL.phoneHref}>
              <span className="qe__phone-icon" aria-hidden="true">
                <Icon name="phone" size={16} />
              </span>
              <span className="qe__phone-text">
                <span className="qe__phone-label">Call the office</span>
                <span className="qe__phone-value">{SCHOOL.phone}</span>
              </span>
            </a>

            <ul className="qe__assurances">
              <li>
                <Icon name="lock" size={13} />
                Used only to answer this enquiry
              </li>
              <li>
                <Icon name="clock" size={13} />
                One working day, Monday to Saturday
              </li>
            </ul>
          </div>
        </header>

        <div className="qe__panel">
          {sent ? (
            <div className="qe__done" role="status">
              <span className="qe__done-mark" aria-hidden="true">
                <Icon name="check" size={28} />
              </span>
              <h3 className="qe__done-title">Thank you - that is with us.</h3>
              <p className="qe__done-copy">
                No enquiry inbox is connected to this form yet, so nothing has been emailed. If
                your question is time-sensitive, call {SCHOOL.phone} or write to {SCHOOL.email}.
              </p>
              <button type="button" className="btn btn-secondary" onClick={() => setSent(false)}>
                <span className="btn__label">
                  Send another
                  <Icon name="arrowRight" size={16} />
                </span>
              </button>
            </div>
          ) : (
            <form className="qe__form" ref={formRef} onSubmit={submit} noValidate>
              <div className="qe__field">
                <label htmlFor="qe-name">Your name</label>
                <input
                  id="qe-name"
                  name="name"
                  type="text"
                  value={data.name}
                  onChange={(e) => set('name')(e.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'qe-name-error' : undefined}
                  className={cx(errors.name && 'has-error')}
                />
                {errors.name ? (
                  <span className="qe__error" id="qe-name-error">
                    {errors.name}
                  </span>
                ) : null}
              </div>

              <div className="qe__field">
                <label htmlFor="qe-email">Email address</label>
                <input
                  id="qe-email"
                  name="email"
                  type="email"
                  value={data.email}
                  onChange={(e) => set('email')(e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'qe-email-error' : undefined}
                  className={cx(errors.email && 'has-error')}
                />
                {errors.email ? (
                  <span className="qe__error" id="qe-email-error">
                    {errors.email}
                  </span>
                ) : null}
              </div>

              <div className="qe__field">
                <label htmlFor="qe-phone">
                  Phone <span className="qe__optional">optional</span>
                </label>
                <input
                  id="qe-phone"
                  name="phone"
                  type="tel"
                  value={data.phone}
                  onChange={(e) => set('phone')(e.target.value)}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? 'qe-phone-error' : undefined}
                  className={cx(errors.phone && 'has-error')}
                />
                {errors.phone ? (
                  <span className="qe__error" id="qe-phone-error">
                    {errors.phone}
                  </span>
                ) : null}
              </div>

              <div className="qe__field qe__field--select">
                <label htmlFor="qe-subject">What is this about?</label>
                <select
                  id="qe-subject"
                  name="subject"
                  value={data.subject}
                  onChange={(e) => set('subject')(e.target.value)}
                  aria-invalid={Boolean(errors.subject)}
                  aria-describedby={errors.subject ? 'qe-subject-error' : undefined}
                  className={cx(errors.subject && 'has-error')}
                >
                  <option value="">Choose one…</option>
                  {ENQUIRY_SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
                <span className="qe__select-mark" aria-hidden="true">
                  <Icon name="chevronDown" size={15} />
                </span>
                {errors.subject ? (
                  <span className="qe__error" id="qe-subject-error">
                    {errors.subject}
                  </span>
                ) : null}
              </div>

              <div className="qe__field qe__field--wide">
                <label htmlFor="qe-message">Your question</label>
                <textarea
                  id="qe-message"
                  name="message"
                  rows={5}
                  value={data.message}
                  onChange={(e) => set('message')(e.target.value)}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? 'qe-message-error' : undefined}
                  className={cx(errors.message && 'has-error')}
                />
                {errors.message ? (
                  <span className="qe__error" id="qe-message-error">
                    {errors.message}
                  </span>
                ) : null}
              </div>

              <div className="qe__actions">
                <button type="submit" className="btn btn-sun">
                  <span className="btn__label">
                    Send enquiry
                    <Icon name="arrowRight" size={16} />
                  </span>
                </button>
                <p className="qe__privacy">
                  We use your details only to answer this enquiry. Nothing is shared with anyone
                  outside the school.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
