import type {
  ChatMetadata,
  ChatStreamEvent,
  ChatTurn,
  ChunkPage,
  DocumentDetail,
  DocumentInput,
  Job,
  KbDocument,
  KnowledgeBase,
  KnowledgeBaseInput,
  Overview,
  Page,
  ProblemInfo,
  RagSource,
  RagTestInput,
  RagTestResult,
  Source,
  SourceType,
  Workspace,
} from '@/types/knowledgeBase';
import { api, apiUrl, streamEvents, upload, type UploadOptions } from './apiClient';
import { camelizeKeys } from './case';

/** Every field any chat stream frame can carry, camelCased. */
interface StreamPayload {
  sources?: RagSource[];
  delta?: string;
  answer?: string;
  metadata?: ChatMetadata;
  error?: ProblemInfo;
}

/**
 * Every knowledge-base call the console makes. Requests are built in the API's
 * snake_case here, responses are camelCased here, and nothing outside this
 * file knows either convention exists.
 */

type Query = Record<string, string | number | undefined | null>;

function withQuery(path: string, params: Query = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return camelizeKeys<T>(await api.get<unknown>(path, { signal }));
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  return camelizeKeys<T>(await api.post<unknown>(path, body));
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  return camelizeKeys<T>(await api.patch<unknown>(path, body));
}

async function remove<T>(path: string): Promise<T> {
  return camelizeKeys<T>(await api.delete<unknown>(path));
}

async function send<T>(path: string, form: FormData, options?: UploadOptions): Promise<T> {
  return camelizeKeys<T>(await upload<unknown>(path, form, options));
}

export interface DocumentQuery {
  search?: string;
  status?: string;
  type?: string;
  source?: SourceType | '';
  ordering?: string;
  page?: number;
  pageSize?: number;
}

export interface DocumentMetadata {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  language?: string;
}

export interface UrlSourceInput extends DocumentMetadata {
  url: string;
}

export interface TextSourceInput extends DocumentMetadata {
  title: string;
  content: string;
}

function metadataFields(metadata: DocumentMetadata): Record<string, unknown> {
  return {
    title: metadata.title?.trim() || undefined,
    description: metadata.description?.trim() || undefined,
    category: metadata.category?.trim() || undefined,
    tags: metadata.tags?.length ? metadata.tags : undefined,
    language: metadata.language?.trim() || undefined,
  };
}

