import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { NAV_LINKS, ROUTES, SCHOOL } from '@/constants';
import { everydayImages, studentImages } from '@/constants/imagery';
import type { NavRoute } from '@/types';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Logo } from '@/components/common/Logo';
import { Figure } from '@/components/editorial';
import { OPEN_MENU } from './menu-channel';
import './Navbar.css';

/* ==========================================================================
   NAVBAR
   --------------------------------------------------------------------------
   THREE STATES, AND THE MIDDLE ONE IS THE INTERESTING ONE.

     TOP        transparent, sitting on whatever the page opens with. No bar,
                no shadow, no background - the masthead is just type on the
                hero.
     SCROLLED   a compact bar with a warm ground and a hairline under it. It
                gets shorter, not just coloured: the height drops so the bar
                takes less of a phone's screen the longer someone reads.
     UP         the bar returns when the reader scrolls up, at any depth,
                because someone scrolling up is looking for something and the
                thing they are looking for is usually the navigation.

   The third one is why this is not a plain `position: sticky`. A bar that is
   always there costs 76px of every screen; a bar that only hides is a bar you
   have to scroll to the top to retrieve.

   THE MOBILE MENU IS A PAGE, NOT A DRAWER.

   Full screen, the links set at display scale in the serif, each with the
   line that says what is on it, and a photograph. It is the same editorial
   language as the site rather than a list of small links in a panel - and at
   six destinations, it can afford to be.

   WHAT THE MENU GETS RIGHT THAT DRAWERS USUALLY DO NOT

     - Focus moves into the panel on open and back to the button on close.
     - Escape closes it. So does a route change.
     - The page behind it is inert, so tab does not walk out of the menu into
       content nobody can see.
     - Lenis is stopped while it is open, so a scroll gesture on the overlay
       does not move the page underneath.
   ========================================================================== */

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* The bar's own state machine. ScrollTrigger rather than a scroll listener,
     because Lenis already drives ScrollTrigger and a second listener would be
     measuring a scroll position Lenis has not committed yet. */
  const scope = useGsapScope<HTMLElement>(() => {
    const st = ScrollTrigger.create({
      start: 'top -80',
      end: 99999,
      onUpdate: (self) => {
        setScrolled(self.progress > 0 || self.scroll() > 80);
        // Hidden only when travelling down, and only once the opening screen
        // has actually left. Measured against the viewport rather than a fixed
        // number, so it is the same moment on a laptop and on a phone - a
        // constant here hides the masthead while a tall screen is still
        // showing the hero.
        setHidden(self.direction === 1 && self.scroll() > window.innerHeight);
      },
    });
    return () => st.kill();
  }, []);

  /* Close on navigation. A menu that survives a route change leaves the
     reader looking at a list of links to the page they are already on. The
     hash counts too: Student Life's sub-links are anchors on one page, and a
     menu left open over the section it just scrolled to hides it. */
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  /* The homepage hero carries its own compact masthead, so this bar would be
     the second one on screen. It stands down while the hero is at the top of
     the window and takes over the moment the reader leaves it - which is also
     the moment the hero's masthead scrolls away. Every other page is
     untouched. See `components/home/hero/OrbitHero.tsx`. */
  const ghost = location.pathname === ROUTES.home && !scrolled && !open;

  /* ...and below 900px the hero's masthead has no room for six links, so it
     asks for this menu instead of shipping a second one. */
  useEffect(() => {
    const onAsk = () => setOpen(true);
    window.addEventListener(OPEN_MENU, onAsk);
    return () => window.removeEventListener(OPEN_MENU, onAsk);
  }, []);

  /* Everything that has to happen while the menu is open, in one place. */
  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    root.classList.add('is-locked');

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);

    // Focus the panel itself rather than its first link, so a screen reader
    // announces the menu before it announces "Home".
    panelRef.current?.focus();

    if (!reduced()) {
      const items = panelRef.current?.querySelectorAll('.menu__item');
      gsap.from(items ?? [], {
        yPercent: 60,
        autoAlpha: 0,
        duration: 0.75,
        ease: 'power4.out',
        stagger: 0.055,
        delay: 0.12,
      });
      gsap.from(panelRef.current?.querySelectorAll('.menu__aside > *') ?? [], {
        y: 20,
        autoAlpha: 0,
        duration: 0.7,
        stagger: 0.07,
        delay: 0.35,
      });
    }

    return () => {
      root.classList.remove('is-locked');
      document.removeEventListener('keydown', onKey);
      toggleRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <header
        ref={scope}
        className={`nav${scrolled ? ' is-scrolled' : ''}${hidden && !open ? ' is-hidden' : ''}${open ? ' is-open' : ''}${ghost ? ' is-ghost' : ''}`}
        // Hidden from assistive tech as well while it stands down, so the
        // homepage never announces two primary navigations.
        inert={ghost || undefined}
      >
        <div className="nav__inner">
          <Link className="nav__brand" to={ROUTES.home} aria-label={`${SCHOOL.name}, home`}>
            <Logo className="nav__logo" decorative priority />
          </Link>

          <nav className="nav__links" aria-label="Primary">
            {NAV_LINKS.map((link) =>
              link.children?.length ? (
                <NavDropdown key={link.href} link={link} />
              ) : (
                <NavLink
                  key={link.href}
                  to={link.href}
                  end={link.href === ROUTES.home}
                  className={({ isActive }) => `nav__link${isActive ? ' is-current' : ''}`}
                >
                  {link.label}
                </NavLink>
              ),
            )}
          </nav>

          <div className="nav__end">
            <a className="nav__phone" href={SCHOOL.phoneHref}>
              <Icon name="phone" size={16} />
              <span>{SCHOOL.phone}</span>
            </a>

            <Link className="btn btn-sun nav__cta" to={`${ROUTES.admissions}#enquiry`}>
              <span className="btn__label">
                Enquire
                <Icon name="arrowRight" size={16} />
              </span>
            </Link>

            <button
              ref={toggleRef}
              type="button"
              className="nav__toggle"
              aria-expanded={open}
              aria-controls="nav-menu"
              onClick={() => setOpen((v) => !v)}
            >
              <span className="nav__toggle-bars" aria-hidden="true">
                <i />
                <i />
              </span>
              <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            </button>
          </div>
        </div>
      </header>

      <div
        id="nav-menu"
        ref={panelRef}
        tabIndex={-1}
        className={`menu${open ? ' is-open' : ''}`}
        aria-label="Site menu"
        aria-modal={open || undefined}
        role={open ? 'dialog' : undefined}
        // Inert while closed, so the six links are not in the tab order of
        // every page on the site.
        inert={!open}
      >
        <div className="menu__inner wrap">
          <ol className="menu__list">
            {NAV_LINKS.map((link, i) => (
              <li
                className={`menu__item${link.children?.length ? ' menu__item--parent' : ''}`}
                key={link.href}
              >
                <NavLink
                  to={link.href}
                  end={link.href === ROUTES.home}
                  className={({ isActive }) => `menu__link${isActive ? ' is-current' : ''}`}
                >
                  <span className="menu__num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="menu__label ed-h1">{link.label}</span>
                  {link.blurb ? <span className="menu__blurb">{link.blurb}</span> : null}
                </NavLink>

                {link.children?.length ? (
                  <ul className="menu__sub" aria-label={`In ${link.label}`}>
                    {link.children.map((child) => (
                      <li key={child.href}>
                        {/* Closed by hand as well as by the location effect:
                            tapping the anchor for the section already in the
                            URL changes nothing the effect can see. */}
                        <Link
                          to={child.href}
                          className={`menu__sub-link${child.href === ROUTES.gallery ? ' menu__sub-link--new' : ''}`}
                          onClick={() => setOpen(false)}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>

          <div className="menu__aside">
            <Figure
              photo={studentImages[4]}
              width={620}
              sizes="(max-width: 900px) 60vw, 26vw"
              shape="arch"
              ratio="portrait"
              className="menu__fig"
            />

            <div className="menu__contact">
              <p className="meta">Admissions office</p>
              <a className="menu__phone" href={SCHOOL.phoneHref}>
                {SCHOOL.phone}
              </a>
              <a className="menu__mail" href={`mailto:${SCHOOL.email}`}>
                {SCHOOL.email}
              </a>
              <p className="menu__addr">{SCHOOL.address}</p>
            </div>

            <Link className="btn btn-sun menu__cta" to={`${ROUTES.admissions}#enquiry`}>
              <span className="btn__label">
                Start an enquiry
                <Icon name="arrowRight" size={16} />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

/* ==========================================================================
   THE DROPDOWN
   --------------------------------------------------------------------------
   Two controls, not one, and that is deliberate. "Student Life" stays a link
   to the chapter, because that is where most people clicking it want to go;
   the chevron beside it is a real button that owns the panel. A single
   element that both navigates and toggles has to guess which one a tap meant,
   and on a touchscreen laptop it guesses wrong.

   A pointer opens it on hover with a short grace period on the way out, so a
   diagonal move toward the panel does not close it. A keyboard opens it with
   the button; Escape closes it and hands focus back; tabbing past the last
   link closes it on the way out.
   ========================================================================== */

function NavDropdown({ link }: { link: NavRoute }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef(0);
  const location = useLocation();
  const panelId = useId();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const show = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 160);
  };

  const children = link.children ?? [];

  return (
    <div
      ref={wrapRef}
      className={`nav__drop${open ? ' is-open' : ''}`}
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <NavLink
        to={link.href}
        className={({ isActive }) => `nav__link${isActive ? ' is-current' : ''}`}
      >
        {link.label}
      </NavLink>

      <button
        ref={buttonRef}
        type="button"
        className="nav__drop-btn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="chevronDown" size={13} strokeWidth={2} />
        <span className="sr-only">
          {open ? 'Hide' : 'Show'} pages in {link.label}
        </span>
      </button>

      <div id={panelId} className="nav__panel" inert={!open}>
        <div className="nav__panel-inner">
          <div className="nav__panel-list">
            <Link className="nav__panel-head" to={link.href} onClick={() => setOpen(false)}>
              <span className="meta">{link.label}</span>
              <span className="nav__panel-all">
                Overview
                <Icon name="arrowRight" size={13} />
              </span>
            </Link>

            <ul className="nav__sub">
              {children.map((child, i) => (
                <li key={child.href}>
                  <Link className="nav__sub-link" to={child.href} onClick={() => setOpen(false)}>
                    <span className="nav__sub-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="nav__sub-label">
                      {child.label}
                      {child.href === ROUTES.gallery ? <span className="nav__sub-new">New</span> : null}
                    </span>
                    {child.blurb ? <span className="nav__sub-blurb">{child.blurb}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* The one picture in the panel, and it is the gallery's: the only
              destination in the list that is itself made of photographs. */}
          <Link
            className="nav__feature"
            to={ROUTES.gallery}
            onClick={() => setOpen(false)}
            tabIndex={-1}
            aria-hidden="true"
          >
            <Figure
              photo={everydayImages.waving}
              width={300}
              sizes="220px"
              shape="frame"
              ratio="free"
              decorative
            />
            <span className="nav__feature-text">
              <span className="nav__feature-kicker">The living yearbook</span>
              <span className="nav__feature-title">Four school years, in photographs</span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
