import { useState,  } from 'react';
import { ApiError } from '@/lib/apiClient';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import { useToast } from '@/hooks/useToast';
import { Alert, Button, Dialog, Switch, TextArea, TextField, firstErrors } from '@/components/console';
import { LanguageField } from './LanguageField';

export function CreateKnowledgeBaseDialog({
  open,
  workspaceId,
  onClose,
  onCreated,
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      title="New knowledge base"
      description="A collection of documents the chatbot can search. You can add documents once it exists."
    >
      <CreateForm workspaceId={workspaceId} busy={busy} setBusy={setBusy} onClose={onClose} onCreated={onCreated} />
    </Dialog>
  );
}

/* Mounted each time the dialog opens, so a second visit starts empty. */
function CreateForm({
  workspaceId,
  busy,
  setBusy,
  onClose,
  onCreated,
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('en');
  const [chatEnabled, setChatEnabled] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setErrors({ name: 'Give the knowledge base a name.' });
      return;
    }
    setBusy(true);
    setErrors({});
    setAlert(null);
    try {
      const created = await knowledgeBaseApi.create(workspaceId, {
        name: name.trim(),
        description: description.trim(),
        defaultLanguage: language,
        chatEnabled,
      });
      toast.success('Knowledge base created', created.name);
      onClose();
      onCreated(created);
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
          <TextField
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
            maxLength={120}
            required
            autoFocus
          />
          <TextArea
            label="Description"
            optional
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            error={errors.description}
            maxLength={2000}
            rows={3}
            hint="What it covers, so a colleague knows what belongs in it."
          />
          <LanguageField value={language} onChange={setLanguage} error={errors.default_language} label="Default document language" />
          <Switch
            label="Available to the chatbot"
            description="Leave off while you add and test documents. Test RAG works either way."
            checked={chatEnabled}
            onChange={setChatEnabled}
          />
        </div>
      </fieldset>
      {alert ? <Alert tone="error">{alert}</Alert> : null}
      <div className="c-dialog__actions">
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={busy}>
          Create
        </Button>
      </div>
    </form>
  );
}
