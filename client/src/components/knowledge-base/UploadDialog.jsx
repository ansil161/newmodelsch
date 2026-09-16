import { useRef, useState,  } from 'react';
import { Icon } from '@/components/common/Icon';
import { Alert, Badge, Button, Dialog, IconButton, TextField } from '@/components/console';
import { MAX_UPLOAD_MB, UPLOAD_ACCEPT, UPLOAD_TYPES_LABEL } from '@/constants/console';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/lib/apiClient';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import { cx, formatBytes, plural } from '@/utils';
import { LanguageField } from './LanguageField';
import { TagsField, parseTags } from './TagsField';

const EXTENSIONS = UPLOAD_ACCEPT.split(',');
const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const MAX_FILES = 20;

/**
 * What the browser can say about a file before sending it. The server checks
 * again, and reads the file's contents, not just its name.
 */
function problemWith(file) {
  const name = file.name.toLowerCase();
  if (!EXTENSIONS.some((extension) => name.endsWith(extension))) return `Not a supported type. Use ${UPLOAD_TYPES_LABEL}.`;
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_BYTES) return `Larger than the ${MAX_UPLOAD_MB} MB limit.`;
  return undefined;
}

function messageOf(error) {
  if (error instanceof ApiError) {
    const field = Object.values(error.fieldErrors)[0]?.[0];
    return field || error.message;
  }
  return 'The upload failed. Please try again.';
}

export function UploadDialog({
  open,
  knowledgeBaseId,
  onClose,
  onUploaded,
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      size="lg"
      title="Upload documents"
      description="Each file is checked, split into passages and indexed in the background. You can keep working while it happens."
    >
      <UploadForm knowledgeBaseId={knowledgeBaseId} busy={busy} setBusy={setBusy} onClose={onClose} onUploaded={onUploaded} />
    </Dialog>
  );
}

