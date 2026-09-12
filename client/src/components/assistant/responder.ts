import { SCHOOL } from '@/constants';
import { ApiError, streamEvents } from '@/lib/apiClient';
import { camelizeKeys } from '@/lib/case';
import type { MessageAction, Reply, ResponderContext, Source } from './types';

/* ==========================================================================
   RESPONDER - where the chat panel gets its answers
   --------------------------------------------------------------------------
   EVERY ANSWER COMES FROM THE SCHOOL'S KNOWLEDGE BASE.

   The question goes to POST /api/v1/public/chat/stream/, the backend's
   anonymous chat endpoint. It searches only the knowledge bases an
   administrator has enabled for chat, through the AI service's retrieval and
   a grounded model call, and the answer streams back with the documents it
   cites. Nothing is answered in the browser.

   WHEN IT CANNOT ANSWER, IT SAYS SO.

   The model is told to say when the documents do not cover a question; a
   failure - the service down, the visitor rate-limited, no knowledge base
   enabled yet - is reported as what it is. Either way the reply carries a way
   to reach the office, with the question already in the email. There is no
   fallback that makes up an answer.
   ========================================================================== */

interface StreamSource {
  documentName?: string;
  citationNumber?: number;
  page?: number | null;
  pages?: number[];
  heading?: string | null;
  section?: string | null;
  sourceUrl?: string | null;
}

/** Every field a public chat stream frame can carry, camelCased. */
interface StreamPayload {
  delta?: string;
  answer?: string;
  sources?: StreamSource[];
  metadata?: { support?: string };
  error?: { code?: string; message?: string };
}

const UNAVAILABLE = 'The assistant could not answer just now. Please try again, or contact the office.';

export async function askChat(question: string, { history, signal, onDelta }: ResponderContext): Promise<Reply> {
  try {
    for await (const frame of streamEvents('/public/chat/stream/', { message: question, history }, { signal })) {
      const data = camelizeKeys<StreamPayload>(frame.data);
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

function finished(question: string, data: StreamPayload): Reply {
  const text = (data.answer ?? '').trim();
  if (!text) return failure(question);

  // The documents did not cover it. The model has said so; the office can
  // actually answer, so the reply points there.
  if (data.metadata?.support === 'INSUFFICIENT_CONTEXT') {
    return { text, actions: [call(), email(question)] };
  }
  return { text, sources: toSources(data.sources ?? []) };
}

function failure(question: string, message?: string): Reply {
  return { text: message || UNAVAILABLE, actions: [call(), email(question)], failed: true };
}

/* -------------------------------------------------------------- sources */

/** The cited sources, one per citation number, in citation order. */
function toSources(sources: StreamSource[]): Source[] {
  const byNumber = new Map<number, StreamSource>();
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

function locate(source: StreamSource): string | undefined {
  const pages = source.pages?.length ? source.pages : source.page ? [source.page] : [];
  if (pages.length > 1) return `pp. ${pages[0]}–${pages[pages.length - 1]}`;
  if (pages.length === 1) return `p. ${pages[0]}`;
  return source.heading || source.section || undefined;
}

/** Only an http(s) address becomes a link: the text of a source is not trusted markup. */
function publicUrl(url?: string | null): string | undefined {
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
function mailto(address: string, subject: string, body: string) {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${address}?${params.toString().replace(/\+/g, '%20')}`;
}

const call = (): MessageAction => ({
  label: 'Call the office',
  href: SCHOOL.phoneHref,
  kind: 'native',
  icon: 'phone',
});

const email = (question: string): MessageAction => ({
  label: 'Email this question',
  href: mailto(SCHOOL.email, 'Question from the website', question),
  kind: 'native',
  icon: 'mail',
});
