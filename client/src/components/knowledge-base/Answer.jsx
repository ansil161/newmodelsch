import { Badge, toneFor } from '@/components/console';
import { SUPPORT_LABELS } from '@/constants/console';
import { formatPages } from '@/utils';

export function SupportBadge({ support }) {
  if (!support) return null;
  return <Badge tone={toneFor(support)}>{SUPPORT_LABELS[support]}</Badge>;
}

function parse(text) {
  const blocks = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'p', text: paragraph.join(' ') });
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    if (/^\s*```/.test(line)) {
      flush();
      const code = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index] ?? '')) {
        code.push(lines[index] ?? '');
        index += 1;
      }
      blocks.push({ kind: 'code', text: code.join('\n') });
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    const heading = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: 'h', text: heading[1] ?? '' });
      continue;
    }

    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = bullet ? null : /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flush();
      const kind = bullet ? 'ul' : 'ol';
      const item = (bullet ?? numbered)?.[1] ?? '';
      const last = blocks[blocks.length - 1];
      if (last && last.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
      continue;
    }

    // An indented line straight after a list item continues that item.
    const last = blocks[blocks.length - 1];
    if (!paragraph.length && last && (last.kind === 'ul' || last.kind === 'ol') && /^\s+/.test(line)) {
      last.items.push(`${last.items.pop() ?? ''} ${line.trim()}`);
      continue;
    }

    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

// `code`, **bold**, [1] / [1, 2], *italic*, _italic_ — the emphasis forms only
// between word boundaries, so file_names_like_this stay as they are.
const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[\d+(?:\s*,\s*\d+)*\])|((?<![\w*])\*[^*\s][^*\n]*?\*(?![\w*]))|((?<!\w)_[^_\s][^_\n]*?_(?!\w))/g;

function inline(text, context, key) {
  const nodes = [];
  let last = 0;
  let count = 0;
  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const [, code, bold, cite, italic, underscored] = match;
    const id = `${key}.${count}`;
    count += 1;
    if (code) nodes.push(<code key={id}>{code.slice(1, -1)}</code>);
    else if (bold) nodes.push(<strong key={id}>{inline(bold.slice(2, -2), context, id)}</strong>);
    else if (cite) nodes.push(<Citation key={id} marker={cite} context={context} />);
    else nodes.push(<em key={id}>{(italic ?? underscored ?? '').slice(1, -1)}</em>);
    last = start + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Citation({ marker, context }) {
  const numbers = marker
    .slice(1, -1)
    .split(',')
    .map((part) => Number(part.trim()));
  return (
    <span className="kb-cites">
      {numbers.map((number, index) => {
        const source = context.sources.get(number);
        if (!source) {
          return (
            <span key={index} className="kb-cite kb-cite--invalid" title="No passage has this number: this citation is not supported.">
              {number}
            </span>
          );
        }
        const where = formatPages(source.page, source.pages);
        return (
          <button
            key={index}
            type="button"
            className="kb-cite"
            onClick={() => context.onCite?.(number)}
            title={where ? `${source.documentName}, ${where}` : source.documentName}
            aria-label={`Source ${number}: ${source.documentName}`}
          >
            {number}
          </button>
        );
      })}
    </span>
  );
}

export function Answer({ text, sources, onCite }) {
  const context = { sources: new Map(sources.map((source) => [source.citationNumber, source])), onCite };
  return (
    <div className="kb-answer">
      {parse(text).map((block, index) => {
        const key = String(index);
        switch (block.kind) {
          case 'h':
            return (
              <p key={key} className="kb-answer__heading">
                {inline(block.text, context, key)}
              </p>
            );
          case 'ul':
            return (
              <ul key={key}>
                {block.items.map((item, position) => (
                  <li key={position}>{inline(item, context, `${key}.${position}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key}>
                {block.items.map((item, position) => (
                  <li key={position}>{inline(item, context, `${key}.${position}`)}</li>
                ))}
              </ol>
            );
          case 'code':
            return (
              <pre key={key}>
                <code>{block.text}</code>
              </pre>
            );
          default:
            return <p key={key}>{inline(block.text, context, key)}</p>;
        }
      })}
    </div>
  );
}
