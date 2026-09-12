/**
 * The only module allowed to read import.meta.env.
 * Everything else imports the typed `env` object.
 */
const raw = import.meta.env;

export const env = {
  appName: (raw.VITE_APP_NAME as string) ?? 'New Model High School',
  apiBaseUrl: (raw.VITE_API_BASE_URL as string) ?? '',
  isProduction: raw.PROD,
  isDevelopment: raw.DEV,
} as const;
