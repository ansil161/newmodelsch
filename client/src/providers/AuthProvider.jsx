import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '@/hooks/useAuth';
import { setSessionExpiredHandler } from '@/lib/apiClient';
import { authApi } from '@/lib/authApi';

const SIGNED_OUT = { status: 'unauthenticated', user: null };

/**
 * Who is signed in, as far as the interface needs to know.
 *
 * A cache of the server's answer, never the authority: every request is
 * authorised by the backend from the HttpOnly cookies, whatever this says.
 * It holds the user's public fields and nothing else.
 *
 * On mount it asks GET /auth/me/. The API client answers a 401 with one
 * refresh, so an expired access token with a live refresh token still
 * resolves to 'authenticated'; a failed refresh resolves to 'unauthenticated'.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null });

  useEffect(() => {
    const controller = new AbortController();
    setSessionExpiredHandler(() => setState(SIGNED_OUT));

    authApi.me(controller.signal).then(
      (user) => setState({ status: 'authenticated', user }),
      () => {
        if (!controller.signal.aborted) setState(SIGNED_OUT);
      },
    );

    return () => {
      controller.abort();
      setSessionExpiredHandler(null);
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const user = await authApi.login(credentials);
    setState({ status: 'authenticated', user });
    return user;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setState(SIGNED_OUT);
  }, []);

  const value = useMemo(
    () => ({
      user: state.user,
      status: state.status,
      isAuthenticated: state.status === 'authenticated',
      isLoading: state.status === 'loading',
      login,
      logout,
    }),
    [state, login, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
