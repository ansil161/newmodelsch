/**
 * The knowledge-base API's shapes, after camelCasing. They mirror
 * backend/apps/knowledge_base/presenters.py and, for Test RAG and chat, the AI
 * service's diagnostics contract relayed through it.
 */

export type Role = 'admin' | 'editor' | 'viewer';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: Role | null;
}

export interface DocumentCounts {
  documents: number;
  ready: number;
  processing: number;
  failed: number;
  deleting: number;
  live: number;
  chunks: number;
}

export interface KnowledgeBase {
  id: string;
  workspace: string;
  name: string;
  description: string;
  status: 'active' | 'deleting';
  chatEnabled: boolean;
  defaultLanguage: string;
  createdAt: string;
  updatedAt: string;
  role?: Role;
  stats?: DocumentCounts;
}

export interface KnowledgeBaseInput {
  name: string;
  description: string;
  chatEnabled: boolean;
  defaultLanguage: string;
}

export type DocumentStatus =
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'indexing'
  | 'ready'
  | 'failed'
  | 'deleting';

export type SourceType = 'file' | 'url' | 'text';

export interface ProblemInfo {
  code: string;
  message: string;
}

export interface Processing {
  stage: string;
  label: string;
  progress: number;
}

export interface KbDocument {
  id: string;
  knowledgeBase: string;
  title: string;
  status: DocumentStatus;
  processing: Processing | null;
  error: ProblemInfo | null;
  isLive: boolean;
  activeVersion: number | null;
  latestVersion: number | null;
  fileType: string;
  sourceType: SourceType;
  sourceId: string;
  sourceUrl: string;
  fileSize: number;
  chunkCount: number;
  pageCount: number | null;
  category: string;
  tags: string[];
  language: string;
  createdAt: string;
  updatedAt: string;
  indexedAt: string | null;
}

export interface DocumentVersion {
  id: string;
  number: number;
  status: DocumentStatus;
  isActive: boolean;
  originalFilename: string;
  sourceUrl: string;
  mimeType: string;
  format: string;
  parser: string;
  fileSize: number;
  pageCount: number | null;
  characterCount: number;
  chunkCount: number;
  tokenCount: number;
  warnings: string[];
  embeddingModel: string;
  hasFile: boolean;
  error: ProblemInfo | null;
  createdAt: string;
  processedAt: string | null;
  indexedAt: string | null;
}

export type JobKind = 'ingest' | 'reindex' | 'delete_document' | 'delete_knowledge_base';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface Job {
  id: number;
  kind: JobKind;
  status: JobStatus;
  stage: string;
  stageLabel: string;
  progress: number;
  attempts: number;
  maxAttempts: number;
  document: string | null;
  documentTitle: string;
  error: ProblemInfo | null;
  cancelRequested: boolean;
  result: { chunks?: number; unchanged?: boolean; skipped?: string };
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  runAfter: string | null;
  durationMs: number | null;
}

export interface Person {
  id: number;
  name: string;
  email: string;
}

export interface DocumentDetail extends KbDocument {
  description: string;
  author: string;
  createdBy: Person | null;
  versions: DocumentVersion[];
  jobs: Job[];
}

export interface DocumentInput {
  title: string;
  description: string;
  category: string;
  tags: string[];
  language: string;
  author: string;
}

export interface Chunk {
  id: string;
  index: number;
  content: string;
  tokenCount: number;
  page: number | null;
  pages: number[];
  heading: string;
  section: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  results: T[];
  pagination: Pagination;
}

export interface ChunkPage extends Page<Chunk> {
  version: DocumentVersion | null;
}

export interface Source {
  id: string;
  sourceType: SourceType;
  name: string;
  url: string;
  lastSyncedAt: string | null;
  createdAt: string;
  document: KbDocument | null;
}

export interface AuditEntry {
  id: number;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  actor: Person | null;
  createdAt: string;
}

export type HealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'empty' | 'attention';

export interface Overview {
  knowledgeBase: KnowledgeBase;
  counts: DocumentCounts;
  sources: { total: number; byType: Partial<Record<SourceType, number>> };
  lastIngestionAt: string | null;
  activeJobs: number;
  health: {
    status: HealthStatus;
    message: string;
    indexedPoints: number | null;
    expectedPoints: number;
    checkedAt: string;
  };
  queries: {
    periodDays: number;
    total: number;
    averageMs: number | null;
    supported: number;
    partiallySupported: number;
    insufficientContext: number;
    errors: number;
  };
  recentFailures: KbDocument[];
  recentActivity: AuditEntry[];
}

/* --------------------------------------------------------------------------
   Test RAG and chat
   -------------------------------------------------------------------------- */

export type SupportLevel = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'INSUFFICIENT_CONTEXT';

export interface RagSource {
  documentId: string;
  documentName: string;
  chunkId: string;
  chunkIndex: number;
  page: number | null;
  pages: number[];
  heading: string | null;
  section: string | null;
  sourceUrl: string | null;
  documentVersion: number | null;
  citationNumber: number;
  score: number;
  excerpt: string;
}

export interface TraceHit {
  rank: number;
  chunkId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  page: number | null;
  heading: string | null;
  section: string | null;
  methods: string[];
  denseScore: number | null;
  sparseScore: number | null;
  fusionScore: number | null;
  rerankScore: number | null;
  excerpt: string;
}

export interface RagTrace {
  originalQuery: string;
  searchQuery: string;
  rewritten: boolean;
  rewriteReason: string;
  filters: Record<string, unknown>;
  strategy: Record<string, unknown>;
  dense: TraceHit[];
  sparse: TraceHit[];
  fused: TraceHit[];
  reranked: TraceHit[];
  context: TraceHit[];
  duplicatesDropped: number;
  droppedForBudget: number;
  contextCharacters: number;
}

export interface RagTestResult {
  question: string;
  answer: string | null;
  support: SupportLevel | null;
  grounded: boolean;
  sources: RagSource[];
  provider: string | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  invalidCitations: number;
  timings: {
    rewriteMs: number;
    embeddingMs: number;
    retrievalMs: number;
    rerankMs: number;
    generationMs: number | null;
    totalMs: number;
  };
  trace: RagTrace;
}

export interface RagTestInput {
  knowledgeBase: string;
  question: string;
  history?: ChatTurn[];
  filters?: {
    documentIds?: string[];
    categories?: string[];
    tags?: string[];
    sourceTypes?: SourceType[];
    language?: string;
  };
  options?: {
    generate?: boolean;
    finalK?: number;
    rerankTopK?: number;
    denseTopK?: number;
    sparseTopK?: number;
  };
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatMetadata {
  provider: string;
  model: string;
  grounded: boolean;
  support: SupportLevel | '';
  queryRewritten: boolean;
  retrievalCount: number;
  contextChunkCount: number;
  retrievalMs: number | null;
  rerankMs: number | null;
  generationMs: number | null;
  totalMs: number | null;
}

export type ChatStreamEvent =
  | { type: 'sources'; sources: RagSource[] }
  | { type: 'token'; delta: string }
  | { type: 'complete'; answer: string; sources: RagSource[]; metadata: ChatMetadata }
  | { type: 'error'; error: ProblemInfo };
