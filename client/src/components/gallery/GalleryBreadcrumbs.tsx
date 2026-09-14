import { Link } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';

/* ==========================================================================
   BREADCRUMBS - the way back up the archive
   --------------------------------------------------------------------------
   Two things, because they answer two questions. The back control is the
   large, obvious one - "take me up a level". The trail beside it says where
   in the archive this page sits, and the last crumb is the current page.
   ========================================================================== */

interface Crumb {
  label: string;
  to?: string;
}

interface GalleryBreadcrumbsProps {
  back: { label: string; to: string };
  trail: Crumb[];
}

export function GalleryBreadcrumbs({ back, trail }: GalleryBreadcrumbsProps) {
  return (
    <div className="gal-crumbs wrap">
      <Link className="gal-back" to={back.to}>
        <span className="gal-back__ring" aria-hidden="true">
          <Icon name="arrowLeft" size={15} />
        </span>
        {back.label}
      </Link>

      <nav aria-label="Breadcrumb" className="gal-crumbs__trail">
        <ol>
          {trail.map((crumb, i) => (
            <li key={`${crumb.label}-${i}`}>
              {crumb.to ? (
                <Link to={crumb.to}>{crumb.label}</Link>
              ) : (
                <span aria-current="page">{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
