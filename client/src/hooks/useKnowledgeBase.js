import { createContext, useContext } from 'react';

export const KnowledgeBaseContext = createContext(null);

export function useKnowledgeBase() {
  const value = useContext(KnowledgeBaseContext);
  if (!value) throw new Error('useKnowledgeBase() must be used inside <KnowledgeBaseLayout>.');
  return value;
}
