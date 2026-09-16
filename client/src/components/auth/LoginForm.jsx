import { useId, useRef, useState } from 'react';
import { Icon } from '@/components/common/Icon';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { validateLogin } from '@/utils';

/**
 * Everything the form says. The server's own messages are never displayed:
 * a code maps to one of these, and anything unrecognised is the generic one.
 */
const MESSAGES = {
  invalid: 'Invalid email or password.',
  throttled: 'Too many attempts. Please try again later.',
  generic: 'Something went wrong. Please try again.',
  unreachable: 'We could not reach the sign-in service. Check your connection and try again.',
};

function messageFor(error) {
  if (!(error instanceof ApiError)) return MESSAGES.generic;
  if (error.status === 429) return MESSAGES.throttled;
  if (error.code === 'invalid_credentials') return MESSAGES.invalid;
  if (error.code === 'network_error') return MESSAGES.unreachable;
  return MESSAGES.generic;
}

export function LoginForm({ labelledBy }) {
  const { login } = useAuth();
  const uid = useId();
  const emailId = `${uid}-email`;
  const passwordId = `${uid}-password`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // State updates are asynchronous, so a double click could read `submitting`
  // as false twice. The ref is the real guard against a duplicate request.
  const inFlight = useRef(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const clearError = (field) =>
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });

  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;

    const trimmedEmail = email.trim();
    const found = validateLogin({ email: trimmedEmail, password });
    setErrors(found);
    setAlert(null);
    if (found.email) {
      emailRef.current?.focus();
      return;
    }
    if (found.password) {
      passwordRef.current?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      await login({ email: trimmedEmail, password });
      // The provider now reports 'authenticated' and the page redirects.
    } catch (error) {
      if (error instanceof ApiError && error.code === 'invalid' && Object.keys(error.fieldErrors).length) {
        setErrors({ email: error.fieldErrors.email?.[0], password: error.fieldErrors.password?.[0] });
      } else {
        setAlert(messageFor(error));
      }
      if (error instanceof ApiError && error.code === 'invalid_credentials') {
        setPassword('');
        passwordRef.current?.focus();
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form id="login-form" className="auth-form" onSubmit={submit} noValidate aria-labelledby={labelledBy}>
      <div className="auth-form__field">
        <label className="auth-form__label" htmlFor={emailId}>
          Email address
        </label>
        <div className="auth-form__control">
          <span className="auth-form__icon" aria-hidden="true">
            <Icon name="mail" size={18} />
          </span>
          <input
            ref={emailRef}
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            maxLength={254}
            readOnly={submitting}
            placeholder="name@school.org"
            className="auth-form__input"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError('email');
            }}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? `${emailId}-error` : undefined}
          />
        </div>
        {errors.email ? (
          <span className="auth-form__error" id={`${emailId}-error`}>
            {errors.email}
          </span>
        ) : null}
      </div>

      <div className="auth-form__field">
        <label className="auth-form__label" htmlFor={passwordId}>
          Password
        </label>
        <div className="auth-form__control">
          <span className="auth-form__icon" aria-hidden="true">
            <Icon name="lock" size={18} />
          </span>
          <input
            ref={passwordRef}
            id={passwordId}
            name="password"
            type={revealed ? 'text' : 'password'}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            maxLength={1024}
            readOnly={submitting}
            placeholder="Your password"
            className="auth-form__input auth-form__input--reveal"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError('password');
            }}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? `${passwordId}-error` : undefined}
          />
          <button
            type="button"
            className="auth-form__reveal"
            aria-controls={passwordId}
            aria-pressed={revealed}
            onClick={() => setRevealed((shown) => !shown)}
          >
            <Icon name={revealed ? 'eyeOff' : 'eye'} size={18} />
            <span className="sr-only">Show password</span>
          </button>
        </div>
        {errors.password ? (
          <span className="auth-form__error" id={`${passwordId}-error`}>
            {errors.password}
          </span>
        ) : null}
      </div>

      <div className="auth-form__alerts" aria-live="assertive" aria-atomic="true">
        {alert ? (
          <p className="auth-alert">
            <Icon name="alert" size={16} />
            <span>{alert}</span>
          </p>
        ) : null}
      </div>

      <button type="submit" className="auth-submit" disabled={submitting} aria-busy={submitting}>
        <span className="auth-submit__label">{submitting ? 'Signing in…' : 'Sign in'}</span>
        <span className="auth-submit__icon" aria-hidden="true">
          {submitting ? <span className="auth-spinner" /> : <Icon name="arrowRight" size={16} />}
        </span>
      </button>

      <p className="auth-form__note">
        <Icon name="shield" size={14} />
        Your session is kept in secure, HttpOnly cookies.
      </p>
    </form>
  );
}
