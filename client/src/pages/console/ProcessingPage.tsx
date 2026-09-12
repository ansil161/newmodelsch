import { useState } from 'react';
import { Alert, EmptyState, LoadError, Pagination, Panel } from '@/components/console';
import { JobsTable } from '@/components/knowledge-base/JobsTable';
import { Segmented } from '@/components/knowledge-base/ListControls';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { useListParams } from '@/hooks/useListParams';
import { usePageMeta } from '@/hooks/usePageMeta';
import { usePolling } from '@/hooks/usePolling';
import { useResource } from '@/hooks/useResource';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import type { Job } from '@/types/knowledgeBase';

const FILTERS = [
  { value: 'active', label: 'In progress' },
  { value: 'failed', label: 'Failed' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'all', label: 'All' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];

const DEFAULTS = { status: 'active' } as const;
const STUCK_AFTER_MS = 2 * 60 * 1000;

const EMPTY: Record<Filter, [string, string]> = {
  active: ['Nothing in progress', 'Every document has been processed.'],
  failed: ['No failed jobs', 'Nothing has failed here.'],
  succeeded: ['No finished jobs yet', 'Jobs appear here once they complete.'],
  all: ['No jobs yet', 'Uploading a document or adding a source starts one.'],
};

/** Queued jobs nothing has picked up: the worker is probably not running. */
function waitingTooLong(jobs: Job[], now: number): boolean {
  return jobs.some(
    (job) =>
      job.status === 'queued' &&
      !job.cancelRequested &&
      (!job.runAfter || new Date(job.runAfter).getTime() <= now) &&
      now - new Date(job.createdAt).getTime() > STUCK_AFTER_MS,
  );
}

export function ProcessingPage() {
  const { knowledgeBase } = useKnowledgeBase();
  usePageMeta({ title: `Processing - ${knowledgeBase.name}`, description: 'Background processing for this knowledge base.' });
  const { values, page, update, setPage } = useListParams(DEFAULTS);
  const filter: Filter = FILTERS.some((item) => item.value === values.status) ? (values.status as Filter) : 'active';
  // When the list last arrived: what "waiting for two minutes" is measured against.
  const [checkedAt, setCheckedAt] = useState(() => Date.now());

  const resource = useResource(
    async (signal) => {
      const result = await knowledgeBaseApi.jobs(knowledgeBase.id, { status: filter === 'all' ? undefined : filter, page }, signal);
      setCheckedAt(Date.now());
      return result;
    },
    [knowledgeBase.id, filter, page],
  );
  const jobs = resource.data?.results ?? [];
  const running = jobs.some((job) => job.status === 'queued' || job.status === 'running');
  usePolling(resource.reload, 3000, running || filter === 'active');

  const [emptyTitle, emptyText] = EMPTY[filter];

  return (
    <div className="c-stack">
      <div className="kb-toolbar">
        <Segmented label="Show jobs" options={FILTERS} value={filter} onChange={(value) => update({ status: value })} />
        <p className="c-small c-muted kb-toolbar__note">
          Uploads, re-indexing and deletions run in the background. A temporary failure is retried automatically.
        </p>
      </div>

      {waitingTooLong(jobs, checkedAt) ? (
        <Alert tone="warn" title="Jobs are waiting longer than expected">
          Nothing has picked them up for over two minutes. Check that the document worker is running (
          <code>manage.py process_documents</code>).
        </Alert>
      ) : null}

      {resource.error ? <LoadError error={resource.error} onRetry={resource.reload} /> : null}

      <Panel flush>
        <JobsTable jobs={jobs} knowledgeBaseId={knowledgeBase.id} loading={resource.loading} caption={`Jobs for ${knowledgeBase.name}`} />
        {!resource.loading && !resource.error && jobs.length === 0 ? (
          <EmptyState icon={filter === 'failed' || filter === 'active' ? 'check' : 'activity'} title={emptyTitle}>
            {emptyText}
          </EmptyState>
        ) : null}
        {resource.data ? <Pagination info={resource.data.pagination} onPage={setPage} noun="job" /> : null}
      </Panel>
    </div>
  );
}
