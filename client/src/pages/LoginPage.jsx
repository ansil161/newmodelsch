import { Navigate, useLocation } from 'react-router-dom';
import { AUTH_ROUTES } from '@/constants';
import { useAuth } from '@/hooks/useAuth';
import { useNoIndex } from '@/hooks/useNoIndex';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Icon } from '@/components/common/Icon';
import { AuthFrame, PanelPending } from '@/components/auth/AuthFrame';
import { LoginForm } from '@/components/auth/LoginForm';

/**
 * Where to go once signed in: the protected page that sent the reader here,
 * otherwise the dashboard. Router state is written by this app, but it is
 * checked as if it were not - only an in-app path is ever followed.
 */
function destinationFrom(state) {
  const from = state?.from;
  const path = typeof from?.pathname === 'string' ? from.pathname : '';
  if (!path.startsWith('/') || path.startsWith('//') || path === AUTH_ROUTES.login) return AUTH_ROUTES.dashboard;
  const search = typeof from?.search === 'string' ? from.search : '';
  const hash = typeof from?.hash === 'string' ? from.hash : '';
  return `${path}${search}${hash}`;
}

/**
 * /login - sign-in only. Accounts are issued by the school; there is no
 * registration page, and nothing here links to one.
 */
export function LoginPage() {
  usePageMeta({
    title: 'Sign in - New Model High School',
    description: 'Sign in to your New Model High School account.',
  });
  useNoIndex();

  const { status } = useAuth();
  const location = useLocation();

  if (status === 'authenticated') return <Navigate to={destinationFrom(location.state)} replace />;

  return (
    <AuthFrame>
      <div className="auth__stack">
        <section className="auth__intro" aria-labelledby="login-title">
          <span className="auth__eyebrow auth-rise" style={{ '--i': 0 }}>
            <Icon name="lock" size={12} />
            Staff sign-in
          </span>
          <h1 id="login-title" className="auth__title auth-rise" style={{ '--i': 1 }}>
            Welcome <span className="auth__title-accent">back.</span>
          </h1>
          <p className="auth__lead auth-rise" style={{ '--i': 2 }}>
            Sign in with the email address the school office registered for you.
          </p>
        </section>

        <div className="auth__panel auth-rise" style={{ '--i': 3 }}>
          <div className="auth__panel-core">
            {status === 'loading' ? (
              <PanelPending label="Checking your session" />
            ) : (
              <LoginForm labelledBy="login-title" />
            )}
          </div>
        </div>
      </div>
    </AuthFrame>
  );
}
