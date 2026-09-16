import { SmoothScrollProvider } from './SmoothScrollProvider';

/** Single composition point for every app-wide provider. */
export function AppProviders({ children }) {
  return <SmoothScrollProvider>{children}</SmoothScrollProvider>;
}
