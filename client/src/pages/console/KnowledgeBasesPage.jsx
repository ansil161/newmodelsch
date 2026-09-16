import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useResource } from '@/hooks/useResource';
import { useWorkspace } from '@/hooks/useWorkspace';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import { Badge, Button, EmptyState, LoadError, PageHeader, Skeleton } from '@/components/console';
import { CreateKnowledgeBaseDialog } from '@/components/knowledge-base/CreateKnowledgeBaseDialog';
import { NoWorkspace } from '@/components/knowledge-base/NoWorkspace';
import { CONSOLE_ROUTES } from '@/constants/console';
import { formatCount, formatRelative } from '@/utils';
import '@/components/knowledge-base/knowledge-base.css';

export function KnowledgeBasesPage() {
  usePageMeta({ title: 'Knowledge base - Admin console', description: 'The knowledge bases the chatbot answers from.' });
  const { workspace, status, error, reload } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const canCreate = workspace?.role === 'admin';

  return (
    <>
      <PageHeader
        eyebrow={workspace ? `Workspace · ${workspace.name}` : 'Admin console'}
        title="Knowledge base"
        description="Collections of documents the chatbot answers from. Each is searched on its own, and each can be switched into or out of the chatbot."
        actions={
          canCreate ? (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              New knowledge base
            </Button>
          ) : undefined
        }
      />

      {status === 'loading' ? <Skeleton height={140} /> : null}
      {status === 'error' && error ? <LoadError error={error} onRetry={reload} /> : null}
      {status === 'ready' && !workspace ? <NoWorkspace /> : null}
      {workspace ? <KnowledgeBaseGrid workspaceId={workspace.id} canCreate={canCreate} onCreate={() => setCreating(true)} /> : null}

      {workspace ? (
        <CreateKnowledgeBaseDialog
          open={creating}
          workspaceId={workspace.id}
          onClose={() => setCreating(false)}
          onCreated={(created) => navigate(CONSOLE_ROUTES.knowledgeBase(created.id))}
        />
      ) : null}
    </>
  );
}

function KnowledgeBaseGrid({ workspaceId, canCreate, onCreate }) {
  const resource = useResource((signal) => knowledgeBaseApi.list(workspaceId, signal), [workspaceId]);

  if (resource.error) return <LoadError error={resource.error} onRetry={resource.reload} />;
  if (resource.loading) {
    return (
      <div className="kb-cards">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} height={168} />
        ))}
      </div>
    );
  }

  const knowledgeBases = resource.data ?? [];
  if (knowledgeBases.length === 0) {
    return (
      <EmptyState
        icon="layers"
        title="No knowledge bases yet"
        action={canCreate ? <Button variant="primary" icon="plus" onClick={onCreate}>Create the first one</Button> : undefined}
      >
        {canCreate
          ? 'Create one for each body of knowledge the chatbot should draw on — admissions, the parent handbook, staff policies.'
          : 'An administrator of this workspace can create one.'}
      </EmptyState>
    );
  }

  return (
    <ul className="kb-cards">
      {knowledgeBases.map((item) => (
        <li key={item.id}>
          <KnowledgeBaseCard knowledgeBase={item} />
        </li>
      ))}
    </ul>
  );
}

function KnowledgeBaseCard({ knowledgeBase }) {
  const stats = knowledgeBase.stats;
  return (
    <Link to={CONSOLE_ROUTES.knowledgeBase(knowledgeBase.id)} className="kb-card">
      <span className="kb-card__head">
        <span className="kb-card__name">{knowledgeBase.name}</span>
        {knowledgeBase.status === 'deleting' ? (
          <Badge tone="muted">Deleting</Badge>
        ) : knowledgeBase.chatEnabled ? (
          <Badge tone="ok">In chatbot</Badge>
        ) : null}
      </span>
      <span className="kb-card__desc">{knowledgeBase.description || 'No description.'}</span>
      <span className="kb-card__stats">
        <span>
          <b>{formatCount(stats?.documents ?? 0)}</b> documents
        </span>
        <span>
          <b>{formatCount(stats?.chunks ?? 0)}</b> chunks
        </span>
        {stats?.processing ? (
          <span className="kb-card__busy">
            <b>{formatCount(stats.processing)}</b> processing
          </span>
        ) : null}
        {stats?.failed ? (
          <span className="kb-card__failed">
            <b>{formatCount(stats.failed)}</b> failed
          </span>
        ) : null}
      </span>
      <span className="kb-card__foot">Updated {formatRelative(knowledgeBase.updatedAt)}</span>
    </Link>
  );
}
