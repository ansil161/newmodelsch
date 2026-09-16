import { NavLink } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';
import { cx } from '@/utils';

/** The furniture every console page shares: a header, panels, tabs, figures. */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  badge,
}) {
  return (
    <header className="c-page-head">
      <div className="c-page-head__text">
        {eyebrow ? <p className="c-eyebrow">{eyebrow}</p> : null}
        <div className="c-page-head__title-row">
          <h1 className="c-title">{title}</h1>
          {badge}
        </div>
        {description ? <p className="c-page-head__desc">{description}</p> : null}
      </div>
      {actions ? <div className="c-page-head__actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  flush = false,
  id,
}) {
  return (
    <section className={cx('c-panel', flush && 'c-panel--flush', className)} aria-labelledby={title && id ? `${id}-title` : undefined}>
      {title || actions ? (
        <header className="c-panel__head">
          <div>
            {title ? (
              <h2 className="c-panel__title" id={id ? `${id}-title` : undefined}>
                {title}
              </h2>
            ) : null}
            {description ? <p className="c-panel__desc">{description}</p> : null}
          </div>
          {actions ? <div className="c-panel__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="c-panel__body">{children}</div>
    </section>
  );
}

export function StatTile({ label, value, detail, tone }) {
  return (
    <div className={cx('c-stat', tone && `c-stat--${tone}`)}>
      <span className="c-stat__label">{label}</span>
      <span className="c-stat__value">{value}</span>
      {detail ? <span className="c-stat__detail">{detail}</span> : null}
    </div>
  );
}

export function Tabs({ items, label }) {
  return (
    <nav className="c-tabs" aria-label={label}>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="c-tabs__link">
          {item.icon ? <Icon name={item.icon} size={16} /> : null}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Label/value pairs, for a document's facts. */
export function Facts({ items }) {
  return (
    <dl className="c-facts">
      {items.map(([label, value]) => (
        <div key={label} className="c-facts__row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
