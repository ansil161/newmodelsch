import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ConfirmDialog, EmptyState, IconButton, LoadError, Pagination, Panel, SkeletonRows, StatusBadge } from '@/components/console';
import { AddSourceDialog } from '@/components/knowledge-base/AddSourceDialog';
import { ExternalLink } from '@/components/knowledge-base/ExternalLink';
import { SearchInput } from '@/components/knowledge-base/ListControls';
import { CONSOLE_ROUTES, SOURCE_TYPE_LABELS, TRANSIENT_STATUSES } from '@/constants/console';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { useListParams } from '@/hooks/useListParams';
import { usePageMeta } from '@/hooks/usePageMeta';
import { usePolling } from '@/hooks/usePolling';
import { useResource } from '@/hooks/useResource';
import { useToast } from '@/hooks/useToast';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import { displayUrl, formatDateTime, formatRelative } from '@/utils';

const DEFAULTS = { q: '', type: '' };
const COLUMNS = 5;

/**
 * Where documents come from. A file source is created by an upload; a web
 * page or pasted text is added here. Each source has one document, and a
 * web page can be fetched again to pick up changes.
 */
export function SourcesPage() {
  const { knowledgeBase, canEdit } = useKnowledgeBase();
  usePageMeta({ title: `Sources - ${knowledgeBase.name}`, description: 'Where the documents in this knowledge base come from.' });
  const toast = useToast();
  const { values, page, update, setPage } = useListParams(DEFAULTS);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [syncing, setSyncing] = useState(null);

  const resource = useResource(
    (signal) => knowledgeBaseApi.sources(knowledgeBase.id, { type: values.type, search: values.q, page }, signal),
    [knowledgeBase.id, values.q, values.type, page],
  );
  const sources = resource.data?.results ?? [];
  usePolling(resource.reload, 3000, sources.some((source) => source.document && TRANSIENT_STATUSES.has(source.document.status)));

  const sync = async (source) => {
    setSyncing(source.id);
    try {
      await knowledgeBaseApi.syncSource(source.id);
      toast.success('Fetching the page again', source.name);
      resource.reload();
    } catch (error) {
      toast.error('Could not fetch the page', error instanceof Error ? error.message : undefined);
    } finally {
      setSyncing(null);
    }
  };

  const filtered = Boolean(values.q || values.type);

  return (
    <div className="c-stack">
      <div className="kb-toolbar">
        <div className="kb-toolbar__filters">
          <SearchInput value={values.q} onSearch={(value) => update({ q: value })} label="Search sources" placeholder="Search names and addresses" />
          <select
            className="c-input c-input--select c-input--compact"
            aria-label="Filter by kind"
            value={values.type}
            onChange={(event) => update({ type: event.target.value })}
          >
            <option value="">All kinds</option>
            {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {canEdit ? (
          <div className="kb-toolbar__actions">
            <Button variant="sun" icon="plus" onClick={() => setAdding(true)}>
              Add source
            </Button>
          </div>
        ) : null}
      </div>

      {resource.error ? <LoadError error={resource.error} onRetry={resource.reload} /> : null}

      <Panel flush>
        <div className="c-table-wrap">
          <table className="c-table">
            <caption className="sr-only">Sources in {knowledgeBase.name}</caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Document</th>
                <th scope="col">Last fetched</th>
                <th scope="col">Added</th>
                <th scope="col" className="is-actions">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {resource.loading ? (
                <SkeletonRows columns={COLUMNS} />
              ) : (
                sources.map((source) => {
                  const document = source.document;
                  const working = Boolean(document && TRANSIENT_STATUSES.has(document.status));
                  return (
                    <tr key={source.id}>
                      <td>
                        <div className="c-cell-title">
                          <strong>{source.name || SOURCE_TYPE_LABELS[source.sourceType]}</strong>
                          <span>
                            {SOURCE_TYPE_LABELS[source.sourceType]}
                            {source.url ? (
                              <>
                                {' · '}
                                <ExternalLink href={source.url}>{displayUrl(source.url)}</ExternalLink>
                              </>
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td>
                        {document ? (
                          <div className="kb-status-cell">
                            <Link className="c-link" to={CONSOLE_ROUTES.document(knowledgeBase.id, document.id)}>
                              {document.title}
                            </Link>
                            <StatusBadge status={document.status} />
                          </div>
                        ) : (
                          <span className="c-muted">—</span>
                        )}
                      </td>
                      <td>
                        {source.sourceType === 'url' && source.lastSyncedAt ? (
                          <time dateTime={source.lastSyncedAt} title={formatDateTime(source.lastSyncedAt)}>
                            {formatRelative(source.lastSyncedAt)}
                          </time>
                        ) : (
                          <span className="c-muted">—</span>
                        )}
                      </td>
                      <td>
                        <time dateTime={source.createdAt} title={formatDateTime(source.createdAt)}>
                          {formatRelative(source.createdAt)}
                        </time>
                      </td>
                      <td className="is-actions">
                        {canEdit ? (
                          <div className="kb-row-actions">
                            {source.sourceType === 'url' ? (
                              <Button
                                size="sm"
                                icon="refresh"
                                busy={syncing === source.id}
                                disabled={syncing !== null || working || document?.status === 'deleting'}
                                onClick={() => sync(source)}
                              >
                                Fetch again
                              </Button>
                            ) : null}
                            <IconButton
                              icon="trash"
                              label={`Remove ${source.name}`}
                              className="c-icon-btn--danger"
                              disabled={document?.status === 'deleting'}
                              onClick={() => setRemoving(source)}
                            />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!resource.loading && !resource.error && sources.length === 0 ? (
          <EmptyState
            icon="link"
            title={filtered ? 'No sources match' : 'No sources yet'}
            action={
              filtered ? (
                <Button icon="close" onClick={() => update({ q: '', type: '' })}>
                  Clear filters
                </Button>
              ) : canEdit ? (
                <Button variant="sun" icon="plus" onClick={() => setAdding(true)}>
                  Add a source
                </Button>
              ) : undefined
            }
          >
            {filtered
              ? 'Nothing here matches those filters.'
              : 'Add a public web page to keep it in the knowledge base, or paste text in directly. Uploaded files appear here too.'}
          </EmptyState>
        ) : null}

        {resource.data ? <Pagination info={resource.data.pagination} onPage={setPage} noun="source" /> : null}
      </Panel>

      <AddSourceDialog open={adding} knowledgeBaseId={knowledgeBase.id} onClose={() => setAdding(false)} onAdded={resource.reload} />
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Remove this source?"
        confirmLabel="Remove source"
        message={
          <p>
            <strong>{removing?.name}</strong> and the document made from it are deleted, with its passages in the search
            index. This cannot be undone.
          </p>
        }
        onConfirm={async () => {
          if (!removing) return;
          await knowledgeBaseApi.deleteSource(removing.id);
          toast.success('Removing source', removing.name);
          resource.reload();
        }}
      />
    </div>
  );
}