/* The form mounts each time the dialog opens, so every visit starts empty. */
function UploadForm({
  knowledgeBaseId,
  busy,
  setBusy,
  onClose,
  onUploaded,
}) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [language, setLanguage] = useState('');
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState(null);
  const controller = useRef(null);
  const counter = useRef(0);

  const patch = (key, change) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));

  const add = (files) => {
    if (!files?.length) return;
    setNotice(null);
    setItems((current) => {
      const next = [...current];
      for (const file of Array.from(files)) {
        if (next.some((item) => item.file.name === file.name && item.file.size === file.size)) continue;
        if (next.length >= MAX_FILES) {
          setNotice(`Up to ${MAX_FILES} files at a time.`);
          break;
        }
        const problem = problemWith(file);
        counter.current += 1;
        next.push({ key: counter.current, file, state: problem ? 'invalid' : 'ready', progress: 0, message: problem });
      }
      return next;
    });
  };

  const waiting = items.filter((item) => item.state === 'ready' || item.state === 'failed');
  const single = items.length === 1;

  const start = async () => {
    if (!waiting.length || busy) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setNotice(null);

    const metadata = {
      title: single ? title : undefined,
      category,
      tags: parseTags(tags),
      language,
    };
    let uploaded = 0;
    let failed = 0;

    // One at a time: a school connection shares its bandwidth badly, and the
    // first file becoming Ready sooner beats all of them arriving together.
    for (const item of waiting) {
      if (abort.signal.aborted) break;
      patch(item.key, { state: 'uploading', progress: 0, message: undefined });
      try {
        await knowledgeBaseApi.uploadDocument(knowledgeBaseId, item.file, metadata, {
          signal: abort.signal,
          onProgress: (fraction) => patch(item.key, { progress: fraction }),
        });
        patch(item.key, { state: 'done', progress: 1 });
        uploaded += 1;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          patch(item.key, { state: 'ready', progress: 0, message: 'Stopped before it finished.' });
          break;
        }
        patch(item.key, { state: 'failed', message: messageOf(error) });
        failed += 1;
      }
    }

    controller.current = null;
    setBusy(false);
    if (uploaded) onUploaded();

    if (uploaded && !failed && !abort.signal.aborted) {
      toast.success(`${plural(uploaded, 'document')} uploaded`, 'Processing has started.');
      onClose();
    } else if (failed) {
      setNotice(`${plural(failed, 'file')} could not be uploaded. Fix or remove ${failed === 1 ? 'it' : 'them'}, then try again.`);
    }
  };

  return (
    <div className="c-stack">
      <label
        className={cx('kb-drop', dragging && 'kb-drop--over', busy && 'kb-drop--disabled')}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) add(event.dataTransfer.files);
        }}
      >
        <input
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          className="kb-drop__input"
          disabled={busy}
          onChange={(event) => {
            add(event.target.files);
            event.target.value = '';
          }}
        />
        <Icon name="upload" size={26} />
        <span className="kb-drop__title">
          Drop files here, or <u>choose files</u>
        </span>
        <span className="kb-drop__hint">
          {UPLOAD_TYPES_LABEL} · up to {MAX_UPLOAD_MB} MB each
        </span>
      </label>

      {items.length ? (
        <ul className="kb-files" aria-label="Files to upload">
          {items.map((item) => (
            <li key={item.key} className={cx('kb-file', `kb-file--${item.state}`)}>
              <Icon name="document" size={18} />
              <div className="kb-file__body">
                <div className="kb-file__line">
                  <span className="kb-file__name">{item.file.name}</span>
                  <span className="kb-file__size">{formatBytes(item.file.size)}</span>
                </div>
                {item.state === 'uploading' ? (
                  <div
                    className="c-progress"
                    role="progressbar"
                    aria-label={`Uploading ${item.file.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(item.progress * 100)}
                  >
                    <span style={{ width: `${Math.max(3, item.progress * 100)}%` }} />
                  </div>
                ) : null}
                {item.message ? <p className="kb-file__message">{item.message}</p> : null}
              </div>
              <FileState item={item} />
              {!busy && item.state !== 'done' ? (
                <IconButton
                  icon="close"
                  label={`Remove ${item.file.name}`}
                  onClick={() => setItems((current) => current.filter((other) => other.key !== item.key))}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <fieldset className="kb-fieldset" disabled={busy}>
        <legend className="kb-legend">
          Details <span className="c-muted">— applied to {single ? 'this file' : 'every file'}; all optional</span>
        </legend>
        <div className="c-form-grid">
          {single ? (
            <TextField
              label="Title"
              optional
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              hint="Defaults to the file name."
            />
          ) : null}
          <TextField
            label="Category"
            optional
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            maxLength={100}
            hint="e.g. Admissions, Policies."
          />
          <TagsField value={tags} onChange={setTags} />
          <LanguageField value={language} onChange={setLanguage} allowAuto />
        </div>
      </fieldset>

      {notice ? <Alert tone="warn">{notice}</Alert> : null}

      <div className="c-dialog__actions">
        {busy ? (
          <Button icon="stop" onClick={() => controller.current?.abort()}>
            Stop uploading
          </Button>
        ) : (
          <Button onClick={onClose}>{items.some((item) => item.state === 'done') ? 'Close' : 'Cancel'}</Button>
        )}
        <Button variant="sun" icon="upload" busy={busy} disabled={!waiting.length} onClick={start}>
          {waiting.length > 1 ? `Upload ${waiting.length} files` : 'Upload'}
        </Button>
      </div>
    </div>
  );
}

function FileState({ item }) {
  switch (item.state) {
    case 'done':
      return <Badge tone="ok">Uploaded</Badge>;
    case 'uploading':
      return <Badge tone="busy">{Math.round(item.progress * 100)}%</Badge>;
    case 'failed':
      return <Badge tone="err">Failed</Badge>;
    case 'invalid':
      return <Badge tone="err">Can’t upload</Badge>;
    default:
      return <Badge tone="queued">Waiting</Badge>;
  }
}
