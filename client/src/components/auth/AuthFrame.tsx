import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES, SCHOOL } from '@/constants';
import { Icon } from '@/components/common/Icon';
import { Logo } from '@/components/common/Logo';
import './auth.css';

/**
 * The chrome of the sign-in pages: the school's mark, a way back to the
 * website, and who to ask for an account. A person here has one task, and
 * the site's navigation, enquiry button and page transition would all be in
 * the way of it.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="auth__top wrap">
        <Link className="auth__brand" to={ROUTES.home} aria-label={`${SCHOOL.name}, home`}>
          <Logo className="auth__logo" decorative priority />
        </Link>

        <Link className="auth__back" to={ROUTES.home}>
          <Icon name="arrowLeft" size={16} />
          <span>Back to the website</span>
        </Link>
      </header>

      <main id="main" className="auth__main wrap">
        {children}
      </main>

      <footer className="auth__foot wrap">
        <p>
          Accounts are issued by the school office - there is no public sign-up. For access, call{' '}
          <a href={SCHOOL.phoneHref}>{SCHOOL.phone}</a>.
        </p>
      </footer>
    </div>
  );
}

/** Reserves the panel's height while something it depends on loads. */
export function PanelPending({ label }: { label: string }) {
  return (
    <div className="auth-pending" role="status">
      <span className="auth-pending__bar" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
