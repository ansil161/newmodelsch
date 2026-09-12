import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Facts, LinkButton, LoadError, Panel, Skeleton, StatTile, toneFor } from '@/components/console';
import { ACTIVITY_LABELS, CONSOLE_ROUTES, HEALTH_LABELS, SOURCE_TYPE_LABELS } from '@/constants/console';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { usePageMeta } from '@/hooks/usePageMeta';
import { usePolling } from '@/hooks/usePolling';
import { useResource } from '@/hooks/useResource';
import { useToast } from '@/hooks/useToast';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import type { AuditEntry, Overview, SourceType } from '@/types/knowledgeBase';
import { formatCount, formatDateTime, formatDuration, formatRelative, plural } from '@/utils';

export function OverviewPage() {
  const { knowledgeBase, canEdit } = useKnowledgeBase();
  usePageMeta({ title: `${knowledgeBase.name} - Knowledge base`, description: 'The state of this knowledge base.' });
  const resource = useResource((signal) => knowledgeBaseApi.overview(knowledgeBase.id, signal), [knowledgeBase.id]);
  const overview = resource.data;
  usePolling(resource.reload, 5000, Boolean(overview && (overview.activeJobs > 0 || overview.counts.processing > 0)));

  if (resource.loading) {
    return (
      <div className="c-stack">
        <div className="c-stats">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <Skeleton key={key} height={96} />
          ))}
        </div>
        <div className="c-grid-2">
          <Skeleton height={220} />
          <Skeleton height={220} />
        </div>
      </div>
    );
  }
  if (resource.error) return <LoadError error={resource.error} onRetry={resource.reload} />;
  if (!overview) return null;

  const { counts } = overview;
  const byType = Object.entries(overview.sources.byType)
    .filter(([, count]) => count)
    .map(([type, count]) => `${formatCount(count ?? 0)} ${SOURCE_TYPE_LABELS[type as SourceType].toLowerCase()}`)
    .join(' · ');

  return (
    <div className="c-stack">
      {counts.documents === 0 ? <GetStarted knowledgeBaseId={knowledgeBase.id} canEdit={canEdit} /> : null}

      <div className="c-stats">
        <StatTile label="Documents" value={formatCount(counts.documents)} detail={`${formatCount(counts.live)} searchable`} />
        <StatTile label="Ready" value={formatCount(counts.ready)} tone="ok" />
        <StatTile
          label="Processing"
          value={formatCount(counts.processing)}
          tone={counts.processing ? 'busy' : undefined}
          detail={overview.activeJobs ? `${plural(overview.activeJobs, 'job')} queued or running` : undefined}
        />
        <StatTile label="Failed" value={formatCount(counts.failed)} tone={counts.failed ? 'err' : undefined} />
        <StatTile label="Passages" value={formatCount(counts.chunks)} detail="Chunks in the search index" />
        <StatTile label="Sources" value={formatCount(overview.sources.total)} detail={byType || undefined} />
      </div>

      <div className="c-grid-2">
        <HealthPanel overview={overview} />
        <QueriesPanel overview={overview} knowledgeBaseId={knowledgeBase.id} />
      </div>

      {overview.recentFailures.length ? (
        <Failures overview={overview} knowledgeBaseId={knowledgeBase.id} canEdit={canEdit} onChanged={resource.reload} />
      ) : null}

      <Panel title="Recent activity" description="Changes made in this knowledge base, newest first.">
        {overview.recentActivity.length ? (
          <ul className="kb-activity">
            {overview.recentActivity.map((entry) => (
              <ActivityItem key={entry.id} entry={entry} knowledgeBaseId={knowledgeBase.id} />
            ))}
          </ul>
        ) : (
          <p className="c-muted">Nothing yet.</p>
        )}
      </Panel>
    </div>
  );
}

function GetStarted({ knowledgeBaseId, canEdit }: { knowledgeBaseId: string; canEdit: boolean }) {
  return (
    <Panel title="Add the first documents" className="kb-start">
      <p className="kb-start__text">
        The chatbot can only answer from what is here. Upload the parent handbook, admissions guide or policies — PDF,
        Word, text, Markdown, CSV or JSON — or add a web page. Each is split into passages, indexed, and cited when
        used.
      </p>
      <div className="c-row">
        {canEdit ? (
          <LinkButton to={CONSOLE_ROUTES.documents(knowledgeBaseId)} variant="sun" icon="upload">
            Upload documents
          </LinkButton>
        ) : null}
        {canEdit ? (
          <LinkButton to={CONSOLE_ROUTES.sources(knowledgeBaseId)} icon="link">
            Add a web page
          </LinkButton>
        ) : null}
        <LinkButton to={CONSOLE_ROUTES.test(knowledgeBaseId)} variant="ghost" icon="flask">
          Test RAG
        </LinkButton>
      </div>
    </Panel>
  );
}

