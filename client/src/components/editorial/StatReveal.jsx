import { Icon } from '@/components/common/Icon';
import { useGsapScope } from '@/hooks/useGsapScope';
import { count, rise } from '@/lib/motion';

export function StatReveal({ items, layout = 'row', large = false, className = '' }) {
  // Keyed on the figures, not the array: a caller that maps its items inline
  // hands over a new array on every render, which would restart the reveal.
  const figures = items.map((item) => `${item.value}|${item.label}`).join('~');

  const scope = useGsapScope((_, el) => {
    const groups = el.querySelectorAll('.stat');
    rise(groups, { trigger: el, y: 22, stagger: 0.08 });
    count(el.querySelectorAll('.stat__value'), { trigger: el, delay: 0.15 });
  }, [figures]);

  return (
    <div className={`stats-frame ${className}`.trim()}>
      <dl ref={scope} className={`stats stats--${layout}${large ? ' stats--large' : ''}`}>
        {items.map((item) => (
          <div className="stat" key={item.label + item.value}>
            <dt className="sr-only">{item.label}</dt>
            <dd className="stat__body">
              {item.icon ? (
                <span className="stat__icon" aria-hidden="true">
                  <Icon name={item.icon} size={22} />
                </span>
              ) : null}
              <span className="stat-num stat__value">{item.value}</span>
              <span className="stat__label" aria-hidden="true">
                {item.label}
              </span>
              {item.detail ? <span className="stat__detail">{item.detail}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
