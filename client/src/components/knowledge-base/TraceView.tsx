import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Facts } from '@/components/console';
import { CONSOLE_ROUTES } from '@/constants/console';
import type { RagTrace, TraceHit } from '@/types/knowledgeBase';
import { formatCount, formatPages, formatScore, plural } from '@/utils';

type Stage = 'context' | 'reranked' | 'fused' | 'dense' | 'sparse';

const STAGES: Array<[Stage, string, string]> = [
  ['context', 'Used as context', 'The passages given to the model, in the order it saw them.'],
  ['reranked', 'Reranked', 'The candidates re-scored against the question.'],
  ['fused', 'Fused', 'Semantic and keyword results merged into one ranking.'],
  ['dense', 'Semantic search', 'The nearest passages by meaning.'],
  ['sparse', 'Keyword search', 'The passages sharing the question’s words.'],
];

const METHOD_LABELS: Record<string, string> = { dense: 'semantic', sparse: 'keyword' };

/**
 * How the passages were found and ranked, stage by stage.
 *
 * This is the retrieval pipeline's own record — queries, filters, scores.
 * The model's reasoning is not part of it: it is neither recorded nor shown.
 */
export function TraceView({ trace, knowledgeBaseId }: { trace: RagTrace; knowledgeBaseId: string }) {
  const facts: Array<[string, ReactNode]> = [
    ['Question', trace.originalQuery],
    [
      'Searched for',
      <span key="query" className="kb-inline">
        {trace.searchQuery}
        {trace.rewritten ? <Badge tone="queued">Rewritten</Badge> : null}
      </span>,
    ],
  ];
  if (trace.rewritten && trace.rewriteReason) facts.push(['Why rewritten', trace.rewriteReason]);
  facts.push(
    ['Context', `${plural(trace.context.length, 'passage')} · ${formatCount(trace.contextCharacters)} characters`],
    ['Left out', `${plural(trace.duplicatesDropped, 'duplicate')} · ${formatCount(trace.droppedForBudget)} over the length budget`],
  );

  return (
    <div className="c-stack">
      <Facts items={facts} />
      <div className="c-grid-2">
        <KeyValues title="Strategy" data={trace.strategy} />
        <KeyValues title="Filters" data={trace.filters} />
      </div>
      {STAGES.map(([stage, label, description]) => {
        const hits = trace[stage];
        return (
          <details key={stage} className="kb-stage" open={stage === 'context'}>
            <summary>
              <span className="kb-stage__label">{label}</span>
              <span className="kb-stage__count">{hits.length}</span>
              <span className="kb-stage__desc">{description}</span>
            </summary>
            {hits.length ? (
              <HitsTable hits={hits} knowledgeBaseId={knowledgeBaseId} caption={label} />
            ) : (
              <p className="c-small c-muted kb-pad">No passages at this stage.</p>
            )}
          </details>
        );
      })}
    </div>
  );
}

function humanize(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(display).join(', ') : 'none';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function KeyValues({ title, data }: { title: string; data: Record<string, unknown> | null | undefined }) {
  const entries = Object.entries(data ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0),
  );
  return (
    <div className="kb-kv">
      <h4 className="kb-kv__title">{title}</h4>
      {entries.length ? (
        <Facts items={entries.map(([key, value]): [string, ReactNode] => [humanize(key), display(value)])} />
      ) : (
        <p className="c-small c-muted">None</p>
      )}
    </div>
  );
}

function HitsTable({ hits, knowledgeBaseId, caption }: { hits: TraceHit[]; knowledgeBaseId: string; caption: string }) {
  return (
    <div className="c-table-wrap">
      <table className="c-table kb-hits">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="is-num">
              Rank
            </th>
            <th scope="col">Passage</th>
            <th scope="col">Found by</th>
            <th scope="col" className="is-num">
              Semantic
            </th>
            <th scope="col" className="is-num">
              Keyword
            </th>
            <th scope="col" className="is-num">
              Fused
            </th>
            <th scope="col" className="is-num">
              Rerank
            </th>
          </tr>
        </thead>
        <tbody>
          {hits.map((hit) => (
            <tr key={`${hit.chunkId}:${hit.rank}`}>
              <td className="is-num">{hit.rank}</td>
              <td>
                <div className="kb-hit-cell">
                  <Link className="c-link" to={CONSOLE_ROUTES.document(knowledgeBaseId, hit.documentId)}>
                    {hit.documentName}
                  </Link>
                  <span className="c-small c-muted">
                    {[`passage ${hit.chunkIndex + 1}`, formatPages(hit.page), hit.section || hit.heading].filter(Boolean).join(' · ')}
                  </span>
                  <span className="kb-hit-cell__excerpt">{hit.excerpt}</span>
                </div>
              </td>
              <td>{hit.methods.map((method) => METHOD_LABELS[method] ?? method).join(', ') || '—'}</td>
              <td className="is-num">{formatScore(hit.denseScore)}</td>
              <td className="is-num">{formatScore(hit.sparseScore)}</td>
              <td className="is-num">{formatScore(hit.fusionScore)}</td>
              <td className="is-num">{formatScore(hit.rerankScore)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
