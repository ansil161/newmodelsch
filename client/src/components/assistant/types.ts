import type { Ref } from 'react';

/** The service behind the dock: the support chat. */
export type AssistantMode = 'chat';

/**
 * A link offered under a reply. `kind` decides how it is rendered, because the
 * three behave differently: a route goes through the router (and so through
 * the page transition), an external page opens in a new tab, and a `tel:` or
 * `mailto:` hands off to the device.
 */
export interface MessageAction {
  label: string;
  href: string;
  kind: 'route' | 'external' | 'native';
  icon?: string;
}

/** A document an answer was drawn from, numbered the way the answer cites it. */
export interface Source {
  number: number;
  title: string;
  /** Where in it: a page range or a section heading. */
  detail?: string;
  /** A public address, when the source is a web page. */
  href?: string;
}

/**
 * What a responder returns. `text` is plain text with light conventions and
 * no markup: a blank line separates paragraphs, `- ` starts a list item, and
 * `[n]` cites source n.
 */
export interface Reply {
  text: string;
  sources?: Source[];
  actions?: MessageAction[];
  /** No answer could be given. Shown, but never sent back as history. */
  failed?: boolean;
}

export interface Message extends Reply {
  id: number;
  role: 'user' | 'assistant';
  /** Still arriving. */
  streaming?: boolean;
}

/** One earlier message, as the chat API takes history. */
export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ResponderContext {
  history: Turn[];
  signal: AbortSignal;
  /** Each piece of the answer, as it is written. */
  onDelta: (delta: string) => void;
}

/** Answers one question. Must reject with an AbortError when `signal` aborts. */
export type Responder = (question: string, context: ResponderContext) => Promise<Reply>;

export interface Suggestion {
  label: string;
  /** What is sent when the chip is pressed. Defaults to the label. */
  prompt: string;
}

/** The dock button's props. */
export interface TriggerProps {
  active: boolean;
  /** The panel's id, for `aria-controls`. */
  controls: string;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}
