import { useState, type FormEvent } from 'react';
import { Alert, Button, Panel, Skeleton, Switch, TextArea, TextField } from '@/components/console';
import { SOURCE_TYPE_LABELS } from '@/constants/console';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import type { KnowledgeBase, RagTestResult, SourceType } from '@/types/knowledgeBase';
import { cx, formatCount, formatDuration } from '@/utils';
import { Answer, SupportBadge } from './Answer';
import { LanguageField } from './LanguageField';
import { SourceList, sourceAnchor } from './SourceList';
import { TagsField, parseList, parseTags } from './TagsField';
import { TraceView } from './TraceView';

type LimitKey = 'finalK' | 'rerankTopK' | 'denseTopK' | 'sparseTopK';

const LIMITS: Array<{ key: LimitKey; label: string; max: number }> = [
  { key: 'finalK', label: 'Passages in context', max: 20 },
  { key: 'rerankTopK', label: 'Candidates to rerank', max: 100 },
  { key: 'denseTopK', label: 'Semantic candidates', max: 100 },
  { key: 'sparseTopK', label: 'Keyword candidates', max: 100 },
];

const TIMINGS: Array<[keyof RagTestResult['timings'], string]> = [
  ['rewriteMs', 'Rewrite'],
  ['embeddingMs', 'Embedding'],
  ['retrievalMs', 'Retrieval'],
  ['rerankMs', 'Rerank'],
  ['generationMs', 'Generation'],
  ['totalMs', 'Total'],
];

const PREFIX = 'rag-test';

/**
 * Ask a question the way the chatbot would, and see every step: what was
 * searched for, what each search found, how it was ranked, what the model was
 * given, what it answered, and whether the answer is supported.
 */
