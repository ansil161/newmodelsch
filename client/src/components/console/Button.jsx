import { Link } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';
import { cx } from '@/utils';

function classes({ variant = 'secondary', size = 'md', className }) {
  return cx('c-btn', `c-btn--${variant}`, size === 'sm' && 'c-btn--sm', className);
}

function Face({ icon, iconEnd, size = 'md', busy = false, children }) {
  const glyph = size === 'sm' ? 15 : 17;
  return (
    <>
      {busy ? <span className="c-spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={glyph} /> : null}
      {children}
      {iconEnd ? <Icon name={iconEnd} size={glyph} /> : null}
    </>
  );
}

export function Button({ variant, size, icon, iconEnd, busy = false, className, children, type = 'button', disabled, ...rest }) {
  return (
    <button
      type={type}
      className={classes({ variant, size, className })}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      <Face icon={icon} iconEnd={iconEnd} size={size} busy={busy}>
        {children}
      </Face>
    </button>
  );
}

export function LinkButton({ variant, size, icon, iconEnd, className, children, ...rest }) {
  return (
    <Link className={classes({ variant, size, className })} {...rest}>
      <Face icon={icon} iconEnd={iconEnd} size={size}>
        {children}
      </Face>
    </Link>
  );
}

export function AnchorButton({ variant, size, icon, iconEnd, className, children, ...rest }) {
  return (
    <a className={classes({ variant, size, className })} {...rest}>
      <Face icon={icon} iconEnd={iconEnd} size={size}>
        {children}
      </Face>
    </a>
  );
}

/** An icon with no visible text. The label is required: it is the button's name. */
export function IconButton({ icon, label, className, ...rest }) {
  return (
    <button type="button" className={cx('c-icon-btn', className)} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={17} />
    </button>
  );
}
