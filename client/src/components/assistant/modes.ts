import type { AssistantMode, Suggestion } from './types';

/**
 * The words the chat panel uses, in one place: its title, greeting, topics
 * and labels. Chat routes a parent to a person - its suggestions are topics,
 * and every reply ends with a way to reach the office.
 */
interface ModeConfig {
  title: string;
  /** A small pill beside the title. */
  tag?: string;
  subtitle: string;
  welcome: { hi: string; line: string };
  suggestions: Suggestion[];
  suggestionsLabel: string;
  placeholder: string;
  /** Read to a screen reader while a reply is being written. */
  typingLabel: string;
  /** The line under the composer. */
  note?: string;
  openLabel: string;
  closeLabel: string;
}

const topic = (label: string): Suggestion => ({ label, prompt: label });

export const MODES: Record<AssistantMode, ModeConfig> = {
  chat: {
    title: 'Chat with us',
    subtitle: 'We’re here to help',
    welcome: { hi: 'Hi there 👋', line: 'How can we help you today?' },
    suggestions: ['Admissions', 'Academics', 'Campus', 'Student Life', 'Contact School'].map(topic),
    suggestionsLabel: 'Topics',
    placeholder: 'Type your message...',
    typingLabel: 'Writing a reply',
    openLabel: 'Open chat',
    closeLabel: 'Close chat',
  },
};
