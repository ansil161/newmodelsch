import type { ReactNode } from 'react';
import { DOCUMENT_STATUS_LABELS, JOB_STATUS_LABELS } from '@/constants/console';
import type { DocumentStatus, JobStatus } from '@/types/knowledgeBase';
import { cx } from '@/utils';

export type Tone = 'ok' | 'err' | 'warn' | 'busy' | 'queued' | 'muted';

/**
 * Semantic colour only. Green is done, red is failed, the sun is working,
 * blue is waiting, grey is on its way out. A status is never shown by colour
 * alone: every badge carries its word.
 */
const TONES: Record<string, Tone> = {
  ready: 'ok',
  succeeded: 'ok',
  healthy: 'ok',
  SUPPORTED: 'ok',
  failed: 'err',
  degraded: 'err',
  unavailable: 'err',
  INSUFFICIENT_CONTEXT: 'err',
  attention: 'warn',
  PARTIALLY_SUPPORTED: 'warn',
  processing: 'busy',
  indexing: 'busy',
  running: 'busy',
  queued: 'queued',
  uploaded: 'queued',
  deleting: 'muted',
  cancelled: 'muted',
  empty: 'muted',
};

export function toneFor(status: string): Tone {
  return TONES[status] ?? 'muted';
}

export function Badge({ tone = 'muted', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('c-badge', `c-badge--${tone}`, className)}>{children}</span>;
}

export function StatusBadge({ status, label }: { status: DocumentStatus | JobStatus | string; label?: string }) {
  const text =
    label ??
    DOCUMENT_STATUS_LABELS[status as DocumentStatus] ??
    JOB_STATUS_LABELS[status as JobStatus] ??
    status;
  return <Badge tone={toneFor(status)}>{text}</Badge>;
}
