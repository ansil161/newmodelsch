import { Link } from 'react-router-dom';
import { useGsapScope } from '@/hooks/useGsapScope';
import { draw, drift, lines, rise, settle, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Figure } from './Figure';
import { Sticker } from './primitives';

export function CTASection({
  sticker,
  title,
  lead,
  actions,
  photo,
  footnote,
  className = '',
  id,
}) {
  const scope = useGsapScope((_, el) => {
    const head = el.querySelector('.cta__title');
    const frame = el.querySelector('.cta__media');
    const image = el.querySelector('.cta__media img');

    if (head) lines(head, { trigger: el });
    draw(el, { trigger: el, delay: 0.6 });
    rise(el.querySelectorAll('[data-lift]'), { trigger: el, delay: 0.35, y: 22 });
    if (frame) unmask(frame, { trigger: el, from: 'bottom' });
    if (image) drift(image, 70, { trigger: el });

    // The buttons are magnetic. It is the one hover on the site with any
    // physics in it, and it is spent here because this is the one place the
    // page is asking for something.
    const teardowns = Array.from(el.querySelectorAll('.btn')).map((b) => settle(b));
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
