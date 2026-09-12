import { Link } from 'react-router-dom';
import { CONSOLE_ROUTES } from '@/constants/console';
import type { RagSource } from '@/types/knowledgeBase';
import { cx, displayUrl, formatPages, formatScore } from '@/utils';
import { ExternalLink } from './ExternalLink';

/** The id a citation button scrolls to. */
export const sourceAnchor = (prefix: string, number: number) => `${prefix}-source-${number}`;

/** The passages an answer was allowed to use, numbered as the answer cites them. */
export function SourceList({
  sources,
  prefix,
  knowledgeBaseId,
  highlighted,
}: {
  sources: RagSource[];
  prefix: string;
  knowledgeBaseId: string;
  highlighted?: number | null;
}) {
  const ordered = [...sources].sort((a, b) => a.citationNumber - b.citationNumber);
  return (
    <ol className="kb-sources">
      {ordered.map((source) => {
        const where = [formatPages(source.page, source.pages), source.section || source.heading].filter(Boolean).join(' · ');
        return (
          <li
            key={source.chunkId}
            id={sourceAnchor(prefix, source.citationNumber)}
            tabIndex={-1}
            className={cx('kb-source', highlighted === source.citationNumber && 'is-highlighted')}
          >
            <span className="kb-source__num">
              <span className="sr-only">Source </span>
              {source.citationNumber}
            </span>
            <div className="kb-source__body">
              <p className="kb-source__title">
                <Link className="c-link" to={CONSOLE_ROUTES.document(knowledgeBaseId, source.documentId)}>
                  {source.documentName}
                </Link>
                {source.documentVersion ? <span className="c-muted"> · version {source.documentVersion}</span> : null}
              </p>
              {where || source.sourceUrl ? (
                <p className="kb-source__where">
                  {where}
                  {where && source.sourceUrl ? ' · ' : null}
                  {source.sourceUrl ? <ExternalLink href={source.sourceUrl}>{displayUrl(source.sourceUrl)}</ExternalLink> : null}
                </p>
              ) : null}
              <blockquote className="kb-source__excerpt">{source.excerpt}</blockquote>
            </div>
            <span className="kb-source__score" title="Relevance score">
              {formatScore(source.score)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
