import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';
import {
  Alert,
  AnchorButton,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Facts,
  LinkButton,
  LoadError,
  Panel,
  Skeleton,
  StageSteps,
  StatusBadge,
} from '@/components/console';
import { ChunkBrowser } from '@/components/knowledge-base/ChunkBrowser';
import { EditDocumentDialog } from '@/components/knowledge-base/EditDocumentDialog';
import { ExternalLink } from '@/components/knowledge-base/ExternalLink';
import { JobsTable } from '@/components/knowledge-base/JobsTable';
import { VersionUploadDialog } from '@/components/knowledge-base/VersionUploadDialog';
import { availableActions, useDocumentActions } from '@/components/knowledge-base/useDocumentActions';
import { CONSOLE_ROUTES, FILE_TYPE_LABELS, SOURCE_TYPE_LABELS, TRANSIENT_STATUSES } from '@/constants/console';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { usePageMeta } from '@/hooks/usePageMeta';
import { usePolling } from '@/hooks/usePolling';
import { useResource } from '@/hooks/useResource';
import { useToast } from '@/hooks/useToast';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import type { DocumentDetail, DocumentVersion } from '@/types/knowledgeBase';
import { displayUrl, formatBytes, formatCount, formatDateTime, formatRelative } from '@/utils';

/**
 * One document: where it came from, where it is in processing, every
 * version, the passages it became, and the jobs that made them.
 */