export function RagDiagnosticsPanel({ knowledgeBase }: { knowledgeBase: KnowledgeBase }) {
  const [question, setQuestion] = useState('');
  const [categories, setCategories] = useState('');
  const [tags, setTags] = useState('');
  const [sourceTypes, setSourceTypes] = useState<SourceType[]>([]);
  const [language, setLanguage] = useState('');
  const [generate, setGenerate] = useState(true);
  const [limits, setLimits] = useState<Record<LimitKey, string>>({ finalK: '', rerankTopK: '', denseTopK: '', sparseTopK: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RagTestResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<number | null>(null);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (running) return;
    const found: Record<string, string> = {};
    if (!question.trim()) found.question = 'Enter a question to test.';
    const options: Partial<Record<LimitKey, number>> = {};
    for (const limit of LIMITS) {
      const raw = limits[limit.key].trim();
      if (!raw) continue;
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 1 || value > limit.max) found[limit.key] = `A whole number from 1 to ${limit.max}.`;
      else options[limit.key] = value;
    }
    setErrors(found);
    if (Object.keys(found).length) return;

    setRunning(true);
    setFailure(null);
    setHighlighted(null);
    try {
      const outcome = await knowledgeBaseApi.ragTest({
        knowledgeBase: knowledgeBase.id,
        question: question.trim(),
        filters: {
          categories: parseList(categories),
          tags: parseTags(tags),
          sourceTypes,
          language: language || undefined,
        },
        options: { generate, ...options },
      });
      setResult(outcome);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The test could not be run.');
    } finally {
      setRunning(false);
    }
  };

  const cite = (number: number) => {
    setHighlighted(number);
    const target = window.document.getElementById(sourceAnchor(PREFIX, number));
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target?.focus({ preventScroll: true });
  };

  const toggleType = (type: SourceType, on: boolean) =>
    setSourceTypes((current) => (on ? [...current, type] : current.filter((item) => item !== type)));

  const filtersInUse = [categories.trim(), tags.trim(), language, ...sourceTypes].filter(Boolean).length;

  return (
    <div className="c-stack">
      <Panel title="Ask a question" description="Runs the same retrieval and generation as the chatbot, with every step recorded.">
        <form className="c-stack" onSubmit={submit} noValidate>
          <TextArea
            label="Question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            error={errors.question}
            maxLength={4000}
            rows={3}
            placeholder="e.g. What documents are needed for admission to Class 6?"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit();
            }}
            hint="Ctrl+Enter to run."
          />

          <details className="kb-options" open={filtersInUse > 0 || undefined}>
            <summary>
              Filters{filtersInUse ? ` (${filtersInUse})` : ''}
              <span className="c-muted"> — narrow what is searched</span>
            </summary>
            <div className="c-form-grid kb-options__body">
              <TextField
                label="Categories"
                optional
                value={categories}
                onChange={(event) => setCategories(event.target.value)}
                hint="Comma-separated. Matches any."
                maxLength={500}
              />
              <TagsField value={tags} onChange={setTags} hint="Comma-separated. Matches any." />
              <LanguageField value={language} onChange={setLanguage} allowAuto emptyLabel="Any language" />
              <fieldset className="kb-checks">
                <legend className="c-field__label">Kinds of source</legend>
                {(Object.keys(SOURCE_TYPE_LABELS) as SourceType[]).map((type) => (
                  <label key={type} className="kb-check">
                    <input type="checkbox" checked={sourceTypes.includes(type)} onChange={(event) => toggleType(type, event.target.checked)} />
                    {SOURCE_TYPE_LABELS[type]}
                  </label>
                ))}
              </fieldset>
            </div>
          </details>

          <details className="kb-options">
            <summary>
              Retrieval settings<span className="c-muted"> — leave blank for the service defaults</span>
            </summary>
            <div className="c-stack kb-options__body">
              <Switch
                label="Generate an answer"
                description="Off: retrieval only — see what would be found, without calling the model."
                checked={generate}
                onChange={setGenerate}
              />
              <div className="c-form-grid">
                {LIMITS.map((limit) => (
                  <TextField
                    key={limit.key}
                    label={limit.label}
                    optional
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={limit.max}
                    value={limits[limit.key]}
                    onChange={(event) => setLimits((current) => ({ ...current, [limit.key]: event.target.value }))}
                    error={errors[limit.key]}
                  />
                ))}
              </div>
            </div>
          </details>

          <div className="c-row">
            <Button type="submit" variant="sun" icon="flask" busy={running}>
              {running ? 'Running…' : 'Run test'}
            </Button>
            {knowledgeBase.stats && knowledgeBase.stats.live === 0 ? (
              <span className="c-small c-muted">Nothing is searchable yet — upload a document and wait for it to be Ready.</span>
            ) : null}
          </div>
        </form>
      </Panel>

      {failure ? <Alert tone="error" title="The test could not be run">{failure}</Alert> : null}

      {running && !result ? (
        <Panel title="Running">
          <div className="c-stack c-stack--tight" aria-busy="true">
            <Skeleton width="85%" />
            <Skeleton width="92%" />
            <Skeleton width="60%" />
          </div>
        </Panel>
      ) : null}

      {result ? (
        <div className={cx('c-stack', running && 'kb-stale')} aria-live="polite" aria-busy={running}>
          <Panel title="Answer" actions={<SupportBadge support={result.support} />}>
            {result.answer === null ? (
              <p className="c-muted">Retrieval only — no answer was generated.</p>
            ) : (
              <Answer text={result.answer} sources={result.sources} onCite={cite} />
            )}
            <ul className="kb-chips" aria-label="Timings">
              {TIMINGS.map(([key, label]) => (
                <li key={key} className={cx('kb-chip', key === 'totalMs' && 'kb-chip--strong')}>
                  <span>{label}</span>
                  <b>{formatDuration(result.timings[key])}</b>
                </li>
              ))}
            </ul>
            <p className="c-small c-muted kb-gap">
              {[
                result.model ? `${result.provider ? `${result.provider} · ` : ''}${result.model}` : null,
                result.promptTokens !== null ? `${formatCount(result.promptTokens)} tokens in` : null,
                result.completionTokens !== null ? `${formatCount(result.completionTokens)} out` : null,
                result.grounded ? 'grounded in retrieved passages' : 'no passages retrieved',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {result.invalidCitations > 0 ? (
              <Alert tone="warn">
                The answer cited {result.invalidCitations === 1 ? 'a passage number' : `${result.invalidCitations} passage numbers`} it
                was not given. Those citations are shown struck through.
              </Alert>
            ) : null}
          </Panel>

          <Panel title="Sources" description="The passages the answer could use, numbered as it cites them.">
            {result.sources.length ? (
              <SourceList sources={result.sources} prefix={PREFIX} knowledgeBaseId={knowledgeBase.id} highlighted={highlighted} />
            ) : (
              <p className="c-muted">Nothing relevant was found in this knowledge base.</p>
            )}
          </Panel>

          <Panel
            title="How the passages were found"
            description="The retrieval pipeline's own record. The model's internal reasoning is not recorded or shown."
          >
            <TraceView trace={result.trace} knowledgeBaseId={knowledgeBase.id} />
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
