import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Icon } from '@/components/common/Icon';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import { cx } from '@/utils';
import { Button } from './Button';
import { Alert } from './Feedback';

/**
 * The native <dialog>, opened with showModal(): the browser provides the focus
 * trap, the Escape key, the inert page behind and the top layer, none of which
 * a div with a high z-index gets right. Smooth scrolling is paused while one
 * is open, so the page underneath does not glide away behind it.
 */
interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  /** While true, Escape, the backdrop and the close button do nothing. */
  busy?: boolean;
}

export function Dialog({ open, onClose, title, description, children, footer, size = 'md', busy = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { stop, start } = useSmoothScroll();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      stop();
    } else if (!open && dialog.open) {
      dialog.close();
      start();
    }
  }, [open, stop, start]);

  useEffect(() => () => start(), [start]);

  const requestClose = () => {
    if (!busy) onClose();
  };

  return (
    <dialog
      ref={ref}
      className={cx('c-dialog', size === 'lg' && 'c-dialog--lg')}
      aria-labelledby={titleId}
      data-lenis-prevent=""
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        // A click on the dialog element itself is a click on its backdrop.
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      {open ? (
        <div className="c-dialog__frame">
          <header className="c-dialog__head">
            <div>
              <h2 id={titleId} className="c-dialog__title">
                {title}
              </h2>
              {description ? <p className="c-dialog__desc">{description}</p> : null}
            </div>
            <button type="button" className="c-icon-btn" onClick={requestClose} disabled={busy} aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          </header>
          <div className="c-dialog__body">{children}</div>
          {footer ? <footer className="c-dialog__foot">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  /** When set, the action stays disabled until this exact text is typed. */
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
}

/** "Are you sure?" — with the consequence spelled out, and the error shown in place if it fails. */
export function ConfirmDialog({ open, onClose, title, message, confirmLabel, tone = 'danger', confirmText, onConfirm }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  useEffect(() => {
    if (open) {
      setTyped('');
      setError(null);
    }
  }, [open]);

  const blocked = Boolean(confirmText) && typed.trim() !== confirmText;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} busy={busy}>
      <form className="c-stack" onSubmit={submit}>
        <div className="c-dialog__message">{message}</div>
        {confirmText ? (
          <div className="c-field">
            <label className="c-field__label" htmlFor={inputId}>
              Type <strong>{confirmText}</strong> to confirm
            </label>
            <input
              id={inputId}
              className="c-input"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ) : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="c-dialog__actions">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant={tone === 'danger' ? 'danger' : 'primary'} busy={busy} disabled={blocked}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