function HealthPanel({ overview }: { overview: Overview }) {
  const { health } = overview;
  return (
    <Panel
      title="Index health"
      description="What the search index holds, against what it should."
      actions={<Badge tone={toneFor(health.status)}>{HEALTH_LABELS[health.status]}</Badge>}
    >
      <p className="kb-health-message">{health.message}</p>
      <Facts
        items={[
          ['In the index', health.indexedPoints === null ? '—' : plural(health.indexedPoints, 'passage')],
          ['Expected', plural(health.expectedPoints, 'passage')],
          ['Last ingestion', overview.lastIngestionAt ? <span title={formatDateTime(overview.lastIngestionAt)}>{formatRelative(overview.lastIngestionAt)}</span> : 'Never'],
          ['Checked', formatRelative(health.checkedAt)],
        ]}
      />
    </Panel>
  );
}

function QueriesPanel({ overview, knowledgeBaseId }: { overview: Overview; knowledgeBaseId: string }) {
  const { queries } = overview;
  const parts = [
    { key: 'supported', label: 'Supported by sources', count: queries.supported },
    { key: 'partial', label: 'Partly supported', count: queries.partiallySupported },
    { key: 'insufficient', label: 'Not enough in the knowledge base', count: queries.insufficientContext },
    { key: 'errors', label: 'Errors', count: queries.errors },
  ];
  const total = Math.max(1, parts.reduce((sum, part) => sum + part.count, 0));

  return (
    <Panel title="Questions" description={`Chat and Test RAG, the last ${queries.periodDays} days. The questions themselves are not stored.`}>
      {queries.total === 0 ? (
        <p className="c-muted">
          No questions yet.{' '}
          <Link className="c-link" to={CONSOLE_ROUTES.test(knowledgeBaseId)}>
            Try one in Test RAG
          </Link>
          .
        </p>
      ) : (
        <div className="c-stack">
          <div className="kb-figures">
            <div>
              <span className="kb-figures__value">{formatCount(queries.total)}</span>
              <span className="kb-figures__label">questions</span>
            </div>
            <div>
              <span className="kb-figures__value">{formatDuration(queries.averageMs)}</span>
              <span className="kb-figures__label">average answer time</span>
            </div>
          </div>
          <div
            className="kb-bar"
            role="img"
            aria-label={parts.map((part) => `${part.label}: ${part.count}`).join(', ')}
          >
            {parts.map((part) =>
              part.count ? <span key={part.key} className={`kb-bar__part kb-bar__part--${part.key}`} style={{ width: `${(part.count / total) * 100}%` }} /> : null,
            )}
          </div>
          <ul className="kb-legend-list">
            {parts.map((part) => (
              <li key={part.key}>
                <span className={`kb-legend-list__swatch kb-bar__part--${part.key}`} aria-hidden="true" />
                <span>{part.label}</span>
                <b>{formatCount(part.count)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function Failures({
  overview,
  knowledgeBaseId,
  canEdit,
  onChanged,
}: {
  overview: Overview;
  knowledgeBaseId: string;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [retrying, setRetrying] = useState<string | null>(null);

  const retry = async (id: string, title: string) => {
    setRetrying(id);
    try {
      await knowledgeBaseApi.retry(id);
      toast.success('Trying again', title);
      onChanged();
    } catch (error) {
      toast.error('Could not retry', error instanceof Error ? error.message : undefined);
    } finally {
      setRetrying(null);
    }
  };

  return (
    <Panel
      title="Needs attention"
      description="Documents whose last processing failed."
      actions={
        <LinkButton size="sm" variant="ghost" to={`${CONSOLE_ROUTES.documents(knowledgeBaseId)}?status=failed`} iconEnd="arrowRight">
          All failed
        </LinkButton>
      }
    >
      <ul className="kb-failures">
        {overview.recentFailures.map((document) => (
          <li key={document.id} className="kb-failures__item">
            <div className="kb-failures__text">
              <Link className="c-link" to={CONSOLE_ROUTES.document(knowledgeBaseId, document.id)}>
                {document.title}
              </Link>
              <p className="c-cell-error">{document.error?.message ?? 'Processing failed.'}</p>
            </div>
            {canEdit ? (
              <Button size="sm" icon="refresh" busy={retrying === document.id} disabled={retrying !== null} onClick={() => retry(document.id, document.title)}>
                Retry
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ActivityItem({ entry, knowledgeBaseId }: { entry: AuditEntry; knowledgeBaseId: string }) {
  const who = entry.actor ? entry.actor.name || entry.actor.email : 'The system';
  const verb = ACTIVITY_LABELS[entry.action] ?? entry.action.replace(/[._]/g, ' ');
  const aboutKnowledgeBase = entry.targetType === 'knowledge_base';
  const linkable = entry.targetType === 'document' && entry.action !== 'document.deleted';

  return (
    <li className="kb-activity__item">
      <p>
        <strong>{who}</strong> {verb}
        {aboutKnowledgeBase || !entry.targetLabel ? null : (
          <>
            {' '}
            {linkable ? (
              <Link className="c-link" to={CONSOLE_ROUTES.document(knowledgeBaseId, entry.targetId)}>
                {entry.targetLabel}
              </Link>
            ) : (
              <em>{entry.targetLabel}</em>
            )}
          </>
        )}
      </p>
      <time dateTime={entry.createdAt} title={formatDateTime(entry.createdAt)}>
        {formatRelative(entry.createdAt)}
      </time>
    </li>
  );
}
