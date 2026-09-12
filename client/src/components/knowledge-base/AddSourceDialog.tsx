import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { Alert, Button, Dialog, TextArea, TextField, firstErrors } from '@/components/console';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/lib/apiClient';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import { formatCount } from '@/utils';
import { LanguageField } from './LanguageField';
import { Segmented } from './ListControls';
import { TagsField, parseTags } from './TagsField';

type Kind = 'url' | 'text';

/** The server's limit, repeated here only to count down to it. */
const MAX_TEXT_CHARACTERS = 200_000;

const KINDS = [
  { value: 'url', label: 'Web page', icon: 'link' },
  { value: 'text', label: 'Paste text', icon: 'edit' },
] as const;

export function AddSourceDialog({
  open,
  knowledgeBaseId,
  onClose,
  onAdded,
}: {
  open: boolean;
  knowledgeBaseId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      size="lg"
      title="Add a source"
      description="A public web page, fetched and kept as a document — or text pasted straight in."
    >
      <SourceForm knowledgeBaseId={knowledgeBaseId} busy={busy} setBusy={setBusy} onClose={onClose} onAdded={onAdded} />
    </Dialog>
  );
}

function SourceForm({
  knowledgeBaseId,
  busy,
  setBusy,
  onClose,
  onAdded,
}: {
  knowledgeBaseId: string;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<Kind>('url');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [language, setLanguage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);

  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {};
    if (kind === 'url') {
      try {
        const parsed = new URL(url.trim());
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') found.url = 'Use an address starting with https://.';
      } catch {
        found.url = 'Enter a full address, e.g. https://example.org/admissions.';
      }
    } else {
      if (!title.trim()) found.title = 'Give the text a title.';
      if (!content.trim()) found.content = 'Enter the text to add.';
      else if (content.length > MAX_TEXT_CHARACTERS) found.content = `Text is limited to ${formatCount(MAX_TEXT_CHARACTERS)} characters.`;
    }
    return found;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setAlert(null);
    if (Object.keys(found).length) return;

    setBusy(true);
    const metadata = { title, category, tags: parseTags(tags), language };
    try {
      if (kind === 'url') {
        await knowledgeBaseApi.addUrlSource(knowledgeBaseId, { ...metadata, url });
        toast.success('Web page added', 'It is being fetched and processed.');
      } else {
        await knowledgeBaseApi.addTextSource(knowledgeBaseId, { ...metadata, title, content });
        toast.success('Text added', 'It is being processed.');
      }
      onAdded();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setErrors(firstErrors(error.fieldErrors));
      } else {
        setAlert(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="c-stack" onSubmit={submit} noValidate>
      <Segmented
        label="Kind of source"
        options={KINDS}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setErrors({});
        }}
      />

      <fieldset className="kb-fieldset" disabled={busy}>
        <div className="c-stack">
          {kind === 'url' ? (
            <TextField
              label="Address"
              type="url"
              inputMode="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              error={errors.url}
              placeholder="https://"
              maxLength={2048}
              autoComplete="off"
              autoFocus
              hint="A public page. Addresses on private or internal networks are refused."
            />
          ) : null}

          <TextField
            label="Title"
            optional={kind === 'url'}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            error={errors.title}
            maxLength={300}
            hint={kind === 'url' ? 'Defaults to the page’s own title.' : undefined}
            autoFocus={kind === 'text'}
          />

          {kind === 'text' ? (
            <TextArea
              label="Text"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              error={errors.content}
              rows={10}
              hint={`${formatCount(content.length)} of ${formatCount(MAX_TEXT_CHARACTERS)} characters. Markdown headings and lists are kept.`}
            />
          ) : null}

          <div className="c-form-grid">
            <TextField
              label="Category"
              optional
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              error={errors.category}
              maxLength={100}
            />
            <TagsField value={tags} onChange={setTags} error={errors.tags} />
            <LanguageField value={language} onChange={setLanguage} error={errors.language} allowAuto />
          </div>
        </div>
      </fieldset>

      {alert ? <Alert tone="error">{alert}</Alert> : null}

      <div className="c-dialog__actions">
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="sun" icon={kind === 'url' ? 'link' : 'plus'} busy={busy}>
          {kind === 'url' ? 'Add web page' : 'Add text'}
        </Button>
      </div>
    </form>
  );
}
