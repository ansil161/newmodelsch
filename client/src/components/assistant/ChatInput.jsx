import { useId } from 'react';
import { Icon } from '@/components/common/Icon';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { MODES } from './modes';

/** Five lines, then it scrolls. */
const MAX_HEIGHT = 120;

/**
 * The composer. Enter sends, Shift+Enter is a new line, and an IME that is
 * still composing a character never sends half of it.
 */
export function ChatInput({ mode, value, onChange, onSubmit, busy, inputRef }) {
  const config = MODES[mode];
  const inputId = useId();
  const noteId = useId();
  const canSend = value.trim().length > 0 && !busy;

  // Grows with its content, measured before paint so it never flickers a line.
  useIsomorphicLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  return (
    <form
      className="fa-compose"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="fa-field">
        <label className="sr-only" htmlFor={inputId}>
          Your message
        </label>
        <textarea
          id={inputId}
          ref={inputRef}
          rows={1}
          value={value}
          maxLength={1000}
          placeholder={config.placeholder}
          enterKeyHint="send"
          data-lenis-prevent=""
          aria-describedby={config.note ? noteId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <button type="submit" className="fa-send" disabled={!canSend} aria-label="Send message">
          <Icon name="send" size={17} />
        </button>
      </div>

      {config.note ? (
        <p id={noteId} className="fa-note">
          {config.note}
        </p>
      ) : null}
    </form>
  );
}
