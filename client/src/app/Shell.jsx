import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { CustomCursor } from '@/components/common/CustomCursor';
import { Navbar } from '@/components/layout/Navbar';
import { PageTransition } from '@/components/transition';
import { Footer } from '@/components/layout/Footer';
import { RouteTransition } from '@/components/layout/RouteTransition';
import { PageFallback } from '@/components/layout/PageFallback';
import { FloatingAssistant } from '@/components/assistant';

/**
 * The chrome every page shares. Transition layer, navigation and footer are
 * mounted once and survive route changes: only the `<Outlet>` swaps, so the
 * navigation never re-animates its entrance mid-visit.
 *
 * `PageTransition` replaced the old `Preloader`. They were the same idea -
 * an ivory sheet held over the site until it is ready - and running both
 * would have meant two of them fighting over the same first paint. It does
 * everything the preloader did (waits on the webfont and the hero image,
 * shows once per session, has a hard ceiling) and then carries the school's
 * mark into the masthead instead of simply lifting off the page.
 *
 * The custom cursor is part of the chrome again: the homepage design this
 * site is set in reads with the ring following the pointer, so removing it
 * changed the page it was drawn for. It mounts once here and is inert on
 * touch pointers, where it has nothing to follow.
 *
 * The chat assistant is chrome too, and for the same reason: mounted
 * once, outside `<main>`, so a conversation survives a route change and the
 * dock never re-enters. It lives only on the public site; the console has
 * its own layout and never loads it.
 */
export function Shell() {
  return (
    <>
      <PageTransition />
      <CustomCursor />
      <RouteTransition />

      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Navbar />

      <main id="main">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>

      <Footer />

      <FloatingAssistant />
    </>
  );
}
