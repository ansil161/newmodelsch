import { AUTH_ROUTES } from './index';

/**
 * The admin console: its routes and the words it uses for things.
 *
 * Nested under the signed-in landing, so everything behind sign-in shares one
 * prefix and one ProtectedRoute.
 */
const base = AUTH_ROUTES.dashboard;
const kb = (id) => `${base}/knowledge-base/${id}`;

export const CONSOLE_ROUTES = {
  home: base,
  knowledgeBases: `${base}/knowledge-base`,
  knowledgeBase: kb,
  documents: (id) => `${kb(id)}/documents`,
  document: (id, documentId) => `${kb(id)}/documents/${documentId}`,
  sources: (id) => `${kb(id)}/sources`,
  processing: (id) => `${kb(id)}/processing`,
  test: (id) => `${kb(id)}/test`,
  settings: (id) => `${kb(id)}/settings`,
};

export const ROLE_LABELS = {
  admin: 'Administrator',
  editor: 'Editor',
  viewer: 'Viewer',
};

export const DOCUMENT_STATUS_LABELS = {
  uploaded: 'Uploaded',
  queued: 'Queued',
  processing: 'Processing',
  indexing: 'Indexing',
  ready: 'Ready',
  failed: 'Failed',
  deleting: 'Deleting',
};

/** Statuses a document leaves on its own. While any is on screen, the page polls. */
export const TRANSIENT_STATUSES = new Set([
  'uploaded',
  'queued',
  'processing',
  'indexing',
  'deleting',
]);

export const JOB_STATUS_LABELS = {
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const JOB_KIND_LABELS = {
  ingest: 'Process',
  reindex: 'Re-index',
  delete_document: 'Delete',
  delete_knowledge_base: 'Delete knowledge base',
};

export const FILE_TYPE_LABELS = {
  pdf: 'PDF',
  docx: 'Word',
  txt: 'Text',
  md: 'Markdown',
  csv: 'CSV',
  json: 'JSON',
  html: 'Web page',
};

export const SOURCE_TYPE_LABELS = {
  file: 'File',
  url: 'Web page',
  text: 'Text',
};

export const SUPPORT_LABELS = {
  SUPPORTED: 'Supported by sources',
  PARTIALLY_SUPPORTED: 'Partly supported',
  INSUFFICIENT_CONTEXT: 'Not enough in the knowledge base',
};

export const HEALTH_LABELS = {
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
export const ACTIVITY_LABELS = {
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
