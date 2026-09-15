import { Link } from 'react-router-dom';
import { PRINCIPAL, ROUTES } from '@/constants';
import { facultyImages } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { draw, drift, grow, lines, rise, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Figure, Mark } from '@/components/editorial';
import './principal.css';

/* ==========================================================================
   08 - THE PRINCIPAL - a letter, set as a magazine spread
   --------------------------------------------------------------------------
   The one section on the page that is read rather than scanned, so it is
   typeset like a printed page rather than laid out like a web block:

     a folio        the running head, whose rule fills as the letter is read
     a portrait     held still on desktop while the letter moves past it,
                    layered over a keyline, a colour field that runs off the
                    page, and the one dark plate on the homepage
     a pull quote   set in two tones - the setup quiet, the claim in ink -
                    under a hung quotation mark
     the letter     two columns and a drop cap, then a signature line

   Everything moves through the shared vocabulary in `lib/motion`: the
   portrait is printed, its layers drift at three different speeds, the quote
   arrives line by line and the underline is drawn after it.
   ========================================================================== */

const initials = PRINCIPAL.name
  .replace(/^Dr\.?\s+/, '')
  .split(/\s+/)
  .map((word) => word[0])
  .join('');

export function HomePrincipal() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const quote = el.querySelector<HTMLElement>('.pm__quote');
    const letter = el.querySelector<HTMLElement>('.pm__letter');

    rise(el.querySelectorAll<HTMLElement>('.pm__folio > :not(.pm__folio-rule)'), {
      trigger: el,
      y: 14,
      stagger: 0.06,
    });
    // The running head doubles as a reading gauge for the letter below it.
    grow(el.querySelector<HTMLElement>('.pm__folio-fill'), { trigger: el, axis: 'x' });

    unmask(el.querySelector<HTMLElement>('.pm__fig'), { trigger: el, from: 'bottom', delay: 0.1 });
    drift(el.querySelector('.pm__fig img'), 56, { trigger: el });
    drift(el.querySelector('.pm__keyline'), -40, { trigger: el });
    drift(el.querySelector('.pm__wash'), 90, { trigger: el });
    rise(el.querySelector<HTMLElement>('.pm__since'), { trigger: el, y: 24, delay: 0.75 });

    rise(el.querySelector<HTMLElement>('.pm__glyph'), { trigger: el, y: 36 });
    if (quote) {
      lines(quote, { trigger: quote, stagger: 0.08 });
      draw(el, { trigger: quote, delay: 0.95 });
    }

    // The letter arrives as one block: its paragraphs are fragmented across
    // columns, and a transformed fragment is not something to rely on.
    rise(el.querySelectorAll<HTMLElement>('.pm__text, .pm__sign'), {
      trigger: letter,
      y: 30,
      stagger: 0.12,
    });
  }, []);

  return (
    <section ref={scope} className="pm" id="principal" aria-labelledby="pm-title">
      <div className="wrap">
        <header className="pm__folio">
          <span className="pm__folio-dot" aria-hidden="true" />
          <h2 className="pm__folio-label" id="pm-title">
            From the principal&rsquo;s office
          </h2>
          <span className="pm__folio-rule" aria-hidden="true">
            <span className="pm__folio-fill" />
          </span>
          <span className="pm__folio-aside meta">A letter to families</span>
        </header>

        <div className="pm__grid">
          <div className="pm__media">
            <span className="pm__wash" aria-hidden="true" />
            <div className="pm__frame">
              <span className="pm__keyline" aria-hidden="true" />
              <Figure
                photo={facultyImages[0]}
                width={640}
                sizes="(max-width: 999px) 80vw, 36vw"
                shape="arch"
                ratio="free"
                className="pm__fig"
              />
              <p className="pm__since">
                <span className="pm__since-label">Principal since</span>
                <span className="pm__since-year">{PRINCIPAL.since}</span>
              </p>
              <p className="pm__vert" aria-hidden="true">
                {PRINCIPAL.name} &middot; Principal
              </p>
            </div>
          </div>

          <div className="pm__head">
            <span className="pm__glyph" aria-hidden="true">
              &ldquo;
            </span>
            <blockquote className="pm__quote">
              <span className="pm__quote-setup">A school is not a building.</span> It is a
              community of people who believe in <Mark kind="underline">possibility.</Mark>
            </blockquote>
          </div>

          <div className="pm__letter">
            <div className="pm__text">
              {PRINCIPAL.letter.map((paragraph) => (
                <p key={paragraph.slice(0, 24)}>{paragraph}</p>
              ))}
            </div>

            <footer className="pm__sign">
              <div className="pm__who">
                <span className="pm__mono" aria-hidden="true">
                  {initials}
                </span>
                <span className="pm__who-text">
                  <span className="pm__name">{PRINCIPAL.name}</span>
                  <span className="meta">{PRINCIPAL.title}</span>
                </span>
              </div>

              <Link className="link pm__more" to={`${ROUTES.about}#principal`}>
                Read the full letter
                <Icon name="arrowRight" size={16} />
              </Link>
            </footer>
          </div>
        </div>
      </div>
    </section>
  );
}
