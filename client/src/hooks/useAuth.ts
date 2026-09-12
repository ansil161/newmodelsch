import { createContext, useContext } from 'react';
import type { AuthUser, LoginCredentials } from '@/types/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  /** True until the first answer from /auth/me/ - render nothing that depends on it yet. */
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  /** Rejects if the server could not be reached; the session is then still live. */
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth() must be used inside <AuthProvider>.');
  return value;
}
