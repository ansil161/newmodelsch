import type { ReactNode } from 'react';
import { SmoothScrollProvider } from './SmoothScrollProvider';

/** Single composition point for every app-wide provider. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <SmoothScrollProvider>{children}</SmoothScrollProvider>;
}
