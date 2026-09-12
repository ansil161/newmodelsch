import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';
import { cx } from '@/utils';

/**
 * The console's controls. Squared, like the site's own buttons, and compact:
 * the marketing site's 56px buttons are statements, and a table row of them is
 * a wall. Ink is the primary action; the sun is reserved for the one action a
 * page exists for (upload, ask); red is only ever destructive.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'sun';
type Size = 'sm' | 'md';

interface Look {
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconEnd?: string;
  className?: string;
  children?: ReactNode;
}

function classes({ variant = 'secondary', size = 'md', className }: Look) {
  return cx('c-btn', `c-btn--${variant}`, size === 'sm' && 'c-btn--sm', className);
}

function Face({ icon, iconEnd, size = 'md', busy = false, children }: Look & { busy?: boolean }) {
  const glyph = size === 'sm' ? 15 : 17;
  return (
    <>
      {busy ? <span className="c-spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={glyph} /> : null}
      {children}
      {iconEnd ? <Icon name={iconEnd} size={glyph} /> : null}
    </>
  );
}

export interface ButtonProps extends Look, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  /** Disabled and spinning while the action it started is in flight. */
  busy?: boolean;
}

export function Button({ variant, size, icon, iconEnd, busy = false, className, children, type = 'button', disabled, ...rest }: ButtonProps) {
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

export function LinkButton({ variant, size, icon, iconEnd, className, children, ...rest }: Look & Omit<LinkProps, 'className' | 'children'>) {
  return (
    <Link className={classes({ variant, size, className })} {...rest}>
      <Face icon={icon} iconEnd={iconEnd} size={size}>
        {children}
      </Face>
    </Link>
  );
}

export function AnchorButton({ variant, size, icon, iconEnd, className, children, ...rest }: Look & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'>) {
  return (
    <a className={classes({ variant, size, className })} {...rest}>
      <Face icon={icon} iconEnd={iconEnd} size={size}>
        {children}
      </Face>
    </a>
  );
}

/** An icon with no visible text. The label is required: it is the button's name. */
export function IconButton({ icon, label, className, ...rest }: { icon: string; label: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button type="button" className={cx('c-icon-btn', className)} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={17} />
    </button>
  );
}
