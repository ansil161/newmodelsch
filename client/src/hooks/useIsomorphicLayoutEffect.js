import { useEffect, useLayoutEffect } from 'react';

/** useLayoutEffect in the browser, useEffect on the server — silences SSR warnings. */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
