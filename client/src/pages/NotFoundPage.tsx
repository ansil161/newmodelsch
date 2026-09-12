import { Link } from 'react-router-dom';
import { NAV_LINKS, ROUTES } from '@/constants';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Icon } from '@/components/common/Icon';
import { Mark, Sticker } from '@/components/editorial';
import './NotFoundPage.css';

/**
 * 404.
 *
 * A person here followed a link that no longer resolves, so the page's job is
 * to get them back out - which means the whole sitemap, printed, rather than a
 * large number and a "go home" button. Six destinations is few enough to just
 * list them all.
 */
export function NotFoundPage() {
  usePageMeta({
    title: 'Page not found - New Model High School',
    description: 'That page does not exist. Every page on the site is listed here.',
  });

  return (
    <section className="nf">
      <div className="wrap nf__inner">
        <Sticker tone="coral" tilt={-2.4}>
          404
        </Sticker>

        <h1 className="ed-hero nf__title">
          That page is not <Mark kind="underline">here.</Mark>
        </h1>

        <p className="lead nf__lead">
          The link may be from an older version of the site. Everything the school publishes is on
          one of these six pages.
        </p>

        <ol className="nf__list">
          {NAV_LINKS.map((link, i) => (
            <li key={link.href}>
              <Link className="nf__link" to={link.href}>
                <span className="nf__num meta">{String(i + 1).padStart(2, '0')}</span>
                <span className="nf__label">{link.label}</span>
                <span className="nf__blurb">{link.blurb}</span>
                <Icon name="arrowRight" size={16} />
              </Link>
            </li>
          ))}
        </ol>

        <Link className="btn btn-primary nf__cta" to={ROUTES.home}>
          <span className="btn__label">
            Back to the start
            <Icon name="arrowRight" size={16} />
          </span>
        </Link>
      </div>
    </section>
  );
}
