/* ==========================================================================
   THE MENU CHANNEL
   --------------------------------------------------------------------------
   The homepage hero carries its own compact masthead, and below 900px that
   masthead needs a way to open the site menu. The menu itself belongs to
   `Navbar`: it owns the focus trap, the scroll lock, the escape key and the
   inert state, and a second implementation of any of those is a second
   accessibility bug.

   So the hero asks rather than reimplements. One window event, one constant,
   no context provider - `Navbar` mounts once in `Shell` and outlives every
   route, so there is never more than one listener and nothing to reconcile.
   ========================================================================== */

export const OPEN_MENU = 'nmhs:open-menu';
