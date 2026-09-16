import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/common/Icon';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { authApi } from '@/lib/authApi';
import { validateLogin } from '@/utils';
import { PanelPending } from './AuthFrame';
import { Captcha } from './Captcha';

/**
 * Everything the form says. The server's own messages are never displayed:
 * a code maps to one of these, and anything unrecognised is the generic one.
 */
const MESSAGES = {
  invalid: 'Invalid email or password.',
  throttled: 'Too many attempts. Please try again later.',
  captchaFailed: 'Security verification failed. Please try again.',
  generic: 'Something went wrong. Please try again.',
  captchaRequired: 'Please complete the security check.',
  captchaExpired: 'The security check expired. Please complete it again.',
  captchaUnavailable: 'The security check could not load. Check your connection, then reload the page.',
  unreachable: 'We could not reach the sign-in service. Check your connection and try again.',
};

function messageFor(error) {
  if (!(error instanceof ApiError)) return MESSAGES.generic;
  if (error.status === 429) return MESSAGES.throttled;
  if (error.code === 'invalid_credentials') return MESSAGES.invalid;
  if (error.code === 'captcha_failed') return MESSAGES.captchaFailed;
  return MESSAGES.generic;
}

export function LoginForm({ labelledBy }) {
  const { login } = useAuth();
  const uid = useId();
  const emailId = `${uid}-email`;
  const passwordId = `${uid}-password`;
  const captchaLabelId = `${uid}-captcha`;

  const [configAttempt, setConfigAttempt] = useState(0);
  const [configState, setConfigState] = useState({ status: 'loading' });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaNote, setCaptchaNote] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // State updates are asynchronous, so a double click could read `submitting`
  // as false twice. The ref is the real guard against a duplicate request.
  const inFlight = useRef(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const captchaRef = useRef(null);

  useEffect(() => {
    let active = true;
    authApi.loginConfig().then(
      (config) => {
        if (active) setConfigState({ status: 'ready', config });
      },
      () => {
        if (active) setConfigState({ status: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, [configAttempt]);

  const clearError = (field) =>
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });

  const resetCaptcha = () => {
    captchaRef.current?.reset();
    setCaptchaToken(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current || configState.status !== 'ready') return;

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

    const { config } = configState;
    if (config.enabled && !captchaToken) {
      setAlert(MESSAGES.captchaRequired);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      await login({ email: trimmedEmail, password, captchaToken: captchaToken ?? '' });
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
      resetCaptcha();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (configState.status === 'loading') return <PanelPending label="Loading the sign-in form" />;

  if (configState.status === 'error') {
    return (
      <div className="auth-form">
        <p className="auth-alert" role="alert">
          <Icon name="close" size={16} />
          <span>{MESSAGES.unreachable}</span>
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setConfigState({ status: 'loading' });
            setConfigAttempt((n) => n + 1);
          }}
        >
          <span className="btn__label">Try again</span>
        </button>
      </div>
    );
  }

  const { config } = configState;

  return (
    <form id="login-form" className="auth-form" onSubmit={submit} noValidate aria-labelledby={labelledBy}>
      <div className="auth-form__field">
        <label className="auth-form__label" htmlFor={emailId}>
          Email address
        </label>
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
          className="auth-form__input"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError('email');
          }}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? `${emailId}-error` : undefined}
        />
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
        <div className="auth-form__password">
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
            className="auth-form__input"
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

      {config.enabled && config.provider ? (
        <div className="auth-form__field">
          <span className="auth-form__label" id={captchaLabelId}>
            Security check
          </span>
          <Captcha
            ref={captchaRef}
            provider={config.provider}
            siteKey={config.siteKey}
            labelledBy={captchaLabelId}
            onToken={(token) => {
              setCaptchaToken(token);
              if (token) {
                setCaptchaNote(null);
                setAlert((current) => (current === MESSAGES.captchaRequired ? null : current));
              }
            }}
            onExpire={() => setCaptchaNote(MESSAGES.captchaExpired)}
            onError={(kind) => setCaptchaNote(kind === 'load' ? MESSAGES.captchaUnavailable : MESSAGES.captchaFailed)}
          />
          <p className="auth-form__hint" aria-live="polite">
            {captchaNote}
          </p>
        </div>
      ) : null}

      <div className="auth-form__alerts" aria-live="assertive" aria-atomic="true">
        {alert ? (
          <p className="auth-alert">
            <Icon name="close" size={16} />
            <span>{alert}</span>
          </p>
        ) : null}
      </div>

      <button type="submit" className="btn btn-primary auth-form__submit" disabled={submitting} aria-busy={submitting}>
        <span className="btn__label">
          {submitting ? (
            <>
              <span className="auth-spinner" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <Icon name="arrowRight" size={16} />
            </>
          )}
        </span>
      </button>
    </form>
  );
}
