import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { NAV_LINKS, ROUTES, SCHOOL } from '@/constants';
import { studentImages } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Figure } from '@/components/editorial';
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
     reader looking at a list of links to the page they are already on. */
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

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
        className={`nav${scrolled ? ' is-scrolled' : ''}${hidden && !open ? ' is-hidden' : ''}${open ? ' is-open' : ''}`}
      >
        <div className="nav__inner">
          <Link className="nav__brand" to={ROUTES.home} aria-label={`${SCHOOL.name}, home`}>
            {/* The mark is drawn, not an image file: two rules and a disc,
                which is the same vocabulary as the marks in the headlines. */}
            <span className="nav__mark" aria-hidden="true">
              <i />
              <i />
              <b />
            </span>
            <span className="nav__name">
              <b>New Model</b>
              <span>High School</span>
            </span>
          </Link>

          <nav className="nav__links" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                end={link.href === ROUTES.home}
                className={({ isActive }) => `nav__link${isActive ? ' is-current' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
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
              <li className="menu__item" key={link.href}>
                <NavLink
                  to={link.href}
                  end={link.href === ROUTES.home}
                  className={({ isActive }) => `menu__link${isActive ? ' is-current' : ''}`}
                >
                  <span className="menu__num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="menu__label ed-h1">{link.label}</span>
                  {link.blurb ? <span className="menu__blurb">{link.blurb}</span> : null}
                </NavLink>
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
