import { Link } from 'react-router-dom';
import { ProgressBar, SkeletonRows, StatusBadge } from '@/components/console';
import { CONSOLE_ROUTES, JOB_KIND_LABELS } from '@/constants/console';
import type { Job } from '@/types/knowledgeBase';
import { formatCount, formatDateTime, formatDuration, formatRelative } from '@/utils';

/** Background work: what ran, how it went, and why it failed if it did. */
export function JobsTable({
  jobs,
  knowledgeBaseId,
  loading = false,
  showDocument = true,
  caption,
}: {
  jobs: Job[];
  knowledgeBaseId: string;
  loading?: boolean;
  showDocument?: boolean;
  caption: string;
}) {
  const columns = showDocument ? 6 : 5;
  return (
    <div className="c-table-wrap">
      <table className="c-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{showDocument ? 'Job' : 'Kind'}</th>
            <th scope="col">Status</th>
            <th scope="col" className="is-num">
              Attempts
            </th>
            <th scope="col">Started</th>
            <th scope="col" className="is-num">
              Took
            </th>
            {showDocument ? <th scope="col">Outcome</th> : null}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows columns={columns} rows={4} />
          ) : (
            jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <div className="c-cell-title">
                    <strong>{JOB_KIND_LABELS[job.kind] ?? job.kind}</strong>
                    {showDocument && job.documentTitle ? (
                      <span>
                        {job.document ? (
                          <Link className="c-link" to={CONSOLE_ROUTES.document(knowledgeBaseId, job.document)}>
                            {job.documentTitle}
                          </Link>
                        ) : (
                          job.documentTitle
                        )}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td>
                  <JobStatus job={job} />
                  {!showDocument ? <Outcome job={job} /> : null}
                </td>
                <td className="is-num">
                  {job.attempts}/{job.maxAttempts}
                </td>
                <td>
                  <time dateTime={job.startedAt ?? job.createdAt} title={formatDateTime(job.startedAt ?? job.createdAt)}>
                    {formatRelative(job.startedAt ?? job.createdAt)}
                  </time>
                </td>
                <td className="is-num">{formatDuration(job.durationMs)}</td>
                {showDocument ? (
                  <td>
                    <Outcome job={job} />
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function JobStatus({ job }: { job: Job }) {
  return (
    <div className="kb-status-cell">
      <StatusBadge status={job.status} />
      {job.status === 'running' ? (
        <ProgressBar processing={{ stage: job.stage, label: job.stageLabel, progress: job.progress }} />
      ) : null}
      {job.status === 'queued' && job.runAfter && new Date(job.runAfter).getTime() > Date.now() ? (
        <span className="c-small c-muted">Retrying {formatRelative(job.runAfter)}</span>
      ) : null}
      {job.cancelRequested && (job.status === 'queued' || job.status === 'running') ? (
        <span className="c-small c-muted">Cancelling…</span>
      ) : null}
    </div>
  );
}

function Outcome({ job }: { job: Job }) {
  if (job.error) return <p className="c-cell-error">{job.error.message}</p>;
  if (job.status !== 'succeeded') return null;
  if (job.result.unchanged) return <span className="c-small c-muted">Unchanged since the last fetch</span>;
  if (job.result.skipped) return <span className="c-small c-muted">Skipped: {job.result.skipped}</span>;
  if (job.result.chunks !== undefined) return <span className="c-small c-muted">{formatCount(job.result.chunks)} passages indexed</span>;
  return null;
}
