import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DIRECTIONS,
  FOOTER_NAV,
  OFFICE_HOURS,
  ROUTES,
  SCHOOL,
  SCHOOL_TIME_ZONE,
  SOCIALS,
} from '@/constants';
import { useGsapScope } from '@/hooks/useGsapScope';
import { draw, lines, reduced, rise, settle, stand } from '@/lib/motion';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import { Icon } from '@/components/common/Icon';
import { Logo } from '@/components/common/Logo';
import './Footer.css';

/* ==========================================================================
   FOOTER
   --------------------------------------------------------------------------
   The back cover. Four layers, each quieter than the one before it.

     INVITATION  a light raised panel on the cloth: the one sentence the
                 school would put its name to, the two next steps, and the
                 admissions desk beside them - with whether the office is
                 open right now, which is the question a parent reading
                 the footer is actually asking.
     DIRECTORY   the school's signature and social links, then the site in
                 two columns, then where the campus is.
     WORDMARK    "New Model", fitted to the column and fading into the
                 ground, so the name is felt rather than read.
     LEGAL       copyright, affiliation, and the way back up.

   THE ARRIVAL

   The panel rises, its headline arrives line by line and is marked, the desk
   and directory follow in sequence. The wordmark is scrubbed: its letters
   stand up off the page over the last few hundred pixels (`stand()`). The
   glow inside the panel follows the pointer on fine pointers only.
   ========================================================================== */

