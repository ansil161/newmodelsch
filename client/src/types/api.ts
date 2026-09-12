/**
 * The backend's response envelope and the auth API's shapes. These mirror
 * backend/apps/core/responses.py and apps/accounts/serializers.py.
 */

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiFailure {
  success: false;
  message: string;
  /** Stable, for code to branch on: 'invalid_credentials', 'captcha_failed', 'throttled'... */
  code: string;
  /** Field-level validation messages, keyed by field name. */
  errors: Record<string, string[]>;
}

/** The user as the API sends it. Mapped to `AuthUser` at the edge. */
export interface ApiUser {
  id: number;
  email: string;
  full_name: string;
  is_staff: boolean;
}

/** The signed-in user: public fields only. There is never a token here. */
export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  isStaff: boolean;
}

export type CaptchaProvider = 'turnstile' | 'hcaptcha' | 'recaptcha';

/** Public CAPTCHA configuration. The secret key exists only on the server. */
export interface CaptchaConfig {
  enabled: boolean;
  provider: CaptchaProvider | null;
  siteKey: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  captchaToken: string;
}
