import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { WorkspaceContext, type WorkspaceContextValue } from '@/hooks/useWorkspace';
import { useResource } from '@/hooks/useResource';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import { storage } from '@/lib/storage';

const STORAGE_KEY = 'nmhs.console.workspace';

/**
 * Which workspace the console is looking at.
 *
 * The list comes from the server, with the user's role in each; the choice is
 * remembered in this browser only. It decides nothing about access — every
 * request is authorised against the workspace of the object it names — so a
 * stale or edited stored id just falls back to the first workspace.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const resource = useResource((signal) => knowledgeBaseApi.workspaces(signal), []);
  const [selected, setSelected] = useState<string | null>(() => storage.get<string | null>(STORAGE_KEY, null));

  const select = useCallback((id: string) => {
    setSelected(id);
    storage.set(STORAGE_KEY, id);
  }, []);

  const value = useMemo<WorkspaceContextValue>(() => {
    const workspaces = resource.data ?? [];
    return {
      status: resource.error ? 'error' : resource.loading ? 'loading' : 'ready',
      workspaces,
      workspace: workspaces.find((workspace) => workspace.id === selected) ?? workspaces[0] ?? null,
      error: resource.error,
      select,
      reload: resource.reload,
    };
  }, [resource.data, resource.error, resource.loading, resource.reload, selected, select]);

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}
