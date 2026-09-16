import { Link } from 'react-router-dom';
import { DIRECTIONS, FOOTER_NAV, OFFICE_HOURS, ROUTES, SCHOOL, SOCIALS } from '@/constants';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { draw, lines, reduced, rise, settle, stand } from '@/lib/motion';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import { Icon } from '@/components/common/Icon';
import { Logo } from '@/components/common/Logo';
import './Footer.css';

/* ==========================================================================
   FOOTER
   --------------------------------------------------------------------------
   The back page of the prospectus. Three bands, each quieter than the one
   before it, and then the name.

     STATEMENT   one sentence the school would put its name to, and the
                 admissions office beside it. Every page above ends on a
                 photographic call to action, so this does not ask again -
                 it says what the school is, and leaves the door open.
     DIRECTORY   small type on a ruled line: where to go on the site, where
                 to find the school elsewhere, where the campus actually is.
     WORDMARK    "New Model", fitted to the full width of the column and set
                 solid in ink. Not an outline, not cropped: on a paper ground
                 the name is the last thing on the page and it can afford to
                 be read.

   WHY THE GROUND TURNED LIGHT

   The last section of every page is a full-bleed photograph under a dark
   scrim. A navy footer under it read as more of the same band; a paper one
   reads as the page turning over. It is `--paper` rather than `--ivory` so it
   is a sheet laid on the page rather than the page itself.

   THE ARRIVAL

   Played once as each band enters - the headline line by line, then the
   highlighter, then the smaller things - except the wordmark, which is
   scrubbed: its letters stand up off the page as the reader scrolls the last
   few hundred pixels. See `stand()` in lib/motion.
   ========================================================================== */

export function Footer() {
  const { scrollTo } = useSmoothScroll();

  const scope = useGsapScope((_, el) => {
    const top = el.querySelector('.foot__top');
    const dir = el.querySelector('.foot__dir');
    const brand = el.querySelector('.foot__brand');
    const wordmark = el.querySelector('.foot__wordmark');
    const title = el.querySelector('.foot__title');
    const cta = el.querySelector('.foot__cta');

    // Split before fitting, so the fit measures the letters exactly as they
    // will be laid out while they animate.
    const unsplit = wordmark
      ? stand(wordmark.querySelectorAll('.foot__word'), { trigger: wordmark })
      : undefined;
    const unfit = wordmark ? fitWordmark(wordmark) : undefined;

    if (top) {
      if (title) lines(title, { trigger: top });
      draw(top, { trigger: top, delay: 0.8 });
      rise(top.querySelectorAll('[data-lift]'), { trigger: top, delay: 0.3, y: 20, stagger: 0.09 });
    }

    if (dir) rise(dir.querySelectorAll('.foot__group'), { trigger: dir, y: 22, stagger: 0.08 });
    if (brand) rise(brand.querySelector('.foot__sign'), { trigger: brand, start: 'top 94%', y: 12 });
    // Triggered off the wordmark rather than off itself: the legal line sits
    // in the last few percent of the viewport at full scroll, below where any
    // trigger of its own could fire.
    if (wordmark) {
      rise(el.querySelectorAll('.foot__legal > *'), {
        trigger: wordmark,
        start: 'top 78%',
        y: 10,
        stagger: 0.07,
      });
    }

    // The hairline under the statement draws itself across the column.
    if (!reduced()) {
      el.querySelectorAll('.foot__rule').forEach((rule) => {
        gsap.from(rule, {
          scaleX: 0,
          duration: 1.4,
          ease: 'power3.inOut',
          scrollTrigger: { trigger: rule, start: 'top 90%', once: true },
        });
      });
    }

    const unsettle = cta ? settle(cta) : undefined;

    return () => {
      unsettle?.();
      unfit?.();
      unsplit?.();
    };
  }, []);

  const year = new Date().getFullYear();

  return (
    <footer ref={scope} className="foot">
      <div className="wrap">
        {/* ------------------------------------------------ statement */}
        <div className="foot__top">
          <div className="foot__say">
            <h2 className="ed-h1 foot__title">
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
              <Link className="link foot__visit" to={`${ROUTES.contact}#visit`}>
                Plan a visit
                <Icon name="arrowRight" size={15} />
              </Link>
            </div>
          </div>

          <div className="foot__desk" data-lift>
            <p className="meta">Admissions office</p>
            <a className="foot__phone foot__hl" href={SCHOOL.phoneHref}>
              {SCHOOL.phone}
            </a>
            <a className="foot__mail foot__hl" href={`mailto:${SCHOOL.email}`}>
              {SCHOOL.email}
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
        </div>

        <span className="foot__rule" aria-hidden="true" />

        {/* ------------------------------------------------ directory */}
        <div className="foot__dir">
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

          <div className="foot__group foot__group--social">
            <p className="meta foot__label">Elsewhere</p>
            <ul className="foot__list">
              {SOCIALS.map((social) => (
                <li key={social.label}>
                  <a
                    className="foot__link foot__link--out"
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {social.label}
                    <Icon name="arrowUpRight" size={13} />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="foot__group foot__group--visit">
            <p className="meta foot__label">The campus</p>
            <address className="foot__addr">{SCHOOL.address}</address>
            <a
              className="link foot__map"
              href={DIRECTIONS.mapsHref}
              target="_blank"
              rel="noreferrer noopener"
            >
              Get directions
              <Icon name="arrowUpRight" size={14} />
            </a>
          </div>
        </div>

        {/* ------------------------------------------------ wordmark */}
        <div className="foot__brand">
          <div className="foot__sign">
            <span className="foot__sign-start">
              <Logo variant="white" className="foot__logo" />
              <span className="meta">Est. {SCHOOL.established}</span>
            </span>
            <span className="meta">{SCHOOL.locality}</span>
          </div>

          {/* Hidden from assistive technology: the school's name is already
              the masthead, the copyright line and the document title. */}
          <p className="foot__wordmark" aria-hidden="true">
            <span className="foot__word">New</span>
            <span className="foot__word">Model</span>
          </p>
        </div>

        <div className="foot__legal">
          <p>
            &copy; {year} {SCHOOL.name}
          </p>
          <p>CBSE affiliated · Admissions open {SCHOOL.session}</p>
          <button type="button" className="foot__up" onClick={() => scrollTo(0)}>
            Back to top
            <span className="foot__up-ring" aria-hidden="true">
              <Icon name="arrowDown" size={14} />
            </span>
          </button>
        </div>
      </div>
    </footer>
  );
}

/**
 * Sets the wordmark's size so its widest line is exactly the width of the
 * column - one line on a wide screen, "New" over "Model" on a phone.
 *
 * Measured rather than guessed in `vw`, because the ratio of a word's width
 * to its size belongs to the typeface, and a guessed ratio is either a name
 * that stops short of the margin or one that runs off the page. The
 * stylesheet carries a close estimate, so the name is already roughly right
 * before this runs and with no script at all.
 *
 * Only the width of the column is observed. Changing the type size changes
 * the footer's height and never its width, so the observer cannot feed
 * itself.
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
