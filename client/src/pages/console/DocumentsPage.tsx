import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, EmptyState, LoadError, Pagination, Panel, ProgressBar, SkeletonRows, StatusBadge } from '@/components/console';
import { AddSourceDialog } from '@/components/knowledge-base/AddSourceDialog';
import { DocumentRowActions } from '@/components/knowledge-base/DocumentRowActions';
import { SearchInput, SortHeader } from '@/components/knowledge-base/ListControls';
import { UploadDialog } from '@/components/knowledge-base/UploadDialog';
import { useDocumentActions, type DocumentActions } from '@/components/knowledge-base/useDocumentActions';
import { CONSOLE_ROUTES, FILE_TYPE_LABELS, SOURCE_TYPE_LABELS, TRANSIENT_STATUSES } from '@/constants/console';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { useListParams } from '@/hooks/useListParams';
import { usePageMeta } from '@/hooks/usePageMeta';
import { usePolling } from '@/hooks/usePolling';
import { useResource } from '@/hooks/useResource';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import type { KbDocument, SourceType } from '@/types/knowledgeBase';
import { displayUrl, formatBytes, formatCount, formatDateTime, formatRelative } from '@/utils';

const PAGE_SIZE = 20;
const COLUMNS = 7;
const DEFAULTS = { q: '', status: '', type: '', source: '', sort: '-updated_at' } as const;

const STATUS_FILTERS: Array<[string, string]> = [
  ['', 'All statuses'],
  ['ready', 'Ready'],
  ['processing', 'Processing'],
  ['failed', 'Failed'],
  ['deleting', 'Deleting'],
];