export function Footer() {
  const { scrollTo } = useSmoothScroll();

  const scope = useGsapScope((_, el) => {
    const panel = el.querySelector('.foot__panel');
    const dir = el.querySelector('.foot__dir');
    const wordmark = el.querySelector('.foot__wordmark');
    const title = el.querySelector('.foot__title');
    const cta = el.querySelector('.foot__cta');

    // Split before fitting, so the fit measures the letters exactly as they
    // will be laid out while they animate.
    const unsplit = wordmark
      ? stand(wordmark.querySelectorAll('.foot__word'), { trigger: wordmark })
      : undefined;
    const unfit = wordmark ? fitWordmark(wordmark) : undefined;

    if (panel) {
      rise(panel, { trigger: panel, start: 'top 92%', y: 48 });
      if (title) lines(title, { trigger: panel, delay: 0.15 });
      draw(panel, { trigger: panel, delay: 0.95 });
      rise(panel.querySelectorAll('[data-lift]'), {
        trigger: panel,
        delay: 0.35,
        y: 20,
        stagger: 0.08,
      });
    }

    if (dir) rise(dir.querySelectorAll('.foot__group'), { trigger: dir, y: 22, stagger: 0.08 });

    // Triggered off the wordmark: the legal line sits in the last few percent
    // of the viewport at full scroll, below where a trigger of its own fires.
    if (wordmark) {
      rise(el.querySelectorAll('.foot__legal > *'), {
        trigger: wordmark,
        start: 'top 78%',
        y: 10,
        stagger: 0.07,
      });
    }

    const unglow = panel ? follow(panel) : undefined;
    const unsettle = cta ? settle(cta) : undefined;

    return () => {
      unglow?.();
      unsettle?.();
      unfit?.();
      unsplit?.();
    };
  }, []);

  const year = new Date().getFullYear();

  return (
    <footer ref={scope} className="foot">
      <div className="foot__aura" aria-hidden="true" />

      <div className="wrap">
        {/* ------------------------------------------------ invitation */}
        <section className="foot__panel" aria-labelledby="foot-title">
          <span className="foot__glow" aria-hidden="true" />
          <span className="foot__dots" aria-hidden="true" />

          <div className="foot__say">
            <p className="foot__eyebrow" data-lift>
              <span className="foot__pulse" aria-hidden="true" />
              Admissions open for {SCHOOL.session}
            </p>
            <h2 id="foot-title" className="ed-h1 foot__title">
              Every child here is known <span className="mark">by name.</span>
            </h2>
            <p className="foot__lead" data-lift>
              Nursery to Class 10 on one campus in Bahadurpura, held since {SCHOOL.established} to
              the standard the first forty children were promised in person.
            </p>
            <div className="foot__actions" data-lift>
              <Link className="btn btn-primary foot__cta" to={`${ROUTES.admissions}#enquiry`}>
                <span className="btn__label">
                  Start an enquiry
                  <Icon name="arrowRight" size={16} />
                </span>
              </Link>
              <Link className="foot__ghost" to={`${ROUTES.contact}#visit`}>
                <Icon name="calendar" size={17} />
                Plan a visit
              </Link>
            </div>
          </div>

          <div className="foot__desk" data-lift>
            <div className="foot__desk-head">
              <p className="meta">Admissions office</p>
              <OfficeStatus />
            </div>

            <a className="foot__phone" href={SCHOOL.phoneHref}>
              <span className="foot__phone-icon" aria-hidden="true">
                <Icon name="phone" size={18} />
              </span>
              {SCHOOL.phone}
            </a>
            <a className="foot__mail" href={`mailto:${SCHOOL.email}`}>
              <Icon name="mail" size={16} />
              {/* Breaks after the @ when it must, never inside the domain. */}
              <span>
                {SCHOOL.email.split('@')[0]}@<wbr />
                {SCHOOL.email.split('@')[1]}
              </span>
            </a>

            <dl className="foot__hours">
              {OFFICE_HOURS.map((slot) => (
                <div key={slot.day}>
                  <dt>{slot.day}</dt>
                  <dd>{slot.hours}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ------------------------------------------------ directory */}
        <div className="foot__dir">
          <div className="foot__group foot__group--brand">
            <Link to={ROUTES.home} className="foot__home" aria-label={`${SCHOOL.name}, home`}>
              <Logo className="foot__logo" variant="white" decorative />
            </Link>
            <p className="foot__about">
              A CBSE school for Nursery to Class 10, teaching families in {SCHOOL.locality} since{' '}
              {SCHOOL.established}.
            </p>
            <ul className="foot__socials" aria-label="The school elsewhere">
              {SOCIALS.map((social) => (
                <li key={social.label}>
                  <a
                    className="foot__social"
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`${social.label} (opens in a new tab)`}
                  >
                    <Icon name={social.icon} size={18} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {FOOTER_NAV.map((group) => (
            <nav className="foot__group" key={group.title} aria-label={`Footer - ${group.title}`}>
              <p className="meta foot__label">{group.title}</p>
              <ul className="foot__list">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link className="foot__link" to={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="foot__group foot__group--visit">
            <p className="meta foot__label">The campus</p>
            <address className="foot__addr">
              <Icon name="pin" size={18} />
              <span>{SCHOOL.address}</span>
            </address>
            <a
              className="foot__map"
              href={DIRECTIONS.mapsHref}
              target="_blank"
              rel="noreferrer noopener"
            >
              Get directions
              <Icon name="arrowUpRight" size={15} />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>

        {/* ------------------------------------------------ wordmark */}
        <div className="foot__brand">
          {/* Hidden from assistive technology: the school's name is already
              the masthead, the copyright line and the document title. */}
          <p className="foot__wordmark" aria-hidden="true">
            <span className="foot__word">New</span>
            <span className="foot__word">Model</span>
          </p>
        </div>

        <div className="foot__legal">
          <p>
            &copy; {year} {SCHOOL.name}. All rights reserved.
          </p>
          <p className="foot__badges">
            <span>CBSE affiliated</span>
            <span aria-hidden="true">·</span>
            <span>Est. {SCHOOL.established}</span>
            <span aria-hidden="true">·</span>
            <span>{SCHOOL.locality}</span>
          </p>
          <button type="button" className="foot__up" onClick={() => scrollTo(0)}>
            Back to top
            <span className="foot__up-box" aria-hidden="true">
              <Icon name="arrowDown" size={15} />
            </span>
          </button>
        </div>
      </div>
    </footer>
  );
}

/* --------------------------------------------------------------------------
   Office status
   --------------------------------------------------------------------------
   Its own component so the minute tick re-renders a pill and nothing else -
   the headline above it has been split by SplitText and must not be touched
   by React. Rendered empty until mounted, so the first paint never shows a
   status computed from a stale clock.
   -------------------------------------------------------------------------- */
function OfficeStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const tick = () => setStatus(officeStatus(new Date()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!status) return <span className="foot__status" aria-hidden="true" />;

  return (
    <span className={`foot__status${status.open ? ' is-open' : ''}`}>
      <span className="foot__status-dot" aria-hidden="true" />
      {status.label}
    </span>
  );
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const minutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const clock = (hhmm) => {
  const total = minutes(hhmm);
  const h = Math.floor(total / 60);
  const m = String(total % 60).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
};

/**
 * Whether the admissions office is open now, in the school's time zone, and
 * if not, when it next opens. Reads the structured half of OFFICE_HOURS.
 */
function officeStatus(now) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: SCHOOL_TIME_ZONE,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const today = WEEKDAYS.indexOf(parts.weekday);
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  const slotFor = (day) => OFFICE_HOURS.find((s) => s.days?.includes(day) && s.opens);

  const slot = slotFor(today);
  if (slot && current >= minutes(slot.opens) && current < minutes(slot.closes)) {
    return { open: true, label: `Open now · until ${clock(slot.closes)}` };
  }

  for (let ahead = 0; ahead < 8; ahead += 1) {
    const day = (today + ahead) % 7;
    const next = slotFor(day);
    if (!next || (ahead === 0 && current >= minutes(next.opens))) continue;
    const when = ahead === 0 ? 'today' : ahead === 1 ? 'tomorrow' : WEEKDAYS[day];
    return { open: false, label: `Closed · opens ${when} ${clock(next.opens)}` };
  }

  return { open: false, label: 'Closed' };
}

/* --------------------------------------------------------------------------
   The panel's glow follows the pointer. Writes two custom properties the
   stylesheet positions a radial gradient with; nothing is tweened per frame
   beyond that. Fine pointers only, and never under reduced motion.
   -------------------------------------------------------------------------- */
function follow(panel) {
  if (reduced() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const onMove = (e) => {
    const r = panel.getBoundingClientRect();
    panel.style.setProperty('--gx', `${e.clientX - r.left}px`);
    panel.style.setProperty('--gy', `${e.clientY - r.top}px`);
  };

  panel.addEventListener('pointermove', onMove);
  return () => panel.removeEventListener('pointermove', onMove);
}

/**
 * Sets the wordmark's size so its widest line is exactly the width of the
 * column - one line on a wide screen, "New" over "Model" on a phone.
 *
 * Measured rather than guessed in `vw`, because the ratio of a word's width
 * to its size belongs to the typeface. The stylesheet carries a close
 * estimate, so the name is already roughly right before this runs and with
 * no script at all. Only the column's width is observed, and changing the
 * type size never changes it, so the observer cannot feed itself.
 */
function fitWordmark(el) {
  const column = el.parentElement;
  if (!column) return;

  const fit = () => {
    el.style.fontSize = '100px';
    const natural = el.getBoundingClientRect().width;
    const available = column.clientWidth;
    if (natural > 0 && available > 0) {
      el.style.fontSize = `${(100 * available) / natural}px`;
    }
  };

  fit();
  const observer = new ResizeObserver(fit);
  observer.observe(column);

  return () => {
    observer.disconnect();
    el.style.fontSize = '';
  };
}