export const knowledgeBaseApi = {
  /* -- workspaces and knowledge bases -------------------------------------- */

  async workspaces(signal?: AbortSignal): Promise<Workspace[]> {
    return (await get<{ workspaces: Workspace[] }>('/workspaces/', signal)).workspaces;
  },

  async list(workspaceId: string, signal?: AbortSignal): Promise<KnowledgeBase[]> {
    const data = await get<{ knowledgeBases: KnowledgeBase[] }>(
      withQuery('/knowledge-bases/', { workspace: workspaceId }),
      signal,
    );
    return data.knowledgeBases;
  },

  async create(workspaceId: string, input: KnowledgeBaseInput): Promise<KnowledgeBase> {
    const data = await post<{ knowledgeBase: KnowledgeBase }>('/knowledge-bases/', {
      workspace: workspaceId,
      name: input.name,
      description: input.description,
      chat_enabled: input.chatEnabled,
      default_language: input.defaultLanguage,
    });
    return data.knowledgeBase;
  },

  async get(id: string, signal?: AbortSignal): Promise<KnowledgeBase> {
    return (await get<{ knowledgeBase: KnowledgeBase }>(`/knowledge-bases/${id}/`, signal)).knowledgeBase;
  },

  async update(id: string, input: Partial<KnowledgeBaseInput>): Promise<KnowledgeBase> {
    const data = await patch<{ knowledgeBase: KnowledgeBase }>(`/knowledge-bases/${id}/`, {
      name: input.name,
      description: input.description,
      chat_enabled: input.chatEnabled,
      default_language: input.defaultLanguage,
    });
    return data.knowledgeBase;
  },

  async remove(id: string): Promise<Job> {
    return (await remove<{ job: Job }>(`/knowledge-bases/${id}/`)).job;
  },

  overview(id: string, signal?: AbortSignal): Promise<Overview> {
    return get<Overview>(`/knowledge-bases/${id}/overview/`, signal);
  },

  /* -- documents ------------------------------------------------------------ */

  documents(id: string, query: DocumentQuery, signal?: AbortSignal): Promise<Page<KbDocument>> {
    return get<Page<KbDocument>>(
      withQuery(`/knowledge-bases/${id}/documents/`, {
        search: query.search,
        status: query.status,
        type: query.type,
        source: query.source,
        ordering: query.ordering,
        page: query.page,
        page_size: query.pageSize,
      }),
      signal,
    );
  },

  async uploadDocument(
    id: string,
    file: File,
    metadata: DocumentMetadata,
    options?: UploadOptions,
  ): Promise<KbDocument> {
    const form = new FormData();
    form.append('file', file);
    for (const [key, value] of Object.entries(metadataFields(metadata))) {
      if (value !== undefined) form.append(key, Array.isArray(value) ? value.join(',') : String(value));
    }
    return (await send<{ document: KbDocument }>(`/knowledge-bases/${id}/documents/`, form, options)).document;
  },

  async document(id: string, signal?: AbortSignal): Promise<DocumentDetail> {
    return (await get<{ document: DocumentDetail }>(`/documents/${id}/`, signal)).document;
  },

  async updateDocument(id: string, input: Partial<DocumentInput>): Promise<KbDocument> {
    return (await patch<{ document: KbDocument }>(`/documents/${id}/`, input)).document;
  },

  async deleteDocument(id: string): Promise<KbDocument> {
    return (await remove<{ document: KbDocument }>(`/documents/${id}/`)).document;
  },

  async reprocess(id: string): Promise<KbDocument> {
    return (await post<{ document: KbDocument }>(`/documents/${id}/reprocess/`)).document;
  },

  async retry(id: string): Promise<KbDocument> {
    return (await post<{ document: KbDocument }>(`/documents/${id}/retry/`)).document;
  },

  async cancel(id: string): Promise<KbDocument> {
    return (await post<{ document: KbDocument }>(`/documents/${id}/cancel/`)).document;
  },

  async uploadVersion(id: string, file: File, options?: UploadOptions): Promise<KbDocument> {
    const form = new FormData();
    form.append('file', file);
    return (await send<{ document: KbDocument }>(`/documents/${id}/versions/`, form, options)).document;
  },

  async activateVersion(id: string, versionId: string): Promise<KbDocument> {
    return (await post<{ document: KbDocument }>(`/documents/${id}/versions/${versionId}/activate/`)).document;
  },

  chunks(
    id: string,
    query: { version?: number; page?: number; search?: string },
    signal?: AbortSignal,
  ): Promise<ChunkPage> {
    return get<ChunkPage>(withQuery(`/documents/${id}/chunks/`, query), signal);
  },

  downloadUrl(id: string, version?: number): string {
    return apiUrl(withQuery(`/documents/${id}/download/`, { version }));
  },

  /* -- sources and jobs --------------------------------------------------- */

  sources(
    id: string,
    query: { type?: SourceType | ''; search?: string; page?: number },
    signal?: AbortSignal,
  ): Promise<Page<Source>> {
    return get<Page<Source>>(withQuery(`/knowledge-bases/${id}/sources/`, query), signal);
  },

  async addUrlSource(id: string, input: UrlSourceInput): Promise<Source> {
    return (await post<{ source: Source }>(`/knowledge-bases/${id}/sources/`, {
      type: 'url',
      url: input.url.trim(),
      ...metadataFields(input),
    })).source;
  },

  async addTextSource(id: string, input: TextSourceInput): Promise<Source> {
    return (await post<{ source: Source }>(`/knowledge-bases/${id}/sources/`, {
      type: 'text',
      content: input.content,
      ...metadataFields(input),
    })).source;
  },

  async deleteSource(id: string): Promise<void> {
    await remove<unknown>(`/sources/${id}/`);
  },

  async syncSource(id: string): Promise<Job> {
    return (await post<{ job: Job }>(`/sources/${id}/sync/`)).job;
  },

  jobs(id: string, query: { status?: string; page?: number }, signal?: AbortSignal): Promise<Page<Job>> {
    return get<Page<Job>>(withQuery(`/knowledge-bases/${id}/jobs/`, query), signal);
  },

  /* -- Test RAG and chat ---------------------------------------------------- */

  ragTest(input: RagTestInput): Promise<RagTestResult> {
    return post<RagTestResult>('/rag/test/', {
      knowledge_base: input.knowledgeBase,
      question: input.question,
      history: input.history ?? [],
      filters: input.filters && {
        document_ids: input.filters.documentIds,
        categories: input.filters.categories,
        tags: input.filters.tags,
        source_types: input.filters.sourceTypes,
        language: input.filters.language,
      },
      options: input.options && {
        generate: input.options.generate,
        final_k: input.options.finalK,
        rerank_top_k: input.options.rerankTopK,
        dense_top_k: input.options.denseTopK,
        sparse_top_k: input.options.sparseTopK,
      },
    });
  },

  async *chat(
    scope: { knowledgeBase: string } | { workspace: string },
    message: string,
    history: ChatTurn[],
    signal?: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    const body = {
      ...('knowledgeBase' in scope ? { knowledge_base: scope.knowledgeBase } : { workspace: scope.workspace }),
      message,
      history,
    };
    for await (const frame of streamEvents('/chat/stream/', body, { signal })) {
      const data = camelizeKeys<StreamPayload>(frame.data);
      switch (frame.event) {
        case 'sources':
          yield { type: 'sources', sources: data.sources ?? [] };
          break;
        case 'token':
          yield { type: 'token', delta: data.delta ?? '' };
          break;
        case 'message_complete':
          yield {
            type: 'complete',
            answer: data.answer ?? '',
            sources: data.sources ?? [],
            metadata: data.metadata as ChatMetadata,
          };
          break;
        case 'error':
          yield {
            type: 'error',
            error: data.error ?? { code: 'stream_error', message: 'The answer could not be completed.' },
          };
          break;
        default:
          break;
      }
    }
  },
};
