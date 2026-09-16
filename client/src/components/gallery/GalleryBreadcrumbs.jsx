import { Link } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';

export function GalleryBreadcrumbs({ back, trail }) {
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
