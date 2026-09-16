import { Icon } from '@/components/common/Icon';
import { cx } from '@/utils';
import { Button } from './Button';

/** Loading, empty and error states — the parts of a screen nobody designs until they see them. */

export function Spinner({ label = 'Loading' }) {
  return (
    <span className="c-spinner c-spinner--block" role="status">
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ width = '100%', height = 14, className }) {
  const style = { width, height };
  return <span className={cx('c-skel', className)} style={style} aria-hidden="true" />;
}

/** Placeholder rows shaped like the table they stand in for. */
export function SkeletonRows({ rows = 5, columns }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} aria-hidden="true">
          {Array.from({ length: columns }, (_, column) => (
            <td key={column}>
              <Skeleton width={column === 0 ? '70%' : '50%'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function EmptyState({ icon = 'document', title, children, action }) {
  return (
    <div className="c-empty">
      <span className="c-empty__icon" aria-hidden="true">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="c-empty__title">{title}</h3>
      {children ? <div className="c-empty__text">{children}</div> : null}
      {action ? <div className="c-empty__action">{action}</div> : null}
    </div>
  );
}

const ALERT_ICONS = { error: 'alert', warn: 'alert', info: 'info', success: 'check' };

export function Alert({ tone = 'info', title, children, action }) {
  return (
    <div className={`c-alert c-alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={ALERT_ICONS[tone]} size={18} />
      <div className="c-alert__body">
        {title ? <strong className="c-alert__title">{title}</strong> : null}
        {children ? <div className="c-alert__text">{children}</div> : null}
      </div>
      {action ? <div className="c-alert__action">{action}</div> : null}
    </div>
  );
}

/** A request that failed, in the server's own words, with a way to try again. */
export function LoadError({ error, onRetry, title = 'This could not be loaded' }) {
  return (
    <Alert
      tone="error"
      title={title}
      action={onRetry ? <Button size="sm" icon="refresh" onClick={onRetry}>Try again</Button> : undefined}
    >
      {error.status === 0 ? 'The server could not be reached. Check your connection.' : error.message}
    </Alert>
  );
}
