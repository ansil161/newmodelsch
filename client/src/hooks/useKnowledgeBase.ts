import { createContext, useContext } from 'react';
import type { KnowledgeBase, Role } from '@/types/knowledgeBase';

export interface KnowledgeBaseContextValue {
  knowledgeBase: KnowledgeBase;
  role: Role;
  /** Upload, edit, reprocess and delete documents. The server checks again. */
  canEdit: boolean;
  /** Change settings or delete the knowledge base. */
  canAdmin: boolean;
  reload: () => void;
  replace: (knowledgeBase: KnowledgeBase) => void;
}

export const KnowledgeBaseContext = createContext<KnowledgeBaseContextValue | null>(null);

export function useKnowledgeBase(): KnowledgeBaseContextValue {
  const value = useContext(KnowledgeBaseContext);
  if (!value) throw new Error('useKnowledgeBase() must be used inside <KnowledgeBaseLayout>.');
  return value;
}
