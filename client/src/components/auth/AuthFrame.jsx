import { Link } from 'react-router-dom';
import { ROUTES, SCHOOL } from '@/constants';
import { Icon } from '@/components/common/Icon';
import { Logo } from '@/components/common/Logo';
import './auth.css';

/**
 * The chrome of the sign-in pages: the school's mark, a way back to the
 * website, and who to ask for an account - beside a brand stage that sets
 * the tone. A person here has one task, and the site's navigation, enquiry
 * button and page transition would all be in the way of it.
 */
export function AuthFrame({ children }) {
  return (
    <div className="auth">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="auth__column">
        <header className="auth__top">
          <Link className="auth__brand" to={ROUTES.home} aria-label={`${SCHOOL.name}, home`}>
            <Logo className="auth__logo" decorative priority />
          </Link>

          <Link className="auth__back" to={ROUTES.home}>
            <span className="auth__back-icon" aria-hidden="true">
              <Icon name="arrowLeft" size={14} />
            </span>
            <span>Back to website</span>
          </Link>
        </header>

        <main id="main" className="auth__main">
          {children}
        </main>

        <footer className="auth__foot">
          <p>
            Accounts are issued by the school office - there is no public sign-up. For access, call{' '}
            <a href={SCHOOL.phoneHref}>{SCHOOL.phone}</a>.
          </p>
        </footer>
      </div>

      <AuthStage />
    </div>
  );
}

/** The brand panel beside the form. Decorative: everything it says is also on the page. */
function AuthStage() {
  return (
    <aside className="auth-stage" aria-hidden="true">
      <div className="auth-stage__shell">
        <div className="auth-stage__core">
          <span className="auth-stage__orb auth-stage__orb--a" />
          <span className="auth-stage__orb auth-stage__orb--b" />
          <span className="auth-stage__grid" />

          <div className="auth-stage__copy">
            <span className="auth-stage__eyebrow">
              <span className="auth-stage__pulse" />
              Admin console
            </span>
            <p className="auth-stage__title">
              The school&apos;s knowledge, <em>kept in order.</em>
            </p>
            <p className="auth-stage__text">
              Documents, sources and the answers behind the school assistant - managed in one calm place.
            </p>
          </div>

          <figure className="auth-stage__figure">
            <span className="auth-stage__halo" />
            <img
              className="auth-stage__photo"
              src="/images/home/hero/students-pair.webp"
              alt=""
              width={892}
              height={609}
              decoding="async"
              loading="eager"
              draggable={false}
            />
          </figure>

          <div className="auth-chip auth-chip--kb">
            <div className="auth-chip__core">
              <span className="auth-chip__icon">
                <Icon name="layers" size={18} />
              </span>
              <span className="auth-chip__text">
                <strong>Knowledge base</strong>
                <span>Documents &amp; sources</span>
              </span>
            </div>
          </div>

          <div className="auth-chip auth-chip--since">
            <div className="auth-chip__core">
              <span className="auth-chip__icon">
                <Icon name="cap" size={18} />
              </span>
              <span className="auth-chip__text">
                <strong>Since {SCHOOL.established}</strong>
                <span>{SCHOOL.city}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** Reserves the panel's height while something it depends on loads. */
export function PanelPending({ label }) {
  return (
    <div className="auth-pending" role="status">
      <span className="auth-pending__bar" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
