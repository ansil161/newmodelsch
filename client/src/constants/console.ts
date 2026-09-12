import type {
  DocumentStatus,
  HealthStatus,
  JobKind,
  JobStatus,
  Role,
  SourceType,
  SupportLevel,
} from '@/types/knowledgeBase';
import { AUTH_ROUTES } from './index';

/**
 * The admin console: its routes and the words it uses for things.
 *
 * Nested under the signed-in landing, so everything behind sign-in shares one
 * prefix and one ProtectedRoute.
 */
const base = AUTH_ROUTES.dashboard;
const kb = (id: string) => `${base}/knowledge-base/${id}`;

export const CONSOLE_ROUTES = {
  home: base,
  knowledgeBases: `${base}/knowledge-base`,
  knowledgeBase: kb,
  documents: (id: string) => `${kb(id)}/documents`,
  document: (id: string, documentId: string) => `${kb(id)}/documents/${documentId}`,
  sources: (id: string) => `${kb(id)}/sources`,
  processing: (id: string) => `${kb(id)}/processing`,
  test: (id: string) => `${kb(id)}/test`,
  settings: (id: string) => `${kb(id)}/settings`,
} as const;

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  editor: 'Editor',
  viewer: 'Viewer',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  uploaded: 'Uploaded',
  queued: 'Queued',
  processing: 'Processing',
  indexing: 'Indexing',
  ready: 'Ready',
  failed: 'Failed',
  deleting: 'Deleting',
};

/** Statuses a document leaves on its own. While any is on screen, the page polls. */
export const TRANSIENT_STATUSES: ReadonlySet<DocumentStatus> = new Set([
  'uploaded',
  'queued',
  'processing',
  'indexing',
  'deleting',
]);

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const JOB_KIND_LABELS: Record<JobKind, string> = {
  ingest: 'Process',
  reindex: 'Re-index',
  delete_document: 'Delete',
  delete_knowledge_base: 'Delete knowledge base',
};

export const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word',
  txt: 'Text',
  md: 'Markdown',
  csv: 'CSV',
  json: 'JSON',
  html: 'Web page',
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  file: 'File',
  url: 'Web page',
  text: 'Text',
};

export const SUPPORT_LABELS: Record<SupportLevel, string> = {
  SUPPORTED: 'Supported by sources',
  PARTIALLY_SUPPORTED: 'Partly supported',
  INSUFFICIENT_CONTEXT: 'Not enough in the knowledge base',
};

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Out of sync',
  unavailable: 'Unreachable',
  empty: 'Empty',
  attention: 'Needs attention',
};

/** What the file picker offers. The server decides what it accepts. */
export const UPLOAD_ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.csv,.json';
export const UPLOAD_TYPES_LABEL = 'PDF, Word (.docx), text, Markdown, CSV or JSON';
export const MAX_UPLOAD_MB = 25;

/** Audit actions, as a sentence fragment after the actor's name. */
export const ACTIVITY_LABELS: Record<string, string> = {
  'knowledge_base.created': 'created the knowledge base',
  'knowledge_base.updated': 'updated the settings',
  'knowledge_base.deleted': 'deleted the knowledge base',
  'document.uploaded': 'uploaded',
  'document.updated': 'edited',
  'document.deleted': 'deleted',
  'document.reprocessed': 'reprocessed',
  'document.retried': 'retried',
  'document.cancelled': 'cancelled processing of',
  'document.cancel_requested': 'asked to cancel',
  'document.version_uploaded': 'uploaded a new version of',
  'document.version_restored': 'restored an earlier version of',
  'source.added': 'added',
  'source.deleted': 'removed the source',
  'source.synced': 'refreshed',
};
