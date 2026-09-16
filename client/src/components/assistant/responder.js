import { SCHOOL } from '@/constants';
import { ApiError, streamEvents } from '@/lib/apiClient';
import { camelizeKeys } from '@/lib/case';

const UNAVAILABLE = 'The assistant could not answer just now. Please try again, or contact the office.';

export async function askChat(question, { history, signal, onDelta }) {
  try {
    for await (const frame of streamEvents('/public/chat/stream/', { message: question, history }, { signal })) {
      const data = camelizeKeys(frame.data);
      if (frame.event === 'token' && data.delta) onDelta(data.delta);
      else if (frame.event === 'message_complete') return finished(question, data);
      else if (frame.event === 'error') return failure(question, data.error?.message);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    if (error instanceof ApiError && error.status === 404) {
      return failure(question, 'The assistant is not available on this site yet.');
    }
    return failure(question, error instanceof ApiError ? error.message : undefined);
  }
  // The stream closed without a final frame: the connection dropped mid-answer.
  return failure(question);
}

function finished(question, data) {
  const text = (data.answer ?? '').trim();
  if (!text) return failure(question);

  // The documents did not cover it. The model has said so; the office can
  // actually answer, so the reply points there.
  if (data.metadata?.support === 'INSUFFICIENT_CONTEXT') {
    return { text, actions: [call(), email(question)] };
  }
  return { text, sources: toSources(data.sources ?? []) };
}

function failure(question, message) {
  return { text: message || UNAVAILABLE, actions: [call(), email(question)], failed: true };
}

/* -------------------------------------------------------------- sources */

/** The cited sources, one per citation number, in citation order. */
function toSources(sources) {
  const byNumber = new Map();
  for (const source of sources) {
    const number = source.citationNumber ?? 0;
    if (number > 0 && !byNumber.has(number)) byNumber.set(number, source);
  }
  return [...byNumber.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, source]) => ({
      number,
      title: source.documentName || 'School document',
      detail: locate(source),
      href: publicUrl(source.sourceUrl),
    }));
}

function locate(source) {
  const pages = source.pages?.length ? source.pages : source.page ? [source.page] : [];
  if (pages.length > 1) return `pp. ${pages[0]}–${pages[pages.length - 1]}`;
  if (pages.length === 1) return `p. ${pages[0]}`;
  return source.heading || source.section || undefined;
}

/** Only an http(s) address becomes a link: the text of a source is not trusted markup. */
function publicUrl(url) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/* -------------------------------------------------------------- contact */

/** URLSearchParams writes spaces as `+`, which mail clients show literally. */
function mailto(address, subject, body) {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${address}?${params.toString().replace(/\+/g, '%20')}`;
}

const call = () => ({
  label: 'Call the office',
  href: SCHOOL.phoneHref,
  kind: 'native',
  icon: 'phone',
});

const email = (question) => ({
  label: 'Email this question',
  href: mailto(SCHOOL.email, 'Question from the website', question),
  kind: 'native',
  icon: 'mail',
});
