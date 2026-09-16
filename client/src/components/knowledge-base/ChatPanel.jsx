import { useEffect, useId, useRef, useState } from 'react';
import { Alert, Button, EmptyState, Panel } from '@/components/console';
import { ApiError } from '@/lib/apiClient';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import { cx, formatDuration, plural } from '@/utils';
import { Answer, SupportBadge } from './Answer';
import { SourceList, sourceAnchor } from './SourceList';

/** The API accepts twenty earlier messages; older ones are dropped first. */
const HISTORY_LIMIT = 20;

/**
 * A conversation with this knowledge base, answered the way the chatbot
 * answers: streamed as it is written, with its sources. Stop closes the
 * connection, which stops the generation on the server too.
 */
export function ChatPanel({ knowledgeBaseId }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const controller = useRef(null);
  const nextId = useRef(1);
  const log = useRef(null);
  const inputId = useId();

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    const element = log.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  const patch = (id, change) =>
    setMessages((list) =>
      list.map((message) => (message.id === id ? { ...message, ...(typeof change === 'function' ? change(message) : change) } : message)),
    );

  const send = async (event) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || streaming) return;

    // Only complete exchanges are history: a failed answer is not context.
    const history = [];
    for (let index = 0; index + 1 < messages.length; index += 2) {
      const question = messages[index];
      const answer = messages[index + 1];
      if (question?.role === 'user' && answer?.role === 'assistant' && !answer.error && answer.content) {
        history.push({ role: 'user', content: question.content }, { role: 'assistant', content: answer.content });
      }
    }

    const questionId = nextId.current++;
    const replyId = nextId.current++;
    setMessages((list) => [
      ...list,
      { id: questionId, role: 'user', content: text, sources: [] },
      { id: replyId, role: 'assistant', content: '', sources: [], streaming: true },
    ]);
    setDraft('');

    const abort = new AbortController();
    controller.current = abort;
    setStreaming(true);
    try {
      for await (const frame of knowledgeBaseApi.chat({ knowledgeBase: knowledgeBaseId }, text, history.slice(-HISTORY_LIMIT), abort.signal)) {
        if (frame.type === 'sources') patch(replyId, { sources: frame.sources });
        else if (frame.type === 'token') patch(replyId, (message) => ({ content: message.content + frame.delta }));
        else if (frame.type === 'complete') {
          patch(replyId, { content: frame.answer, sources: frame.sources, metadata: frame.metadata, streaming: false });
        } else patch(replyId, { error: frame.error.message, streaming: false });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') patch(replyId, { stopped: true });
      else patch(replyId, { error: error instanceof ApiError || error instanceof Error ? error.message : 'The answer could not be completed.' });
    } finally {
      patch(replyId, { streaming: false });
      if (controller.current === abort) controller.current = null;
      setStreaming(false);
    }
  };

  const clear = () => {
    controller.current?.abort();
    setMessages([]);
  };

  return (
    <Panel
      title="Chat"
      description="Answers come from this knowledge base only, even while it is not in the chatbot."
      actions={
        messages.length ? (
          <Button size="sm" variant="ghost" icon="trash" onClick={clear} disabled={streaming}>
            Clear
          </Button>
        ) : undefined
      }
    >
      <div className="kb-chat">
        <div className="kb-chat__log" ref={log} data-lenis-prevent="" role="log" aria-label="Conversation" aria-busy={streaming}>
          {messages.length === 0 ? (
            <EmptyState icon="message" title="Ask something">
              Questions are answered from this knowledge base, with the passages cited. Follow-up questions keep the
              conversation in mind.
            </EmptyState>
          ) : (
            messages.map((message) => <ChatMessage key={message.id} message={message} knowledgeBaseId={knowledgeBaseId} />)
          )}
        </div>
        <form className="kb-chat__composer" onSubmit={send}>
          <label className="sr-only" htmlFor={inputId}>
            Message
          </label>
          <textarea
            id={inputId}
            className="c-input kb-chat__input"
            rows={2}
            value={draft}
            maxLength={4000}
            placeholder="Ask a question — Enter to send, Shift+Enter for a new line"
            data-lenis-prevent=""
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
          />
          {streaming ? (
            <Button icon="stop" onClick={() => controller.current?.abort()}>
              Stop
            </Button>
          ) : (
            <Button type="submit" variant="sun" icon="send" disabled={!draft.trim()}>
              Send
            </Button>
          )}
        </form>
      </div>
    </Panel>
  );
}

function ChatMessage({ message, knowledgeBaseId }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(null);
  const prefix = `chat-${message.id}`;

  if (message.role === 'user') {
    return (
      <div className="kb-msg kb-msg--user">
        <p>{message.content}</p>
      </div>
    );
  }

  const cite = (number) => {
    setOpen(true);
    setHighlighted(number);
    // After the sources have opened.
    window.requestAnimationFrame(() =>
      window.document.getElementById(sourceAnchor(prefix, number))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
  };

  return (
    <div className={cx('kb-msg kb-msg--assistant', message.streaming && 'is-streaming')}>
      {message.content ? (
        <Answer text={message.content} sources={message.sources} onCite={cite} />
      ) : message.streaming ? (
        <p className="kb-typing" aria-label="Writing an answer">
          <span />
          <span />
          <span />
        </p>
      ) : null}
      {message.error ? <Alert tone="error">{message.error}</Alert> : null}
      {message.stopped ? <p className="c-small c-muted">Stopped.</p> : null}
      {message.metadata ? (
        <div className="kb-msg__meta">
          <SupportBadge support={message.metadata.support} />
          {message.metadata.model ? <span>{message.metadata.model}</span> : null}
          {message.metadata.totalMs !== null ? <span>{formatDuration(message.metadata.totalMs)}</span> : null}
        </div>
      ) : null}
      {message.sources.length ? (
        <details className="kb-msg__sources" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
          <summary>{plural(message.sources.length, 'source')}</summary>
          <SourceList sources={message.sources} prefix={prefix} knowledgeBaseId={knowledgeBaseId} highlighted={highlighted} />
        </details>
      ) : null}
    </div>
  );
}
