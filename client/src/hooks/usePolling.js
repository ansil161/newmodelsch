import { useEffect, useRef } from 'react';

/**
 * Call `callback` every `intervalMs` while `active` — and only while the tab
 * is being looked at.
 *
 * Processing status is polled rather than pushed: the backend has no socket
 * layer, and a document takes seconds to minutes, so a few seconds of latency
 * costs nothing. What it must not do is poll forever from a tab left open in
 * the background, so a hidden tab stops, and one that becomes visible again
 * refreshes at once rather than showing a status that is minutes old.
 */
export function usePolling(callback, intervalMs, active) {
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  });

  useEffect(() => {
    if (!active) return;
    let timer = 0;
    const tick = () => {
      if (document.visibilityState === 'visible') saved.current();
      timer = window.setTimeout(tick, intervalMs);
    };
    timer = window.setTimeout(tick, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === 'visible') saved.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, active]);
}
