import { useCallback, useEffect, useRef, useState } from 'react';

/** The chat API takes twenty earlier messages; older ones are dropped first. */
const HISTORY_LIMIT = 20;

/**
 * One thread: its messages, its unsent draft, and whether a reply is on the
 * way. It lives above the panel, so closing and reopening keeps the
 * conversation - and anything half-typed - where it was left.
 *
 * A reply is written into the thread as it streams: the first piece adds it,
 * each later piece extends it, and the finished answer - with its sources -
 * replaces it, because the server's final text has invalid citations removed.
 *
 * One question at a time. A second send while a reply is pending is ignored
 * rather than queued, because two answers arriving out of order is worse
 * than a Send button that waits.
 */
export function useConversation(respond) {
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState('');
  const nextId = useRef(1);
  const inFlight = useRef(null);
  // Read when a question is sent, so `send` need not change with every message.
  const thread = useRef(messages);
  thread.current = messages;

  useEffect(() => () => inFlight.current?.abort(), []);

  const send = useCallback(
    async (raw) => {
      const text = raw.trim();
      if (!text || inFlight.current) return;

      const history = toHistory(thread.current).slice(-HISTORY_LIMIT);
      const controller = new AbortController();
      inFlight.current = controller;
      const questionId = nextId.current++;
      const replyId = nextId.current++;
      setMessages((list) => [...list, { id: questionId, role: 'user', text }]);
      setPending(true);

      let started = false;
      const onDelta = (delta) => {
        if (!started) {
          started = true;
          setMessages((list) => [...list, { id: replyId, role: 'assistant', text: delta, streaming: true }]);
        } else {
          setMessages((list) => list.map((m) => (m.id === replyId ? { ...m, text: m.text + delta } : m)));
        }
      };
      const settle = (reply) => {
        const message = { id: replyId, role: 'assistant', ...reply };
        setMessages((list) => (started ? list.map((m) => (m.id === replyId ? message : m)) : [...list, message]));
      };

      try {
        settle(await respond(text, { history, signal: controller.signal, onDelta }));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          if (started) setMessages((list) => list.map((m) => (m.id === replyId ? { ...m, streaming: false } : m)));
          return;
        }
        settle({ text: 'Something went wrong. Please try again.', failed: true });
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
        setPending(false);
      }
    },
    [respond],
  );

  const submit = useCallback(() => {
    if (!draft.trim() || inFlight.current) return;
    void send(draft);
    setDraft('');
  }, [draft, send]);

  return { messages, pending, draft, setDraft, send: (text) => void send(text), submit };
}

/** Only complete exchanges are history: a failed or unfinished answer is not context. */
function toHistory(messages) {
  const turns = [];
  messages.forEach((message, index) => {
    const answer = messages[index + 1];
    if (message.role === 'user' && answer?.role === 'assistant' && answer.text && !answer.failed && !answer.streaming) {
      turns.push({ role: 'user', content: message.text }, { role: 'assistant', content: answer.text });
    }
  });
  return turns;
}
