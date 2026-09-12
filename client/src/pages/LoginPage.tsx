import { Navigate, useLocation } from 'react-router-dom';
import { AUTH_ROUTES } from '@/constants';
import { useAuth } from '@/hooks/useAuth';
import { useNoIndex } from '@/hooks/useNoIndex';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Mark, Sticker } from '@/components/editorial';
import { AuthFrame, PanelPending } from '@/components/auth/AuthFrame';
import { LoginForm } from '@/components/auth/LoginForm';

/**
 * Where to go once signed in: the protected page that sent the reader here,
 * otherwise the dashboard. Router state is written by this app, but it is
 * checked as if it were not - only an in-app path is ever followed.
 */
function destinationFrom(state: unknown): string {
  const from = (state as { from?: { pathname?: unknown; search?: unknown; hash?: unknown } } | null)?.from;
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
      <div className="auth__grid">
        <section className="auth__intro" aria-labelledby="login-title">
          <Sticker tilt={-2.2}>Sign in</Sticker>
          <h1 id="login-title" className="ed-h1 auth__title">
            Welcome <Mark kind="underline">back.</Mark>
          </h1>
          <p className="lead auth__lead">
            Sign in with the email address the school office registered for you.
          </p>
        </section>

        <div className="auth__panel">
          {status === 'loading' ? (
            <PanelPending label="Checking your session" />
          ) : (
            <LoginForm labelledBy="login-title" />
          )}
        </div>
      </div>
    </AuthFrame>
  );
}
