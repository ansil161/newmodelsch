import { api, apiUrl, streamEvents, upload } from './apiClient';
import { camelizeKeys } from './case';

function withQuery(path, params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}

async function get(path, signal) {
  return camelizeKeys(await api.get(path, { signal }));
}

async function post(path, body) {
  return camelizeKeys(await api.post(path, body));
}

async function patch(path, body) {
  return camelizeKeys(await api.patch(path, body));
}

async function remove(path) {
  return camelizeKeys(await api.delete(path));
}

async function send(path, form, options) {
  return camelizeKeys(await upload(path, form, options));
}

function metadataFields(metadata) {
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

  async workspaces(signal) {
    return (await get('/workspaces/', signal)).workspaces;
  },

  async list(workspaceId, signal) {
    const data = await get(
      withQuery('/knowledge-bases/', { workspace: workspaceId }),
      signal,
    );
    return data.knowledgeBases;
  },

  async create(workspaceId, input) {
    const data = await post('/knowledge-bases/', {
      workspace: workspaceId,
      name: input.name,
      description: input.description,
      chat_enabled: input.chatEnabled,
      default_language: input.defaultLanguage,
    });
    return data.knowledgeBase;
  },

  async get(id, signal) {
    return (await get(`/knowledge-bases/${id}/`, signal)).knowledgeBase;
  },

  async update(id, input) {
    const data = await patch(`/knowledge-bases/${id}/`, {
      name: input.name,
      description: input.description,
      chat_enabled: input.chatEnabled,
      default_language: input.defaultLanguage,
    });
    return data.knowledgeBase;
  },

  async remove(id) {
    return (await remove(`/knowledge-bases/${id}/`)).job;
  },

  overview(id, signal) {
    return get(`/knowledge-bases/${id}/overview/`, signal);
  },

  /* -- documents ------------------------------------------------------------ */

  documents(id, query, signal) {
    return get(
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
    id,
    file,
    metadata,
    options,
  ) {
    const form = new FormData();
    form.append('file', file);
    for (const [key, value] of Object.entries(metadataFields(metadata))) {
      if (value !== undefined) form.append(key, Array.isArray(value) ? value.join(',') : String(value));
    }
    return (await send(`/knowledge-bases/${id}/documents/`, form, options)).document;
  },

  async document(id, signal) {
    return (await get(`/documents/${id}/`, signal)).document;
  },

  async updateDocument(id, input) {
    return (await patch(`/documents/${id}/`, input)).document;
  },

  async deleteDocument(id) {
    return (await remove(`/documents/${id}/`)).document;
  },

  async reprocess(id) {
    return (await post(`/documents/${id}/reprocess/`)).document;
  },

  async retry(id) {
    return (await post(`/documents/${id}/retry/`)).document;
  },

  async cancel(id) {
    return (await post(`/documents/${id}/cancel/`)).document;
  },

  async uploadVersion(id, file, options) {
    const form = new FormData();
    form.append('file', file);
    return (await send(`/documents/${id}/versions/`, form, options)).document;
  },

  async activateVersion(id, versionId) {
    return (await post(`/documents/${id}/versions/${versionId}/activate/`)).document;
  },

  chunks(
    id,
    query,
    signal,
  ) {
    return get(withQuery(`/documents/${id}/chunks/`, query), signal);
  },

  downloadUrl(id, version) {
    return apiUrl(withQuery(`/documents/${id}/download/`, { version }));
  },

  /* -- sources and jobs --------------------------------------------------- */

  sources(
    id,
    query,
    signal,
  ) {
    return get(withQuery(`/knowledge-bases/${id}/sources/`, query), signal);
  },

  async addUrlSource(id, input) {
    return (await post(`/knowledge-bases/${id}/sources/`, {
      type: 'url',
      url: input.url.trim(),
      ...metadataFields(input),
    })).source;
  },

  async addTextSource(id, input) {
    return (await post(`/knowledge-bases/${id}/sources/`, {
      type: 'text',
      content: input.content,
      ...metadataFields(input),
    })).source;
  },

  async deleteSource(id) {
    await remove(`/sources/${id}/`);
  },

  async syncSource(id) {
    return (await post(`/sources/${id}/sync/`)).job;
  },

  jobs(id, query, signal) {
    return get(withQuery(`/knowledge-bases/${id}/jobs/`, query), signal);
  },

  /* -- Test RAG and chat ---------------------------------------------------- */

  ragTest(input) {
    return post('/rag/test/', {
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
    scope,
    message,
    history,
    signal,
  ) {
    const body = {
      ...('knowledgeBase' in scope ? { knowledge_base: scope.knowledgeBase } : { workspace: scope.workspace }),
      message,
      history,
    };
    for await (const frame of streamEvents('/chat/stream/', body, { signal })) {
      const data = camelizeKeys(frame.data);
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
            metadata: data.metadata,
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
