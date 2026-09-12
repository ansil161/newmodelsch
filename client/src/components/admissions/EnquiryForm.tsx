import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap';
import { ADMISSION_STEPS, GRADES, SCHOOL } from '@/constants';
import type { AdmissionData, AdmissionErrors } from '@/types';
import { env } from '@/config/env';
import { storage } from '@/lib/storage';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import { Icon } from '@/components/common/Icon';
import { Mark, Sticker } from '@/components/editorial';
import { cx, pad2, validateStep } from '@/utils';
import './enquiry.css';

const DRAFT_KEY = 'nmhs.admission.draft';

const EMPTY: AdmissionData = {
  grade: '',
  parentName: '',
  parentPhone: '',
  parentEmail: '',
  studentName: '',
  studentDob: '',
  currentSchool: '',
  visitDate: '',
};

type Status = 'idle' | 'sending' | 'sent' | 'error';

interface FieldProps {
  id: keyof AdmissionData;
  label: string;
  value: string;
  error?: string;
  type?: string;
  optional?: boolean;
  /** Lower bound for date inputs. */
  min?: string;
  onChange: (value: string) => void;
}

/** Floating-label field. The label lifts on focus or once the input has a value. */
function Field({ id, label, value, error, type = 'text', optional, min, onChange }: FieldProps) {
  return (
    <div className={cx('field', value && 'is-filled', error && 'has-error')}>
      <input
        id={id}
        name={id}
        type={type}
        className="field__input"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder=" "
        autoComplete="off"
      />
      <label className="field__label" htmlFor={id}>
        {label}
        {optional && <span className="field__optional"> - optional</span>}
      </label>
      {error && (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Section 12 — the admissions experience, and the Admissions page's final
 * enquiry form.
 *
 * Four steps, validated one at a time so a parent is never shown eight errors
 * at once. The draft is kept in localStorage: an enquiry interrupted by a
 * phone call is still there when they come back — and the form says so, in
 * the footer, because a saved draft nobody knows about is worth nothing.
 *
 * The whole form sits on one raised card against a quiet ground. It is the
 * one place on the site being asked to convert, so everything around it is
 * deliberately empty.
 */
export function EnquiryForm() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<AdmissionData>(() => storage.get(DRAFT_KEY, EMPTY));
  const [errors, setErrors] = useState<AdmissionErrors>({});
  const [status, setStatus] = useState<Status>('idle');

  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    storage.set(DRAFT_KEY, data);
  }, [data]);

  // Step transition — the outgoing panel is replaced, not cross-faded.
  useIsomorphicLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || reduceMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        panel.querySelectorAll('[data-step-item]'),
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.06, ease: 'power3.out' },
      );
    }, panel);

    return () => ctx.revert();
  }, [step, status, reduceMotion]);

  const set = (key: keyof AdmissionData) => (value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const next = () => {
    const found = validateStep(step, data);
    setErrors(found);
    if (Object.keys(found).length) return;
    setStep((s) => Math.min(s + 1, ADMISSION_STEPS.length - 1));
  };

  const back = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async () => {
    const found = validateStep(3, data);
    setErrors(found);
    if (Object.keys(found).length) return;

    setStatus('sending');
    try {
      // Wired to the enquiries endpoint when one is configured; until then the
      // submission resolves locally so the flow is testable end to end.
      if (env.apiBaseUrl) {
        const response = await fetch(`${env.apiBaseUrl}/admissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
      }
      setStatus('sent');
      storage.set(DRAFT_KEY, EMPTY);
    } catch {
      setStatus('error');
    }
  };

  const progress = status === 'sent' ? 1 : (step + 1) / ADMISSION_STEPS.length;

  return (
    <section className="section admissions">
      <div className="admissions__wash" aria-hidden="true" />

      <div className="wrap admissions__grid">
        <aside className="admissions__aside">

          <Sticker tone="sun" tilt={-2.2}>
            The enquiry
          </Sticker>

          <h2 className="ed-h2 admissions__title">
            Four questions. Then we <Mark kind="underline">talk.</Mark>
          </h2>

          <p className="admissions__lead">
            No forms to download, no queue at the gate. Tell us about your child and we will call
            within one working day.
          </p>

          <ul className="admissions__assurances">
            <li>
              <span className="admissions__assure-icon" aria-hidden="true">
                <Icon name="lock" size={15} />
              </span>
              <span>Secure &amp; confidential</span>
            </li>
            <li>
              <span className="admissions__assure-icon" aria-hidden="true">
                <Icon name="check" size={15} />
              </span>
              <span>CBSE affiliated</span>
            </li>
            <li>
              <span className="admissions__assure-icon" aria-hidden="true">
                <Icon name="check" size={15} />
              </span>
              <span>ISO 9001 certified</span>
            </li>
          </ul>

          <a className="admissions__call" href={SCHOOL.phoneHref}>
            <span className="admissions__call-icon" aria-hidden="true">
              <Icon name="phone" size={17} />
            </span>
            <span className="admissions__call-text">
              <span className="admissions__call-label">Rather just call?</span>
              <span className="admissions__call-value">{SCHOOL.phone}</span>
            </span>
            <Icon name="arrowUpRight" size={16} />
          </a>
        </aside>

        <div className="admissions__form">
          <div className="admissions__progress">
            <ol className="admissions__steps">
              {ADMISSION_STEPS.map((label, i) => (
                <li
                  key={label}
                  className={cx(
                    'admissions__step',
                    i === step && status !== 'sent' && 'is-active',
                    (i < step || status === 'sent') && 'is-done',
                  )}
                >
                  <span className="admissions__step-index">
                    {i < step || status === 'sent' ? <Icon name="check" size={12} /> : pad2(i + 1)}
                  </span>
                  <span className="admissions__step-label">{label}</span>
                </li>
              ))}
            </ol>

            <div className="admissions__bar" aria-hidden="true">
              <span
                className="admissions__bar-fill"
                style={{ transform: `scaleX(${progress})` }}
              />
            </div>
          </div>

          <div className="admissions__panel" ref={panelRef}>
            {status === 'sent' ? (
              <div className="admissions__done">
                <span className="admissions__done-mark" data-step-item>
                  <Icon name="check" size={30} />
                </span>
                <h3 className="admissions__done-title" data-step-item>
                  Thank you - we have your enquiry.
                </h3>
                <p className="admissions__done-copy" data-step-item>
                  A member of our admissions team will call {data.parentName || 'you'} on{' '}
                  {data.parentPhone} within one working day to confirm your visit on{' '}
                  {data.visitDate || 'the date you chose'}.
                </p>
              </div>
            ) : (
              <>
                {step === 0 && (
                  <fieldset className="admissions__fieldset">
                    <legend className="admissions__legend" data-step-item>
                      Which class are you applying for?
                    </legend>
                    <div className="admissions__grades" data-step-item>
                      {GRADES.map((grade) => (
                        <button
                          key={grade}
                          type="button"
                          className={cx(
                            'admissions__grade',
                            data.grade === grade && 'is-active',
                          )}
                          aria-pressed={data.grade === grade}
                          onClick={() => set('grade')(grade)}
                        >
                          {grade}
                        </button>
                      ))}
                    </div>
                    {errors.grade && (
                      <p className="admissions__error" role="alert">
                        {errors.grade}
                      </p>
                    )}
                  </fieldset>
                )}

                {step === 1 && (
                  <fieldset className="admissions__fieldset">
                    <legend className="admissions__legend" data-step-item>
                      How do we reach you?
                    </legend>
                    <div data-step-item>
                      <Field
                        id="parentName"
                        label="Parent or guardian name"
                        value={data.parentName}
                        error={errors.parentName}
                        onChange={set('parentName')}
                      />
                    </div>
                    <div data-step-item>
                      <Field
                        id="parentPhone"
                        label="Mobile number"
                        type="tel"
                        value={data.parentPhone}
                        error={errors.parentPhone}
                        onChange={set('parentPhone')}
                      />
                    </div>
                    <div data-step-item>
                      <Field
                        id="parentEmail"
                        label="Email address"
                        type="email"
                        value={data.parentEmail}
                        error={errors.parentEmail}
                        onChange={set('parentEmail')}
                      />
                    </div>
                  </fieldset>
                )}

                {step === 2 && (
                  <fieldset className="admissions__fieldset">
                    <legend className="admissions__legend" data-step-item>
                      Tell us about your child.
                    </legend>
                    <div data-step-item>
                      <Field
                        id="studentName"
                        label="Student’s full name"
                        value={data.studentName}
                        error={errors.studentName}
                        onChange={set('studentName')}
                      />
                    </div>
                    <div data-step-item>
                      <Field
                        id="studentDob"
                        label="Date of birth"
                        type="date"
                        value={data.studentDob}
                        error={errors.studentDob}
                        onChange={set('studentDob')}
                      />
                    </div>
                    <div data-step-item>
                      <Field
                        id="currentSchool"
                        label="Current school"
                        value={data.currentSchool}
                        onChange={set('currentSchool')}
                        optional
                      />
                    </div>
                  </fieldset>
                )}

                {step === 3 && (
                  <fieldset className="admissions__fieldset">
                    <legend className="admissions__legend" data-step-item>
                      When would you like to visit?
                    </legend>
                    <p className="admissions__note" data-step-item>
                      Campus tours run Monday to Saturday, 9am-3pm. Pick a date and we will
                      confirm the time on the call.
                    </p>
                    <div data-step-item>
                      <Field
                        id="visitDate"
                        label="Preferred visit date"
                        type="date"
                        value={data.visitDate}
                        error={errors.visitDate}
                        min={today}
                        onChange={set('visitDate')}
                      />
                    </div>
                    <dl className="admissions__summary" data-step-item>
                      <div>
                        <dt>Class</dt>
                        <dd>{data.grade || '-'}</dd>
                      </div>
                      <div>
                        <dt>Student</dt>
                        <dd>{data.studentName || '-'}</dd>
                      </div>
                      <div>
                        <dt>Contact</dt>
                        <dd>{data.parentPhone || '-'}</dd>
                      </div>
                    </dl>
                  </fieldset>
                )}
              </>
            )}
          </div>

          {/* Errors and status are announced without stealing focus. */}
          <p className="sr-only" aria-live="polite">
            {status === 'sending' && 'Sending your enquiry.'}
            {status === 'error' && 'Something went wrong. Please try again.'}
            {status === 'sent' && 'Enquiry received.'}
          </p>

          {status !== 'sent' && (
            <div className="admissions__actions">
              {step > 0 && (
                <button type="button" className="link admissions__back" onClick={back}>
                  <Icon name="arrowLeft" size={16} />
                  Back
                </button>
              )}

              {step < ADMISSION_STEPS.length - 1 ? (
                <button type="button" className="btn btn-primary" onClick={next}>
                  <span className="btn__label">
                    Continue
                    <Icon name="arrowRight" size={16} />
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sun"
                  onClick={submit}
                  disabled={status === 'sending'}
                >
                  <span className="btn__label">
                    {status === 'sending' ? 'Sending...' : 'Submit enquiry'}
                    <Icon name="arrowRight" size={16} />
                  </span>
                </button>
              )}

              {status === 'error' && (
                <p className="admissions__error" role="alert">
                  We could not send that. Please try again, or call {SCHOOL.phone}.
                </p>
              )}
            </div>
          )}

          {status !== 'sent' && (
            <p className="admissions__draft">
              <Icon name="lock" size={13} />
              Your answers are saved on this device as you go, so you can leave and come back.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
