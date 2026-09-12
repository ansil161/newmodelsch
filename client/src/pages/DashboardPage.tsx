import { Link } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAuth } from '@/hooks/useAuth';
import { useResource } from '@/hooks/useResource';
import { useWorkspace } from '@/hooks/useWorkspace';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import { Mark } from '@/components/editorial';
import { LinkButton, LoadError, PageHeader, Panel, Skeleton, StatTile } from '@/components/console';
import { NoWorkspace } from '@/components/knowledge-base/NoWorkspace';
import { CONSOLE_ROUTES } from '@/constants/console';
import { formatCount, formatRelative } from '@/utils';
import '@/components/knowledge-base/knowledge-base.css';

/**
 * Where a sign-in lands: who is signed in, and the state of the knowledge
 * bases in their workspace at a glance, with the way into each.
 */
export function DashboardPage() {
  usePageMeta({ title: 'Dashboard - Admin console', description: 'The New Model High School admin console.' });
  const { user } = useAuth();
  const { workspace, status, error, reload } = useWorkspace();

  const firstName = user?.fullName.trim().split(/\s+/)[0] || user?.email || '';

  return (
    <>
      <PageHeader
        eyebrow="Admin console"
        title={
          <>
            Hello, <Mark kind="underline">{firstName}.</Mark>
          </>
        }
        description={user ? <>You are signed in as <strong>{user.email}</strong>.</> : undefined}
      />
      {status === 'loading' ? <Skeleton height={120} /> : null}
      {status === 'error' && error ? <LoadError error={error} onRetry={reload} /> : null}
      {status === 'ready' && !workspace ? <NoWorkspace /> : null}
      {workspace ? <WorkspaceSummary workspaceId={workspace.id} /> : null}
    </>
  );
}

function WorkspaceSummary({ workspaceId }: { workspaceId: string }) {
  const resource = useResource((signal) => knowledgeBaseApi.list(workspaceId, signal), [workspaceId]);
  const knowledgeBases = resource.data ?? [];
  const totals = knowledgeBases.reduce(
    (sum, item) => ({
      documents: sum.documents + (item.stats?.documents ?? 0),
      ready: sum.ready + (item.stats?.ready ?? 0),
      processing: sum.processing + (item.stats?.processing ?? 0),
      failed: sum.failed + (item.stats?.failed ?? 0),
      chunks: sum.chunks + (item.stats?.chunks ?? 0),
    }),
    { documents: 0, ready: 0, processing: 0, failed: 0, chunks: 0 },
  );

  if (resource.error) return <LoadError error={resource.error} onRetry={resource.reload} />;

  const figure = (value: number) => (resource.loading ? '–' : formatCount(value));

  return (
    <div className="c-stack">
      <div className="c-stats">
        <StatTile label="Knowledge bases" value={figure(knowledgeBases.length)} />
        <StatTile label="Documents" value={figure(totals.documents)} />
        <StatTile label="Ready" value={figure(totals.ready)} tone="ok" />
        <StatTile label="Processing" value={figure(totals.processing)} tone={totals.processing ? 'busy' : undefined} />
        <StatTile label="Failed" value={figure(totals.failed)} tone={totals.failed ? 'err' : undefined} />
        <StatTile label="Chunks indexed" value={figure(totals.chunks)} />
      </div>

      <Panel
        title="Knowledge bases"
        description="What the chatbot answers from."
        actions={
          <LinkButton to={CONSOLE_ROUTES.knowledgeBases} size="sm" iconEnd="arrowRight">
            All knowledge bases
          </LinkButton>
        }
      >
        {resource.loading ? (
          <Skeleton height={60} />
        ) : knowledgeBases.length === 0 ? (
          <p className="c-muted">
            No knowledge bases yet.{' '}
            <Link className="c-link" to={CONSOLE_ROUTES.knowledgeBases}>
              Create the first one
            </Link>{' '}
            to start adding documents.
          </p>
        ) : (
          <ul className="kb-mini-list">
            {knowledgeBases.slice(0, 6).map((item) => (
              <li key={item.id}>
                <Link className="kb-mini-list__item" to={CONSOLE_ROUTES.knowledgeBase(item.id)}>
                  <span className="kb-mini-list__name">{item.name}</span>
                  <span className="c-muted c-small">
                    {formatCount(item.stats?.documents ?? 0)} documents · updated {formatRelative(item.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
