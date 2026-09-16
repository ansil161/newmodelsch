import { useState } from 'react';
import { EmptyState, LoadError, Pagination, Skeleton } from '@/components/console';
import { useResource } from '@/hooks/useResource';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import { cx, formatCount, formatPages } from '@/utils';
import { SearchInput } from './ListControls';

/**
 * The passages a version was split into, exactly as they are stored and
 * embedded — what the chatbot will actually read, not the original file.
 */
export function ChunkBrowser({ documentId, versions, activeVersion }) {
  const [version, setVersion] = useState(activeVersion ?? versions[0]?.number);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(new Set());

  const resource = useResource(
    (signal) => knowledgeBaseApi.chunks(documentId, { version, page, search }, signal),
    [documentId, version, page, search],
  );
  const chunks = resource.data?.results ?? [];

  const toggle = (id) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="c-stack">
      <div className="kb-toolbar">
        <div className="kb-toolbar__filters">
          <SearchInput
            value={search}
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
            label="Search passages"
            placeholder="Search the text of the passages"
          />
          {versions.length > 1 ? (
            <select
              className="c-input c-input--select c-input--compact"
              aria-label="Version"
              value={version ?? ''}
              onChange={(event) => {
                setVersion(Number(event.target.value));
                setPage(1);
              }}
            >
              {versions.map((item) => (
                <option key={item.id} value={item.number}>
                  Version {item.number}
                  {item.isActive ? ' (searchable)' : ''} · {formatCount(item.chunkCount)} passages
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {resource.error ? <LoadError error={resource.error} onRetry={resource.reload} /> : null}

      {resource.loading ? (
        <div className="c-stack c-stack--tight">
          <Skeleton height={90} />
          <Skeleton height={90} />
          <Skeleton height={90} />
        </div>
      ) : chunks.length === 0 && !resource.error ? (
        <EmptyState icon={search ? 'search' : 'layers'} title={search ? 'No passages match' : 'No passages yet'}>
          {search ? 'Try other words.' : 'Passages appear here once the document has been processed.'}
        </EmptyState>
      ) : (
        <ol className="kb-chunks">
          {chunks.map((chunk) => (
            <ChunkItem key={chunk.id} chunk={chunk} search={search} open={expanded.has(chunk.id)} onToggle={() => toggle(chunk.id)} />
          ))}
        </ol>
      )}

      {resource.data ? <Pagination info={resource.data.pagination} onPage={setPage} noun="passage" /> : null}
    </div>
  );
}

const LONG = 600;

function ChunkItem({ chunk, search, open, onToggle }) {
  const where = [formatPages(chunk.page, chunk.pages), chunk.section || chunk.heading].filter(Boolean).join(' · ');
  const long = chunk.content.length > LONG;
  return (
    <li className="kb-chunk">
      <div className="kb-chunk__head">
        <span className="kb-chunk__index">#{chunk.index + 1}</span>
        {where ? <span className="kb-chunk__where">{where}</span> : null}
        <span className="kb-chunk__tokens">{formatCount(chunk.tokenCount)} tokens</span>
      </div>
      <p className={cx('kb-chunk__text', long && !open && 'is-clamped')}>{highlight(chunk.content, search)}</p>
      {long ? (
        <button type="button" className="kb-text-button" aria-expanded={open} onClick={onToggle}>
          {open ? 'Show less' : 'Show all'}
        </button>
      ) : null}
    </li>
  );
}

/** The searched-for words marked in the text. Text nodes only: nothing is parsed as HTML. */
function highlight(text, term) {
  if (!term) return text;
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  const parts = [];
  let from = 0;
  let found = lower.indexOf(needle);
  while (found !== -1) {
    if (found > from) parts.push(text.slice(from, found));
    parts.push(
      <mark key={found} className="kb-hit">
        {text.slice(found, found + needle.length)}
      </mark>,
    );
    from = found + needle.length;
    found = lower.indexOf(needle, from);
  }
  parts.push(text.slice(from));
  return parts;
}
