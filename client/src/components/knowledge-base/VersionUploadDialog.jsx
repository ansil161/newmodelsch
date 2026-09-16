import { useRef, useState,  } from 'react';
import { Alert, Button, Dialog } from '@/components/console';
import { MAX_UPLOAD_MB, UPLOAD_ACCEPT, UPLOAD_TYPES_LABEL } from '@/constants/console';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/lib/apiClient';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import { formatBytes } from '@/utils';

const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export function VersionUploadDialog({
  open,
  document,
  onClose,
  onUploaded,
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      title="Upload a new version"
      description={`Replaces the file behind “${document.title}”. The current version keeps answering questions until the new one is ready, and stays available to restore.`}
    >
      <VersionForm documentId={document.id} busy={busy} setBusy={setBusy} onClose={onClose} onUploaded={onUploaded} />
    </Dialog>
  );
}

function VersionForm({
  documentId,
  busy,
  setBusy,
  onClose,
  onUploaded,
}) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const controller = useRef(null);

  const choose = (chosen) => {
    setError(null);
    if (!chosen) return;
    if (chosen.size === 0) setError('The file is empty.');
    else if (chosen.size > MAX_BYTES) setError(`Larger than the ${MAX_UPLOAD_MB} MB limit.`);
    setFile(chosen);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!file || error) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setProgress(0);
    try {
      await knowledgeBaseApi.uploadVersion(documentId, file, { signal: abort.signal, onProgress: setProgress });
      toast.success('New version uploaded', 'Processing has started.');
      onUploaded();
      onClose();
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') setError('The upload was stopped.');
      else if (caught instanceof ApiError) setError(Object.values(caught.fieldErrors)[0]?.[0] || caught.message);
      else setError('The upload failed. Please try again.');
    } finally {
      controller.current = null;
      setBusy(false);
    }
  };

  return (
    <form className="c-stack" onSubmit={submit} noValidate>
      <div className="c-field">
        <label className="c-field__label" htmlFor="version-file">
          File
        </label>
        <input
          id="version-file"
          type="file"
          accept={UPLOAD_ACCEPT}
          className="kb-file-input"
          disabled={busy}
          onChange={(event) => choose(event.target.files?.[0])}
        />
        <p className="c-field__hint">
          {file ? `${file.name} · ${formatBytes(file.size)}` : `${UPLOAD_TYPES_LABEL}, up to ${MAX_UPLOAD_MB} MB.`}
        </p>
      </div>
      {busy ? (
        <div
          className="c-progress"
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span style={{ width: `${Math.max(3, progress * 100)}%` }} />
        </div>
      ) : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="c-dialog__actions">
        {busy ? (
          <Button icon="stop" onClick={() => controller.current?.abort()}>
            Stop
          </Button>
        ) : (
          <Button onClick={onClose}>Cancel</Button>
        )}
        <Button type="submit" variant="sun" icon="upload" busy={busy} disabled={!file || Boolean(error)}>
          Upload version
        </Button>
      </div>
    </form>
  );
}
