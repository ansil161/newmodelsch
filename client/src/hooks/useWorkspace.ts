import { createContext, useContext } from 'react';
import type { ApiError } from '@/lib/apiClient';
import type { Workspace } from '@/types/knowledgeBase';

export interface WorkspaceContextValue {
  status: 'loading' | 'ready' | 'error';
  workspaces: Workspace[];
  /** The workspace the console is showing. Null when the user belongs to none. */
  workspace: Workspace | null;
  error: ApiError | null;
  select: (id: string) => void;
  reload: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace() must be used inside <WorkspaceProvider>.');
  return value;
}