export function DocumentPage() {
  const { documentId = '' } = useParams();
  const { knowledgeBase, canEdit } = useKnowledgeBase();
  const navigate = useNavigate();
  const toast = useToast();

  const resource = useResource((signal) => knowledgeBaseApi.document(documentId, signal), [documentId]);
  const doc = resource.data;
  usePageMeta({
    title: `${doc?.title ?? 'Document'} - ${knowledgeBase.name}`,
    description: 'A document in the knowledge base.',
  });
  usePolling(resource.reload, 3000, Boolean(doc && TRANSIENT_STATUSES.has(doc.status)));

  const actions = useDocumentActions(
    () => resource.reload(),
    () => navigate(CONSOLE_ROUTES.documents(knowledgeBase.id)),
  );
  const [dialog, setDialog] = useState<'edit' | 'version' | null>(null);
  const [restoring, setRestoring] = useState<DocumentVersion | null>(null);

  if (resource.loading) {
    return (
      <div className="c-stack">
        <Skeleton width="45%" height={30} />
        <Skeleton height={180} />
        <Skeleton height={260} />
      </div>
    );
  }
  if (resource.error?.status === 404) {
    return (
      <EmptyState
        icon="document"
        title="Document not found"
        action={<LinkButton to={CONSOLE_ROUTES.documents(knowledgeBase.id)}>All documents</LinkButton>}
      >
        It may have been deleted.
      </EmptyState>
    );
  }
  if (resource.error) return <LoadError error={resource.error} onRetry={resource.reload} />;
  if (!doc) return null;

  // A document id pasted under the wrong knowledge base: show it where it lives.
  if (doc.knowledgeBase !== knowledgeBase.id) {
    return <Navigate to={CONSOLE_ROUTES.document(doc.knowledgeBase, doc.id)} replace />;
  }

  const allowed = availableActions(doc);
  const working = TRANSIENT_STATUSES.has(doc.status);
  const busy = actions.pending !== null;
  const latest = doc.versions.find((version) => version.number === doc.latestVersion) ?? doc.versions[0];

  return (
    <div className="c-stack">
      <div className="kb-doc-head">
        <div className="kb-doc-head__text">
          <Link className="kb-back" to={CONSOLE_ROUTES.documents(knowledgeBase.id)}>
            <Icon name="arrowLeft" size={15} />
            All documents
          </Link>
          <div className="kb-doc-head__title-row">
            <h2 className="kb-doc-head__title">{doc.title}</h2>
            <StatusBadge status={doc.status} />
          </div>
          <p className="c-small c-muted">
            {FILE_TYPE_LABELS[doc.fileType] ?? (doc.fileType.toUpperCase() || 'Unknown type')} ·{' '}
            {SOURCE_TYPE_LABELS[doc.sourceType]} · updated {formatRelative(doc.updatedAt)}
          </p>
        </div>
        <div className="kb-doc-head__actions">
          {latest?.hasFile ? (
            <AnchorButton size="sm" icon="download" href={knowledgeBaseApi.downloadUrl(doc.id)}>
              Download
            </AnchorButton>
          ) : null}
          {canEdit ? (
            <>
              {allowed.retry ? (
                <Button size="sm" variant="primary" icon="refresh" busy={actions.isPending(doc.id, 'retry')} disabled={busy} onClick={() => actions.run(doc, 'retry')}>
                  Retry
                </Button>
              ) : null}
              {allowed.cancel ? (
                <Button size="sm" icon="stop" busy={actions.isPending(doc.id, 'cancel')} disabled={busy} onClick={() => actions.run(doc, 'cancel')}>
                  Cancel processing
                </Button>
              ) : null}
              {allowed.reprocess ? (
                <Button size="sm" icon="refresh" busy={actions.isPending(doc.id, 'reprocess')} disabled={busy} onClick={() => actions.run(doc, 'reprocess')}>
                  {/* For a web page, reprocessing fetches it again first. */}
                  {doc.sourceType === 'url' ? 'Fetch & reprocess' : 'Reprocess'}
                </Button>
              ) : null}
              {doc.sourceType === 'file' && doc.status !== 'deleting' ? (
                <Button size="sm" icon="upload" disabled={working} onClick={() => setDialog('version')}>
                  New version
                </Button>
              ) : null}
              {doc.status !== 'deleting' ? (
                <Button size="sm" icon="edit" onClick={() => setDialog('edit')}>
                  Edit details
                </Button>
              ) : null}
              {allowed.delete ? (
                <Button size="sm" variant="ghost" icon="trash" className="kb-danger-text" disabled={busy} onClick={() => actions.askDelete(doc)}>
                  Delete
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {doc.status === 'failed' && doc.error ? (
        <Alert
          tone="error"
          title="Processing failed"
          action={
            canEdit ? (
              <Button size="sm" icon="refresh" busy={actions.isPending(doc.id, 'retry')} disabled={busy} onClick={() => actions.run(doc, 'retry')}>
                Retry
              </Button>
            ) : undefined
          }
        >
          {doc.error.message}
          {doc.isLive ? ` Version ${doc.activeVersion} is still being used for answers.` : ''}
        </Alert>
      ) : null}

      {doc.status === 'deleting' ? (
        <Alert tone="warn" title="Being deleted">
          Its passages are being removed from the search index.
        </Alert>
      ) : null}

      {doc.processing ? (
        <Panel title="Processing" description="This page updates by itself.">
          <StageSteps processing={doc.processing} source={doc.sourceType} />
          {doc.isLive ? (
            <p className="c-small c-muted kb-gap">Version {doc.activeVersion} keeps answering questions until this finishes.</p>
          ) : null}
        </Panel>
      ) : null}

      {latest && latest.warnings.length && !working ? (
        <Alert tone="warn" title="Processed with warnings">
          <ul className="kb-bullets">
            {latest.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="c-grid-2">
        <Panel title="Details">
          <DocumentFacts doc={doc} defaultLanguage={knowledgeBase.defaultLanguage} />
        </Panel>

        <Panel title="Versions" description="Only one version is searchable at a time." flush>
          <div className="c-table-wrap">
            <table className="c-table">
              <caption className="sr-only">Versions of {doc.title}</caption>
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="is-num">
                    Chunks
                  </th>
                  <th scope="col" className="is-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {doc.versions.map((version) => (
                  <tr key={version.id}>
                    <td>
                      <div className="c-cell-title">
                        <strong>Version {version.number}</strong>
                        <span>
                          {version.originalFilename || (version.sourceUrl ? displayUrl(version.sourceUrl) : '—')}
                          {version.fileSize ? ` · ${formatBytes(version.fileSize)}` : ''}
                        </span>
                        <span>
                          Added{' '}
                          <time dateTime={version.createdAt} title={formatDateTime(version.createdAt)}>
                            {formatRelative(version.createdAt)}
                          </time>
                        </span>
                        {version.error ? <p className="c-cell-error">{version.error.message}</p> : null}
                      </div>
                    </td>
                    <td>
                      <div className="kb-status-cell">
                        {version.isActive ? <Badge tone="ok">Searchable</Badge> : <StatusBadge status={version.status} />}
                        {version.embeddingModel ? (
                          <span className="c-small c-muted kb-model" title="Embedding model">
                            {version.embeddingModel}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="is-num">{version.chunkCount ? formatCount(version.chunkCount) : '—'}</td>
                    <td className="is-actions">
                      <div className="kb-row-actions">
                        {version.hasFile ? (
                          <AnchorButton
                            size="sm"
                            variant="ghost"
                            icon="download"
                            href={knowledgeBaseApi.downloadUrl(doc.id, version.number)}
                            aria-label={`Download version ${version.number}`}
                          >
                            File
                          </AnchorButton>
                        ) : null}
                        {canEdit && !version.isActive && version.hasFile && !working ? (
                          <Button size="sm" onClick={() => setRestoring(version)}>
                            Make searchable
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Passages" description="What the document was split into — exactly what the chatbot reads and cites.">
        <ChunkBrowser key={doc.activeVersion ?? 'none'} documentId={doc.id} versions={doc.versions} activeVersion={doc.activeVersion} />
      </Panel>

      <Panel title="Recent processing" flush>
        {doc.jobs.length ? (
          <JobsTable jobs={doc.jobs} knowledgeBaseId={knowledgeBase.id} showDocument={false} caption={`Recent jobs for ${doc.title}`} />
        ) : (
          <p className="kb-pad c-muted">Nothing has run for this document yet.</p>
        )}
      </Panel>

      {actions.dialog}
      <EditDocumentDialog open={dialog === 'edit'} document={doc} onClose={() => setDialog(null)} onSaved={resource.reload} />
      <VersionUploadDialog open={dialog === 'version'} document={doc} onClose={() => setDialog(null)} onUploaded={resource.reload} />
      <ConfirmDialog
        open={restoring !== null}
        onClose={() => setRestoring(null)}
        tone="primary"
        title={`Make version ${restoring?.number ?? ''} searchable?`}
        confirmLabel="Make searchable"
        message={
          <p>
            It is re-indexed and replaces {doc.activeVersion ? `version ${doc.activeVersion}` : 'the current version'} in answers
            once it is ready. You can switch back the same way.
          </p>
        }
        onConfirm={async () => {
          if (!restoring) return;
          await knowledgeBaseApi.activateVersion(doc.id, restoring.id);
          toast.success(`Restoring version ${restoring.number}`, doc.title);
          resource.reload();
        }}
      />
    </div>
  );
}

function DocumentFacts({ doc, defaultLanguage }: { doc: DocumentDetail; defaultLanguage: string }) {
  const latest = doc.versions.find((version) => version.number === doc.latestVersion);
  const origin =
    doc.sourceType === 'url' && doc.sourceUrl ? (
      <ExternalLink href={doc.sourceUrl}>{displayUrl(doc.sourceUrl)}</ExternalLink>
    ) : (
      latest?.originalFilename || SOURCE_TYPE_LABELS[doc.sourceType]
    );

  return (
    <Facts
      items={[
        ['Source', origin],
        ['Description', doc.description || '—'],
        ['Size', formatBytes(doc.fileSize)],
        ['Pages', doc.pageCount ? formatCount(doc.pageCount) : '—'],
        ['Passages', doc.chunkCount ? formatCount(doc.chunkCount) : '—'],
        ['Language', doc.language || `${defaultLanguage} (knowledge base default)`],
        ['Category', doc.category || '—'],
        [
          'Tags',
          doc.tags.length ? (
            <span className="kb-tags">
              {doc.tags.map((tag) => (
                <span key={tag} className="c-tag">
                  {tag}
                </span>
              ))}
            </span>
          ) : (
            '—'
          ),
        ],
        ['Author', doc.author || '—'],
        ['Searchable version', doc.activeVersion ? `Version ${doc.activeVersion}` : 'None yet'],
        ['Added by', doc.createdBy ? doc.createdBy.name || doc.createdBy.email : '—'],
        ['Added', formatDateTime(doc.createdAt)],
        ['Last indexed', formatDateTime(doc.indexedAt)],
      ]}
    />
  );
}
