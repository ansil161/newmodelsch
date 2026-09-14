import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';
import { Logo } from '@/components/common/Logo';
import { ROUTES } from '@/constants';
import { CONSOLE_ROUTES, ROLE_LABELS } from '@/constants/console';
import { useAuth } from '@/hooks/useAuth';
import { useNoIndex } from '@/hooks/useNoIndex';
import { useToast } from '@/hooks/useToast';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ToastProvider } from '@/providers/ToastProvider';
import { WorkspaceProvider } from '@/providers/WorkspaceProvider';
import { cx } from '@/utils';
import { Spinner } from './Feedback';
import './console.css';

/**
 * The admin console's frame: a sidebar with the school's mark, the workspace,
 * the sections and who is signed in; the page beside it.
 *
 * Below 960px the sidebar becomes a drawer behind a menu button. Every route
 * change closes it, so choosing a destination never leaves the menu covering
 * the page it opened.
 */
export function ConsoleLayout() {
  useNoIndex();
  return (
    <ToastProvider>
      <WorkspaceProvider>
        <ConsoleFrame />
      </WorkspaceProvider>
    </ToastProvider>
  );
}

function ConsoleFrame() {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className={cx('console', navOpen && 'console--nav-open')}>
      <a className="skip-link" href="#console-main">
        Skip to content
      </a>

      <header className="console__bar">
        <Brand />
        <button
          type="button"
          className="c-icon-btn"
          aria-expanded={navOpen}
          aria-controls="console-side"
          onClick={() => setNavOpen((open) => !open)}
        >
          <Icon name={navOpen ? 'close' : 'menu'} size={20} />
          <span className="sr-only">{navOpen ? 'Close menu' : 'Open menu'}</span>
        </button>
      </header>

      <aside className="console__side" id="console-side" aria-label="Console" data-lenis-prevent="">
        <div className="console__side-top">
          <Brand />
        </div>
        <WorkspaceSwitcher />
        <nav className="c-nav" aria-label="Sections">
          <NavLink to={CONSOLE_ROUTES.home} end className="c-nav__link">
            <Icon name="grid" size={18} />
            Dashboard
          </NavLink>
          <NavLink to={CONSOLE_ROUTES.knowledgeBases} className="c-nav__link">
            <Icon name="layers" size={18} />
            Knowledge base
          </NavLink>
        </nav>
        <Account />
      </aside>

      {navOpen ? <div className="console__scrim" onClick={() => setNavOpen(false)} aria-hidden="true" /> : null}

      <main id="console-main" className="console__main" tabIndex={-1}>
        <div className="console__inner">
          <Suspense
            fallback={
              <div className="c-page-loading">
                <Spinner label="Loading page" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <Link className="console__brand" to={CONSOLE_ROUTES.home} aria-label="Admin console, dashboard">
      <Logo className="console__logo" decorative priority />
      <span className="console__name">Admin console</span>
    </Link>
  );
}

function WorkspaceSwitcher() {
  const { workspaces, workspace, select, status } = useWorkspace();
  if (status !== 'ready' || workspaces.length === 0) return null;

  if (workspaces.length === 1) {
    return (
      <div className="console__workspace">
        <span className="console__workspace-label">Workspace</span>
        <span className="console__workspace-name">{workspace?.name}</span>
      </div>
    );
  }

  return (
    <div className="console__workspace">
      <label className="console__workspace-label" htmlFor="console-workspace">
        Workspace
      </label>
      <select
        id="console-workspace"
        className="c-input c-input--select c-input--compact"
        value={workspace?.id ?? ''}
        onChange={(event) => select(event.target.value)}
      >
        {workspaces.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function Account() {
  const { user, logout } = useAuth();
  const { workspace } = useWorkspace();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      toast.error('Could not sign out', 'Check your connection and try again.');
      setSigningOut(false);
    }
  };

  if (!user) return null;
  return (
    <div className="console__account">
      <div className="console__person">
        <span className="console__avatar" aria-hidden="true">
          {(user.fullName || user.email).trim().charAt(0).toUpperCase()}
        </span>
        <span className="console__person-text">
          <span className="console__person-name">{user.fullName || user.email}</span>
          <span className="console__person-role">
            {workspace?.role ? ROLE_LABELS[workspace.role] : user.email}
          </span>
        </span>
      </div>
      <div className="console__account-actions">
        <Link to={ROUTES.home} className="c-nav__link c-nav__link--quiet">
          <Icon name="arrowLeft" size={16} />
          Website
        </Link>
        <button type="button" className="c-nav__link c-nav__link--quiet" onClick={signOut} disabled={signingOut} aria-busy={signingOut}>
          <Icon name="logout" size={16} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}
