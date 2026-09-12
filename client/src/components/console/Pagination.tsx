import type { Pagination as PageInfo } from '@/types/knowledgeBase';
import { formatCount } from '@/utils';
import { Button } from './Button';

export function Pagination({ info, onPage, noun = 'item' }: { info: PageInfo; onPage: (page: number) => void; noun?: string }) {
  if (info.total === 0) return null;
  const first = (info.page - 1) * info.pageSize + 1;
  const last = Math.min(info.page * info.pageSize, info.total);
  return (
    <nav className="c-pagination" aria-label="Pages">
      <p className="c-pagination__summary" aria-live="polite">
        {formatCount(first)}–{formatCount(last)} of {formatCount(info.total)} {info.total === 1 ? noun : `${noun}s`}
      </p>
      {info.totalPages > 1 ? (
        <div className="c-pagination__buttons">
          <Button size="sm" icon="arrowLeft" onClick={() => onPage(info.page - 1)} disabled={info.page <= 1}>
            Previous
          </Button>
          <span className="c-pagination__page">
            Page {info.page} of {info.totalPages}
          </span>
          <Button size="sm" iconEnd="arrowRight" onClick={() => onPage(info.page + 1)} disabled={info.page >= info.totalPages}>
            Next
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
