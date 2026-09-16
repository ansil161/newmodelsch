import { useMemo } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { KnowledgeBaseContext } from '@/hooks/useKnowledgeBase';
import { usePolling } from '@/hooks/usePolling';
import { useResource } from '@/hooks/useResource';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import { Alert, Badge, EmptyState, LinkButton, LoadError, PageHeader, Skeleton, Tabs } from '@/components/console';
import { CONSOLE_ROUTES } from '@/constants/console';
import '@/components/knowledge-base/knowledge-base.css';

/**
 * One knowledge base: its name, its sections, and the context every section
 * reads the knowledge base and the caller's role from.
 *
 * The role only decides which buttons are offered. Every action is authorised
 * by the server again, against the knowledge base's own workspace.
 */
export function KnowledgeBaseLayout() {
  const { knowledgeBaseId = '' } = useParams();
  const resource = useResource((signal) => knowledgeBaseApi.get(knowledgeBaseId, signal), [knowledgeBaseId]);
  const knowledgeBase = resource.data;

  // While it is being deleted, keep asking until the answer is "not found".
  usePolling(resource.reload, 4000, knowledgeBase?.status === 'deleting');

  const { reload, mutate } = resource;
  const value = useMemo(() => {
    if (!knowledgeBase) return null;
    const role = knowledgeBase.role ?? 'viewer';
    return {
      knowledgeBase,
      role,
      canEdit: (role === 'admin' || role === 'editor') && knowledgeBase.status === 'active',
      canAdmin: role === 'admin' && knowledgeBase.status === 'active',
      reload,
      // An update response carries neither the caller's role nor the counts:
      // keep the ones already here rather than dropping them.
      replace: (next) => mutate((current) => ({ ...current, ...next })),
    };
  }, [knowledgeBase, reload, mutate]);

  if (resource.loading) {
    return (
      <div className="c-stack">
        <Skeleton width="40%" height={36} />
        <Skeleton height={44} />
        <Skeleton height={220} />
      </div>
    );
  }

  if (resource.error || !value) {
    if (resource.error?.status === 404 || !resource.error) {
      return (
        <EmptyState
          icon="layers"
          title="Knowledge base not found"
          action={<LinkButton to={CONSOLE_ROUTES.knowledgeBases}>All knowledge bases</LinkButton>}
        >
          It may have been deleted, or it belongs to a workspace you are not a member of.
        </EmptyState>
      );
    }
    return <LoadError error={resource.error} onRetry={resource.reload} />;
  }

  const { knowledgeBase: current } = value;
  const tabs = [
    { to: CONSOLE_ROUTES.knowledgeBase(current.id), label: 'Overview', icon: 'grid', end: true },
    { to: CONSOLE_ROUTES.documents(current.id), label: 'Documents', icon: 'document' },
    { to: CONSOLE_ROUTES.sources(current.id), label: 'Sources', icon: 'link' },
    { to: CONSOLE_ROUTES.processing(current.id), label: 'Processing', icon: 'activity' },
    { to: CONSOLE_ROUTES.test(current.id), label: 'Test RAG', icon: 'flask' },
    { to: CONSOLE_ROUTES.settings(current.id), label: 'Settings', icon: 'settings' },
  ];

  return (
    <KnowledgeBaseContext value={value}>
      <PageHeader
        eyebrow={
          <>
            <Link to={CONSOLE_ROUTES.knowledgeBases}>Knowledge base</Link> / {current.name}
          </>
        }
        title={current.name}
        badge={
          current.status === 'deleting' ? (
            <Badge tone="muted">Deleting</Badge>
          ) : current.chatEnabled ? (
            <Badge tone="ok">In the chatbot</Badge>
          ) : (
            <Badge tone="muted">Not in the chatbot</Badge>
          )
        }
        description={current.description || undefined}
      />
      {current.status === 'deleting' ? (
        <div className="kb-banner">
          <Alert tone="warn" title="This knowledge base is being deleted">
            Its documents are being removed from the search index. Nothing here can be changed, and this page will
            say so when it is gone.
          </Alert>
        </div>
      ) : null}
      <Tabs items={tabs} label="Knowledge base sections" />
      <Outlet />
    </KnowledgeBaseContext>
  );
}