export function DocumentsPage() {
  const { knowledgeBase, canEdit } = useKnowledgeBase();
  usePageMeta({ title: `Documents - ${knowledgeBase.name}`, description: 'The documents in this knowledge base.' });
  const { values, page, update, setPage } = useListParams(DEFAULTS);
  const { q, status, type, source, sort } = values;
  const [dialog, setDialog] = useState<'upload' | 'source' | null>(null);

  const resource = useResource(
    (signal) =>
      knowledgeBaseApi.documents(
        knowledgeBase.id,
        { search: q, status, type, source: source as SourceType | '', ordering: sort, page, pageSize: PAGE_SIZE },
        signal,
      ),
    [knowledgeBase.id, q, status, type, source, sort, page],
  );
  const documents = resource.data?.results ?? [];
  const working = documents.some((item) => TRANSIENT_STATUSES.has(item.status));
  usePolling(resource.reload, 3000, working);

  const actions = useDocumentActions(() => resource.reload());
  const filtered = Boolean(q || status || type || source);
  const sortBy = (ordering: string) => update({ sort: ordering });

  return (
    <div className="c-stack">
      <div className="kb-toolbar">
        <div className="kb-toolbar__filters">
          <SearchInput
            value={q}
            onSearch={(value) => update({ q: value })}
            label="Search documents"
            placeholder="Search titles, file names, addresses"
          />
          <select
            className="c-input c-input--select c-input--compact"
            aria-label="Filter by status"
            value={status}
            onChange={(event) => update({ status: event.target.value })}
          >
            {STATUS_FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="c-input c-input--select c-input--compact"
            aria-label="Filter by file type"
            value={type}
            onChange={(event) => update({ type: event.target.value })}
          >
            <option value="">All types</option>
            {Object.entries(FILE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="c-input c-input--select c-input--compact"
            aria-label="Filter by source"
            value={source}
            onChange={(event) => update({ source: event.target.value })}
          >
            <option value="">All sources</option>
            {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {filtered ? (
            <Button variant="ghost" size="sm" icon="close" onClick={() => update({ q: '', status: '', type: '', source: '' })}>
              Clear filters
            </Button>
          ) : null}
        </div>
        {canEdit ? (
          <div className="kb-toolbar__actions">
            <Button icon="link" onClick={() => setDialog('source')}>
              Add source
            </Button>
            <Button variant="sun" icon="upload" onClick={() => setDialog('upload')}>
              Upload
            </Button>
          </div>
        ) : null}
      </div>

      {resource.error ? <LoadError error={resource.error} onRetry={resource.reload} /> : null}

      <Panel flush>
        <div className="c-table-wrap">
          <table className="c-table">
            <caption className="sr-only">Documents in {knowledgeBase.name}</caption>
            <thead>
              <tr>
                <SortHeader field="title" label="Document" ordering={sort} onSort={sortBy} />
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <SortHeader field="chunk_count" label="Chunks" ordering={sort} onSort={sortBy} numeric descendingFirst />
                <SortHeader field="file_size" label="Size" ordering={sort} onSort={sortBy} numeric descendingFirst />
                <SortHeader field="updated_at" label="Updated" ordering={sort} onSort={sortBy} descendingFirst />
                <th scope="col" className="is-actions">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {resource.loading ? (
                <SkeletonRows columns={COLUMNS} />
              ) : (
                documents.map((item) => (
                  <DocumentRow key={item.id} item={item} knowledgeBaseId={knowledgeBase.id} canEdit={canEdit} actions={actions} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {!resource.loading && !resource.error && documents.length === 0 ? (
          filtered ? (
            <EmptyState
              icon="search"
              title="No documents match"
              action={
                <Button onClick={() => update({ q: '', status: '', type: '', source: '' })} icon="close">
                  Clear filters
                </Button>
              }
            >
              Nothing here matches those filters.
            </EmptyState>
          ) : (
            <EmptyState
              icon="document"
              title="No documents yet"
              action={
                canEdit ? (
                  <>
                    <Button variant="sun" icon="upload" onClick={() => setDialog('upload')}>
                      Upload documents
                    </Button>
                    <Button icon="link" onClick={() => setDialog('source')}>
                      Add a web page
                    </Button>
                  </>
                ) : undefined
              }
            >
              Upload handbooks, policies and FAQs, or add a web page. Each is split into passages the chatbot can
              search and cite.
            </EmptyState>
          )
        ) : null}

        {resource.data ? <Pagination info={resource.data.pagination} onPage={setPage} noun="document" /> : null}
      </Panel>

      {working ? (
        <p className="kb-live-note" role="status">
          <span className="kb-live-note__dot" aria-hidden="true" /> Some documents are still processing. This list updates by itself.
        </p>
      ) : null}

      {actions.dialog}
      <UploadDialog open={dialog === 'upload'} knowledgeBaseId={knowledgeBase.id} onClose={() => setDialog(null)} onUploaded={resource.reload} />
      <AddSourceDialog open={dialog === 'source'} knowledgeBaseId={knowledgeBase.id} onClose={() => setDialog(null)} onAdded={resource.reload} />
    </div>
  );
}

function DocumentRow({
  item,
  knowledgeBaseId,
  canEdit,
  actions,
}: {
  item: KbDocument;
  knowledgeBaseId: string;
  canEdit: boolean;
  actions: DocumentActions;
}) {
  const detail =
    item.sourceType === 'url'
      ? displayUrl(item.sourceUrl)
      : [item.category, ...item.tags.map((tag) => `#${tag}`)].filter(Boolean).join(' · ') || SOURCE_TYPE_LABELS[item.sourceType];
  const stillAnswering = item.isLive && item.status !== 'ready' && item.status !== 'deleting';

  return (
    <tr>
      <td>
        <div className="c-cell-title">
          <Link to={CONSOLE_ROUTES.document(knowledgeBaseId, item.id)}>{item.title}</Link>
          <span>{detail}</span>
        </div>
      </td>
      <td>
        <div className="c-cell-title">
          <span className="kb-type">{FILE_TYPE_LABELS[item.fileType] ?? (item.fileType.toUpperCase() || '—')}</span>
          <span>{SOURCE_TYPE_LABELS[item.sourceType]}</span>
        </div>
      </td>
      <td>
        <div className="kb-status-cell">
          <StatusBadge status={item.status} />
          {item.processing ? <ProgressBar processing={item.processing} /> : null}
          {item.status === 'failed' && item.error ? <p className="c-cell-error">{item.error.message}</p> : null}
          {stillAnswering ? <span className="c-small c-muted">Version {item.activeVersion} still answers</span> : null}
        </div>
      </td>
      <td className="is-num">{item.chunkCount ? formatCount(item.chunkCount) : '—'}</td>
      <td className="is-num">{formatBytes(item.fileSize)}</td>
      <td>
        <time dateTime={item.updatedAt} title={formatDateTime(item.updatedAt)}>
          {formatRelative(item.updatedAt)}
        </time>
      </td>
      <td className="is-actions">
        <DocumentRowActions document={item} actions={actions} canEdit={canEdit} />
      </td>
    </tr>
  );
}
