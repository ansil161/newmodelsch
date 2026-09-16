import { useCallback, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/common/Icon';
import { ToastContext,  } from '@/hooks/useToast';

const LIFETIME = { success: 5000, info: 5000, error: 9000 };
const MAX_VISIBLE = 4;

/**
 * Short confirmations of what just happened, in the corner.
 *
 * A toast never carries the only copy of anything important: a failed upload
 * also shows its reason on the document's row, where it stays. Errors stay up
 * longer than successes, and every toast can be dismissed by keyboard.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone, title, message) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), { id, tone, title, message }]);
      window.setTimeout(() => dismiss(id), LIFETIME[tone]);
    },
    [dismiss],
  );

  const api = useMemo(
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
