

const topic = (label) => ({ label, prompt: label });

export const MODES = {
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
