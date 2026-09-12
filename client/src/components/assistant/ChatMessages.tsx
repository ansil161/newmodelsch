import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { cx } from '@/utils';
import { MODES } from './modes';
import type { AssistantMode, Message, MessageAction, Source } from './types';

interface ChatMessagesProps {
  mode: AssistantMode;
  messages: Message[];
  pending: boolean;
  onSuggest: (prompt: string) => void;
}

/**
 * The scrolling body: the welcome, the suggestions until the first question,
 * the conversation, and the typing indicator.
 *
 * Only messages that arrive while this is mounted animate in: a thread of
 * twenty messages sliding in one after another every time would be a queue,
 * not a conversation.
 */
export function ChatMessages({ mode, messages, pending, onSuggest }: ChatMessagesProps) {
  const config = MODES[mode];
  const scroller = useRef<HTMLDivElement>(null);
  const baseline = useRef(messages.at(-1)?.id ?? 0);
  const settled = useRef(false);

  const last = messages.at(-1);
  // Once a reply starts streaming it shows itself; the dots are for the wait.
  const typing = pending && !last?.streaming;

  /* Runs when a message is added or the dots appear - not on every streamed
     token, which would drag the view down while the reply is being read. A
     reply is scrolled to its first line, not its last: a long answer read
     from the bottom up is an answer read backwards. A question, or the
     typing indicator, goes to the end. */
  useEffect(() => {
    const el = scroller.current;
    // An empty thread stays at the top. On a short panel the welcome and the
    // chips can overflow it, and scrolling to the end would open the panel
    // with its greeting already out of view.
    if (!el || (!messages.length && !typing)) return;
    const behavior: ScrollBehavior = settled.current && !reduced() ? 'smooth' : 'auto';
    settled.current = true;

    const node = el.querySelector<HTMLElement>('.fa-msg:last-of-type');
    const top =
      last?.role === 'assistant' && !typing && node ? Math.max(0, node.offsetTop - 16) : el.scrollHeight;
    el.scrollTo({ top, behavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id, typing]);

  return (
    <div ref={scroller} className="fa-body" data-lenis-prevent="">
      <div className="fa-welcome">
        <p className="fa-welcome__hi">{config.welcome.hi}</p>
        <p className="fa-welcome__line">{config.welcome.line}</p>
      </div>

      {messages.length === 0 ? (
        <div className="fa-chips" role="group" aria-label={config.suggestionsLabel}>
          {config.suggestions.map((suggestion) => (
            <button key={suggestion.label} type="button" className="fa-chip" onClick={() => onSuggest(suggestion.prompt)}>
              {suggestion.label}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="fa-log"
        role="log"
        aria-live="polite"
        aria-busy={pending}
        aria-label={`Conversation with ${config.title}`}
      >
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            speaker={message.role === 'user' ? 'You' : config.title}
            animate={message.id > baseline.current}
          />
        ))}

        {typing ? (
          <div className="fa-typing" role="status">
            <span className="sr-only">{config.typingLabel}</span>
            <i aria-hidden="true" />
            <i aria-hidden="true" />
            <i aria-hidden="true" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MessageItem({ message, speaker, animate }: { message: Message; speaker: string; animate: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const user = message.role === 'user';

  useIsomorphicLayoutEffect(() => {
    if (!animate || reduced() || !ref.current) return;
    const tween = gsap.fromTo(
      ref.current,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.42, ease: 'power2.out', clearProps: 'opacity,transform' },
    );
    return () => {
      tween.kill();
    };
    // Entrance only: a message never animates twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className={cx(
        'fa-msg',
        user ? 'fa-msg--user' : 'fa-msg--assistant',
        message.failed && 'fa-msg--failed',
        message.streaming && 'is-streaming',
      )}
    >
      <span className="sr-only">{speaker}: </span>
      {user ? <p>{message.text}</p> : <RichText text={message.text} />}
      {message.sources?.length ? <SourceList sources={message.sources} /> : null}
      {message.actions?.length ? (
        <div className="fa-actions">
          {message.actions.map((action) => (
            <ActionLink key={`${action.label}-${action.href}`} action={action} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------------------
   The model writes light markdown. Rendered here as React text, never as
   HTML: paragraphs on a blank line, `-`/`*`/`•` bullets, `1.` numbered
   items, a `#` heading as a strong line, **bold**, and `[n]` citations.
   -------------------------------------------------------------------------- */

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^\s*#{1,6}\s+/;

function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];

  for (const paragraph of text.split(/\n{2,}/)) {
    let items: string[] = [];
    let ordered = false;
    const flush = () => {
      if (!items.length) return;
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={blocks.length}>
          {items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </List>,
      );
      items = [];
    };

    for (const line of paragraph.split('\n')) {
      const bullet = BULLET.test(line);
      const numbered = !bullet && NUMBERED.test(line);
      if (bullet || numbered) {
        if (items.length && ordered !== numbered) flush();
        ordered = numbered;
        items.push(line.replace(bullet ? BULLET : NUMBERED, ''));
      } else {
        flush();
        if (!line.trim()) continue;
        blocks.push(
          HEADING.test(line) ? (
            <p key={blocks.length} className="fa-msg__heading">
              {inline(line.replace(HEADING, ''))}
            </p>
          ) : (
            <p key={blocks.length}>{inline(line)}</p>
          ),
        );
      }
    }
    flush();
  }

  return <>{blocks}</>;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    const cite = part.match(/^\[(\d+)\]$/);
    if (cite) {
      return (
        <sup key={index} className="fa-cite" aria-label={`source ${cite[1]}`}>
          {cite[1]}
        </sup>
      );
    }
    return part;
  });
}

function SourceList({ sources }: { sources: Source[] }) {
  return (
    <ol className="fa-sources" aria-label="Sources">
      {sources.map((source) => (
        <li key={source.number}>
          <span className="fa-cite" aria-hidden="true">
            {source.number}
          </span>
          <span>
            {source.href ? (
              <a href={source.href} target="_blank" rel="noopener noreferrer">
                {source.title}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              source.title
            )}
            {source.detail ? <span className="fa-sources__detail"> · {source.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ActionLink({ action }: { action: MessageAction }) {
  const content = (
    <>
      {action.icon ? <Icon name={action.icon} size={14} /> : null}
      <span>{action.label}</span>
    </>
  );

  if (action.kind === 'route') {
    return (
      <Link className="fa-action" to={action.href}>
        {content}
      </Link>
    );
  }

  if (action.kind === 'external') {
    return (
      <a className="fa-action" href={action.href} target="_blank" rel="noopener noreferrer">
        {content}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }

  return (
    <a className="fa-action" href={action.href}>
      {content}
    </a>
  );
}
