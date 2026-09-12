import type { Processing, SourceType } from '@/types/knowledgeBase';
import { cx } from '@/utils';

/**
 * Where a document is in its fixed sequence of steps.
 *
 * Honest about what it measures: the step reached, not a fraction of a step.
 * Extraction of a 400-page PDF is one call, and a bar that crept through it
 * would be inventing the numbers.
 */

const STEPS = (source: SourceType) => [
  { key: 'queued', label: 'Queued' },
  { key: 'extracting', label: source === 'url' ? 'Fetching & extracting' : 'Extracting text' },
  { key: 'storing', label: 'Saving chunks' },
  { key: 'indexing', label: 'Embedding & indexing' },
  { key: 'done', label: 'Ready' },
];

const POSITION: Record<string, number> = {
  queued: 0,
  retrying: 0,
  fetching: 1,
  extracting: 1,
  storing: 2,
  indexing: 3,
  done: 4,
};

export function ProgressBar({ processing }: { processing: Processing }) {
  return (
    <div className="c-progress-line">
      <div
        className="c-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={processing.progress}
        aria-valuetext={processing.label}
      >
        <span style={{ width: `${Math.max(4, processing.progress)}%` }} />
      </div>
      <span className="c-progress-line__label">{processing.label}</span>
    </div>
  );
}

export function StageSteps({ processing, source }: { processing: Processing; source: SourceType }) {
  const current = POSITION[processing.stage] ?? 0;
  return (
    <ol className="c-steps" aria-label="Processing steps">
      {STEPS(source).map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <li key={step.key} className={cx('c-steps__item', `c-steps__item--${state}`)} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="c-steps__dot" aria-hidden="true" />
            <span className="c-steps__label">
              {state === 'current' && processing.stage === 'retrying' ? 'Waiting to retry' : step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
