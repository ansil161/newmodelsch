/* ==========================================================================
   THE STAGE - a gate between "the page exists" and "the page is visible"
   --------------------------------------------------------------------------
   Every entrance on this site is written to run the moment its component
   mounts. That is correct on an ordinary page load and wrong under a brand
   transition: the homepage hero would play its whole 2-second arrival behind
   an opaque ivory sheet, and the visitor would be shown the finished state
   the instant the sheet lifted.

   So the transition system CLOSES the stage while it is covering the
   viewport, and OPENS it as the cover leaves. An entrance that mounts while
   the stage is closed builds itself paused and waits its turn.

   WHY A MODULE RATHER THAN CONTEXT

   Because the timing has to be settled before React renders anything. The
   transition controller decides at import time whether a first-visit intro is
   going to run, and closes the stage there - long before the homepage's hero
   is mounted, let alone before it has waited for `document.fonts.ready`.
   Context cannot be read that early, and a provider high enough to be read
   would re-render the whole tree every time the gate moved.

   THE WATCHDOG IS NOT OPTIONAL

   A closed stage means hidden content. If a transition throws, is interrupted
   by a StrictMode remount, or is cancelled by a visitor navigating twice in
   400ms, nothing would ever reopen it and the page would stay in its
   from-state permanently. So closing always arms a timer that force-opens.
   The failure mode is "an entrance played without its transition", which is
   invisible; the alternative is a blank page.
   ========================================================================== */

type Listener = () => void;

/** Longer than any transition this site runs, short enough not to be seen. */
const WATCHDOG = 2600;

let open = true;
let watchdog = 0;
const waiting = new Set<Listener>();

/** True when entrances may play immediately. */
export const stageOpen = () => open;

/** Hold every entrance that mounts from here until `openStage()`. */
export function closeStage(): void {
  open = false;
  window.clearTimeout(watchdog);
  watchdog = window.setTimeout(openStage, WATCHDOG);
}

/** Release everything that has been waiting, in the order it registered. */
export function openStage(): void {
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
export function onStage(fn: Listener): () => void {
  if (open) {
    fn();
    return () => {};
  }
  waiting.add(fn);
  return () => {
    waiting.delete(fn);
  };
}
