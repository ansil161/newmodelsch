import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/common/Icon';
import { ToastContext, type ToastApi, type ToastTone } from '@/hooks/useToast';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

const LIFETIME = { success: 5000, info: 5000, error: 9000 } as const;
const MAX_VISIBLE = 4;

/**
 * Short confirmations of what just happened, in the corner.
 *
 * A toast never carries the only copy of anything important: a failed upload
 * also shows its reason on the document's row, where it stays. Errors stay up
 * longer than successes, and every toast can be dismissed by keyboard.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, message?: string) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), { id, tone, title, message }]);
      window.setTimeout(() => dismiss(id), LIFETIME[tone]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, message) => push('success', title, message),
      error: (title, message) => push('error', title, message),
      info: (title, message) => push('info', title, message),
    }),
    [push],
  );

  return (
    <ToastContext value={api}>
      {children}
      <section className="c-toasts" aria-label="Notifications">
        <ul>
          {toasts.map((toast) => (
            <li
              key={toast.id}
              className={`c-toast c-toast--${toast.tone}`}
              role={toast.tone === 'error' ? 'alert' : 'status'}
            >
              <Icon name={toast.tone === 'error' ? 'alert' : toast.tone === 'success' ? 'check' : 'info'} size={18} />
              <div className="c-toast__text">
                <strong>{toast.title}</strong>
                {toast.message ? <span>{toast.message}</span> : null}
              </div>
              <button type="button" className="c-toast__close" onClick={() => dismiss(toast.id)}>
                <Icon name="close" size={14} />
                <span className="sr-only">Dismiss</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </ToastContext>
  );
}
