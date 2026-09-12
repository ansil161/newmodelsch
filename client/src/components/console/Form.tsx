import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from '@/utils';

/**
 * Labelled fields. Every control has a visible label tied to it by id, hints
 * and errors are announced through aria-describedby, and an invalid field says
 * so to assistive technology as well as in red.
 */

interface Shell {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
}

function useFieldIds(explicit: string | undefined, hint: ReactNode, error: string | undefined) {
  const generated = useId();
  const id = explicit ?? generated;
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return { id, describedBy };
}

function Frame({ id, label, hint, error, optional, className, children }: Shell & { id: string; children: ReactNode }) {
  return (
    <div className={cx('c-field', className)}>
      <label className="c-field__label" htmlFor={id}>
        {label}
        {optional ? <span className="c-field__optional">Optional</span> : null}
      </label>
      {children}
      {hint ? (
        <p className="c-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="c-field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({ label, hint, error, optional, className, id: explicit, ...input }: Shell & InputHTMLAttributes<HTMLInputElement>) {
  const { id, describedBy } = useFieldIds(explicit, hint, error);
  return (
    <Frame id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <input id={id} className="c-input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
    </Frame>
  );
}

export function TextArea({ label, hint, error, optional, className, id: explicit, ...input }: Shell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { id, describedBy } = useFieldIds(explicit, hint, error);
  return (
    <Frame id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <textarea
        id={id}
        className="c-input c-input--area"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        data-lenis-prevent=""
        {...input}
      />
    </Frame>
  );
}

export function SelectField({ label, hint, error, optional, className, id: explicit, children, ...select }: Shell & SelectHTMLAttributes<HTMLSelectElement>) {
  const { id, describedBy } = useFieldIds(explicit, hint, error);
  return (
    <Frame id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <select id={id} className="c-input c-input--select" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...select}>
        {children}
      </select>
    </Frame>
  );
}

/** A checkbox that reads as an on/off setting, and is announced as one. */
export function Switch({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label className="c-switch" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={description ? `${id}-desc` : undefined}
      />
      <span className="c-switch__track" aria-hidden="true" />
      <span className="c-switch__text">
        <span className="c-switch__label">{label}</span>
        {description ? (
          <span className="c-switch__desc" id={`${id}-desc`}>
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/** Field errors from the API's `errors` object, first message per field. */
export function firstErrors(errors: Record<string, string[]>): Record<string, string> {
  return Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, messages[0] ?? '']));
}
