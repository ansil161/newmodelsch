import './PageFallback.css';

/**
 * Shown while a lazily-loaded page chunk arrives. It reserves a full viewport
 * so the footer does not flash up under the navigation during the swap.
 */
export function PageFallback() {
  return (
    <div className="page-fallback" role="status" aria-live="polite">
      <span className="page-fallback__bar" aria-hidden="true" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}
