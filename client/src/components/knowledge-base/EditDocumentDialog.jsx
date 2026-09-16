import { useState,  } from 'react';
import { Alert, Button, Dialog, TextArea, TextField, firstErrors } from '@/components/console';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/lib/apiClient';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import { LanguageField } from './LanguageField';
import { TagsField, parseTags } from './TagsField';

export function EditDocumentDialog({
  open,
  document,
  onClose,
  onSaved,
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      title="Edit details"
      description="Changing the title, category, tags or language re-indexes the document, which takes a moment. It stays searchable meanwhile."
    >
      <EditForm document={document} busy={busy} setBusy={setBusy} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  );
}

function EditForm({
  document,
  busy,
  setBusy,
  onClose,
  onSaved,
}) {
  const toast = useToast();
  const [title, setTitle] = useState(document.title);
  const [description, setDescription] = useState(document.description);
  const [category, setCategory] = useState(document.category);
  const [tags, setTags] = useState(document.tags.join(', '));
  const [language, setLanguage] = useState(document.language);
  const [author, setAuthor] = useState(document.author);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (!title.trim()) {
      setErrors({ title: 'A document needs a title.' });
      return;
    }
    setBusy(true);
    setErrors({});
    setAlert(null);
    try {
      await knowledgeBaseApi.updateDocument(document.id, {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        tags: parseTags(tags),
        language,
        author: author.trim(),
      });
      toast.success('Details saved', title.trim());
      onSaved();
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
      <fieldset className="kb-fieldset" disabled={busy}>
        <div className="c-stack">
          <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} error={errors.title} maxLength={300} required autoFocus />
          <TextArea
            label="Description"
            optional
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            error={errors.description}
            maxLength={2000}
            rows={3}
          />
          <div className="c-form-grid">
            <TextField label="Category" optional value={category} onChange={(event) => setCategory(event.target.value)} error={errors.category} maxLength={100} />
            <TagsField value={tags} onChange={setTags} error={errors.tags} />
            <LanguageField value={language} onChange={setLanguage} error={errors.language} allowAuto />
            <TextField label="Author" optional value={author} onChange={(event) => setAuthor(event.target.value)} error={errors.author} maxLength={200} />
          </div>
        </div>
      </fieldset>
      {alert ? <Alert tone="error">{alert}</Alert> : null}
      <div className="c-dialog__actions">
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={busy}>
          Save
        </Button>
      </div>
    </form>
  );
}
