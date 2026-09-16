import { cx } from '@/utils';

const WEB_ADDRESS = /^https?:\/\//i;

/**
 * A link to somewhere outside the console.
 *
 * Only an http(s) address becomes a link: a stored address is data, and a
 * `javascript:` one rendered as an href would run in the console's origin.
 * It opens in a new tab with no opener and no referrer.
 */
export function ExternalLink({ href, children, className }) {
  if (!WEB_ADDRESS.test(href)) return <span className={className}>{children ?? href}</span>;
  return (
    <a className={cx('c-link', className)} href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children ?? href}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
