import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AUTH_ROUTES } from '@/constants';
import { useAuth } from '@/hooks/useAuth';
import { PageFallback } from '@/components/layout/PageFallback';

/**
 * Renders its children only for a signed-in user.
 *
 * Until the session check answers it renders a quiet placeholder - never the
 * protected page and never a redirect - so a signed-in user reloading the
 * page does not flash through /login on the way back.
 *
 * This decides what the interface shows, not what anyone may do: the API
 * enforces authentication on every request regardless.
 */
export function ProtectedRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageFallback />;
  if (status === 'unauthenticated') {
    return <Navigate to={AUTH_ROUTES.login} replace state={{ from: location }} />;
  }
  return children ?? <Outlet />;
}
