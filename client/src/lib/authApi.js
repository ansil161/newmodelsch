import { api, resetCsrfToken } from './apiClient';

/**
 * The four auth endpoints, and nothing else: sign-in only. There is no
 * registration, signup or password-reset call because the API has none.
 */

const toUser = (user) => ({
  id: user.id,
  email: user.email,
  fullName: user.full_name,
  isStaff: user.is_staff,
});

export const authApi = {
  async login({ email, password }) {
    const data = await api.post('/auth/login/', { email, password }, { skipRefresh: true });
    resetCsrfToken(); // rotated by the server for the new session
    return toUser(data.user);
  },

  async logout() {
    try {
      await api.post('/auth/logout/', undefined, { skipRefresh: true });
    } finally {
      resetCsrfToken();
    }
  },

  /** The signed-in user. A 401 is refreshed once by the client before this rejects. */
  async me(signal) {
    const data = await api.get('/auth/me/', { signal });
    return toUser(data.user);
  },
};
