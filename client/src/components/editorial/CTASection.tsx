import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { draw, drift, lines, rise, settle, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Figure } from './Figure';
import { Sticker } from './primitives';

/* ==========================================================================
   CTA SECTION - the ask
   --------------------------------------------------------------------------
   The last thing on a page. One statement, one primary action, one secondary
   action, and nothing else - which is the whole design.

   The temptation in a closing section is to re-sell: three more reasons, a
   testimonial, a statistic, a second form. Every one of those gives a reader
   who has already decided something new to think about, and a reader who has
   not decided is not going to be convinced by the fourth restatement. So this
   section holds exactly one idea and two buttons.

   The photograph is a band behind the type rather than a panel beside it,
   because a closing section that splits attention across a grid is a closing
   section that does not close. It sits under a white wash, so the section is
   on the same white ground as the rest of the page.
   ========================================================================== */

interface Action {
  label: string;
  /** An internal route. Use `href` for a phone number or an external link. */
  to?: string;
  href?: string;
  variant?: 'primary' | 'sun' | 'secondary';
}

interface CTASectionProps {
  sticker?: string;
  title: ReactNode;
  lead?: ReactNode;
  actions: Action[];
  /** The band behind the type. Omit for the quiet version on plain white. */
  photo?: Photo;
  /** A short line under the buttons - opening hours, a deadline, a phone. */
  footnote?: ReactNode;
  className?: string;
  id?: string;
}

export function CTASection({
  sticker,
  title,
  lead,
  actions,
  photo,
  footnote,
  className = '',
  id,
}: CTASectionProps) {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const head = el.querySelector<HTMLElement>('.cta__title');
    const frame = el.querySelector<HTMLElement>('.cta__media');
    const image = el.querySelector<HTMLElement>('.cta__media img');

    if (head) lines(head, { trigger: el });
    draw(el, { trigger: el, delay: 0.6 });
    rise(el.querySelectorAll<HTMLElement>('[data-lift]'), { trigger: el, delay: 0.35, y: 22 });
    if (frame) unmask(frame, { trigger: el, from: 'bottom' });
    if (image) drift(image, 70, { trigger: el });

    // The buttons are magnetic. It is the one hover on the site with any
    // physics in it, and it is spent here because this is the one place the
    // page is asking for something.
    const teardowns = Array.from(el.querySelectorAll<HTMLElement>('.btn')).map((b) => settle(b));
    return () => teardowns.forEach((fn) => fn?.());
  }, []);

  return (
    <section ref={scope} id={id} className={`cta ${className}`.trim()}>
      {photo ? (
        <div className="cta__media" aria-hidden="true">
          <Figure photo={photo} width={1800} sizes="100vw" shape="square" ratio="free" decorative />
          <span className="cta__scrim" />
        </div>
      ) : null}

      <div className="cta__inner wrap">
        {sticker ? (
          <div data-lift>
            <Sticker tone="sun" tilt={-2}>
              {sticker}
            </Sticker>
          </div>
        ) : null}

        <h2 className="cta__title ed-hero">{title}</h2>

        {lead ? (
          <p className="lead cta__lead" data-lift>
            {lead}
          </p>
        ) : null}

        <div className="cta__actions" data-lift>
          {actions.map((action) => {
            const cls = `btn btn-${action.variant ?? 'sun'}`;
            const inner = (
              <span className="btn__label">
                {action.label}
                <Icon name="arrowRight" size={17} />
              </span>
            );
            return action.to ? (
              <Link className={cls} to={action.to} key={action.label}>
                {inner}
              </Link>
            ) : (
              <a className={cls} href={action.href} key={action.label}>
                {inner}
              </a>
            );
          })}
        </div>

        {footnote ? (
          <p className="cta__foot meta" data-lift>
            {footnote}
          </p>
        ) : null}
      </div>
    </section>
  );
}
