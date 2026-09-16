
/** Longer than any transition this site runs, short enough not to be seen. */
const WATCHDOG = 2600;

let open = true;
let watchdog = 0;
const waiting = new Set();

/** True when entrances may play immediately. */
export const stageOpen = () => open;

/** Hold every entrance that mounts from here until `openStage()`. */
export function closeStage() {
  open = false;
  window.clearTimeout(watchdog);
  watchdog = window.setTimeout(openStage, WATCHDOG);
}

/** Release everything that has been waiting, in the order it registered. */
export function openStage() {
  window.clearTimeout(watchdog);
  if (open) return;
  open = true;

  // Copied and cleared before running: a listener is allowed to register
  // another one, and iterating the live Set would run it in the same pass.
  const pending = Array.from(waiting);
  waiting.clear();
  pending.forEach((fn) => fn());
}

/**
 * Run `fn` now if the stage is open, or the moment it opens if it is not.
 * Returns an unsubscribe, which callers must run on teardown - a queued
 * callback holding a killed timeline is a leak with a 2.6s fuse.
 */
export function onStage(fn) {
  if (open) {
    fn();
    return () => {};
  }
  waiting.add(fn);
  return () => {
    waiting.delete(fn);
  };
}
