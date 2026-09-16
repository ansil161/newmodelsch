import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageFallback } from '@/components/layout/PageFallback';
import { AuthProvider } from '@/providers/AuthProvider';

/**
 * The layout for /login and everything behind it.
 *
 * Deliberately not the marketing Shell - no navigation bar, no footer, no
 * page transition - and the only place AuthProvider is mounted. A parent
 * reading the admissions page never triggers a session check: the first
 * request to /auth/me/ happens when somebody comes here to sign in.
 */
export function AuthLayout() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </AuthProvider>
  );
}
