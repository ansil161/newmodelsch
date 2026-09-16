import { useState } from 'react';
import { ConfirmDialog } from '@/components/console';
import { TRANSIENT_STATUSES } from '@/constants/console';
import { useToast } from '@/hooks/useToast';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';

const DONE = {
  reprocess: 'Reprocessing',
  retry: 'Trying again',
  cancel: 'Cancelling',
};

const FAILED = {
  reprocess: 'Could not reprocess',
  retry: 'Could not retry',
  cancel: 'Could not cancel',
};

/**
 * What can be done to a document in its current state. The server enforces
 * the same rules; this only decides what is offered.
 */
export function availableActions(document) {
  const working = TRANSIENT_STATUSES.has(document.status) && document.status !== 'deleting';
  return {
    retry: document.status === 'failed',
    cancel: working,
    reprocess: document.status === 'ready',
    delete: document.status !== 'deleting',
  };
}

/**
 * Reprocess, retry, cancel and delete — with the toasts, the busy state and
 * the delete confirmation — shared by the table and the document page.
 * Render `dialog` once wherever the hook is used.
 */
export function useDocumentActions(onChanged, onDeleted) {
  const toast = useToast();
  const [pending, setPending] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const run = async (document, action) => {
    setPending(`${document.id}:${action}`);
    try {
      const updated = await knowledgeBaseApi[action](document.id);
      toast.success(DONE[action], updated.title);
      onChanged(updated);
    } catch (error) {
      toast.error(FAILED[action], error instanceof Error ? error.message : undefined);
    } finally {
      setPending(null);
    }
  };

  const dialog = (
    <ConfirmDialog
      open={deleting !== null}
      onClose={() => setDeleting(null)}
      title="Delete this document?"
      confirmLabel="Delete document"
      message={
        deleting ? (
          <>
            <p>
              <strong>{deleting.title}</strong> will be removed from the knowledge base, with its file, every version
              and its passages in the search index.
            </p>
            <p>This cannot be undone.</p>
          </>
        ) : null
      }
      onConfirm={async () => {
        if (!deleting) return;
        const updated = await knowledgeBaseApi.deleteDocument(deleting.id);
        toast.success('Deleting document', updated.title);
        (onDeleted ?? onChanged)(updated);
      }}
    />
  );

  return {
    run,
    pending,
    isPending: (id, action) => pending === `${id}:${action}`,
    askDelete: setDeleting,
    dialog,
  };
}

