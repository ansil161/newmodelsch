import { Button, IconButton } from '@/components/console';
import { availableActions } from './useDocumentActions';

/** A table row's actions. Nothing is offered to a viewer. */
export function DocumentRowActions({ document, actions, canEdit }) {
  if (!canEdit) return null;
  const allowed = availableActions(document);
  const busy = actions.pending !== null;
  return (
    <div className="kb-row-actions">
      {allowed.retry ? (
        <Button size="sm" icon="refresh" busy={actions.isPending(document.id, 'retry')} disabled={busy} onClick={() => actions.run(document, 'retry')}>
          Retry
        </Button>
      ) : null}
      {allowed.cancel ? (
        <IconButton icon="stop" label={`Cancel processing of ${document.title}`} disabled={busy} onClick={() => actions.run(document, 'cancel')} />
      ) : null}
      {allowed.reprocess ? (
        <IconButton icon="refresh" label={`Reprocess ${document.title}`} disabled={busy} onClick={() => actions.run(document, 'reprocess')} />
      ) : null}
      {allowed.delete ? (
        <IconButton icon="trash" label={`Delete ${document.title}`} className="c-icon-btn--danger" disabled={busy} onClick={() => actions.askDelete(document)} />
      ) : null}
    </div>
  );
}
