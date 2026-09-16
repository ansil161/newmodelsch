import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, ConfirmDialog, Facts, Panel, Switch, TextArea, TextField, firstErrors } from '@/components/console';
import { LanguageField } from '@/components/knowledge-base/LanguageField';
import { CONSOLE_ROUTES, ROLE_LABELS } from '@/constants/console';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/lib/apiClient';
import { knowledgeBaseApi } from '@/lib/knowledgeBaseApi';
import { formatDateTime, plural } from '@/utils';

export function SettingsPage() {
  const { knowledgeBase, canAdmin, role } = useKnowledgeBase();
  usePageMeta({ title: `Settings - ${knowledgeBase.name}`, description: 'Settings for this knowledge base.' });

  return (
    <div className="c-stack kb-narrow">
      {!canAdmin && knowledgeBase.status === 'active' ? (
        <Alert tone="info">
          Only administrators of this workspace can change these settings. You are {ROLE_LABELS[role].toLowerCase() === 'editor' ? 'an editor' : 'a viewer'}.
        </Alert>
      ) : null}

      {/* Keyed on the last change, so a save (or someone else's) refills the form. */}
      <SettingsForm key={`${knowledgeBase.id}:${knowledgeBase.updatedAt}`} />

      <Panel title="About">
        <Facts
          items={[
            ['Identifier', <code key="id">{knowledgeBase.id}</code>],
            ['Your role', ROLE_LABELS[role]],
            ['Created', formatDateTime(knowledgeBase.createdAt)],
            ['Last changed', formatDateTime(knowledgeBase.updatedAt)],
          ]}
        />
      </Panel>

      {canAdmin ? <DangerZone /> : null}
    </div>
  );
}

function SettingsForm() {
  const { knowledgeBase, canAdmin, replace } = useKnowledgeBase();
  const toast = useToast();
  const [name, setName] = useState(knowledgeBase.name);
  const [description, setDescription] = useState(knowledgeBase.description);
  const [language, setLanguage] = useState(knowledgeBase.defaultLanguage);
  const [chatEnabled, setChatEnabled] = useState(knowledgeBase.chatEnabled);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);

  const dirty =
    name !== knowledgeBase.name ||
    description !== knowledgeBase.description ||
    language !== knowledgeBase.defaultLanguage ||
    chatEnabled !== knowledgeBase.chatEnabled;

  const reset = () => {
    setName(knowledgeBase.name);
    setDescription(knowledgeBase.description);
    setLanguage(knowledgeBase.defaultLanguage);
    setChatEnabled(knowledgeBase.chatEnabled);
    setErrors({});
    setAlert(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setErrors({ name: 'A knowledge base needs a name.' });
      return;
    }
    setSaving(true);
    setErrors({});
    setAlert(null);
    try {
      const updated = await knowledgeBaseApi.update(knowledgeBase.id, {
        name: name.trim(),
        description: description.trim(),
        defaultLanguage: language,
        chatEnabled,
      });
      toast.success('Settings saved', updated.name);
      replace(updated);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(firstErrors(error.fieldErrors));
      else setAlert(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Panel title="Settings">
      <form className="c-stack" onSubmit={submit} noValidate>
        <fieldset className="kb-fieldset" disabled={!canAdmin || saving}>
          <div className="c-stack">
            <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} maxLength={120} required />
            <TextArea
              label="Description"
              optional
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              error={errors.description}
              maxLength={2000}
              rows={3}
            />
            <LanguageField
              value={language}
              onChange={setLanguage}
              error={errors.default_language}
              label="Default document language"
            />
            <Switch
              label="Available to the chatbot"
              description="When on, the site's chatbot searches this knowledge base. Off, only Test RAG does."
              checked={chatEnabled}
              onChange={setChatEnabled}
            />
          </div>
        </fieldset>
        {alert ? <Alert tone="error">{alert}</Alert> : null}
        {canAdmin ? (
          <div className="c-row">
            <Button type="submit" variant="primary" busy={saving} disabled={!dirty}>
              Save changes
            </Button>
            {dirty && !saving ? (
              <Button variant="ghost" onClick={reset}>
                Discard
              </Button>
            ) : null}
          </div>
        ) : null}
      </form>
    </Panel>
  );
}

function DangerZone() {
  const { knowledgeBase } = useKnowledgeBase();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const documents = knowledgeBase.stats?.documents ?? 0;

  return (
    <Panel title="Delete this knowledge base" className="kb-danger">
      <div className="kb-danger__row">
        <p>
          Every document in it, with its files, versions and passages in the search index, is removed. The chatbot stops
          using it straight away. This cannot be undone.
        </p>
        <Button variant="danger" icon="trash" onClick={() => setOpen(true)}>
          Delete knowledge base
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this knowledge base?"
        confirmLabel="Delete permanently"
        confirmText={knowledgeBase.name}
        message={
          <p>
            <strong>{knowledgeBase.name}</strong> and {documents ? `its ${plural(documents, 'document')}` : 'everything in it'} will be
            permanently deleted.
          </p>
        }
        onConfirm={async () => {
          await knowledgeBaseApi.remove(knowledgeBase.id);
          toast.success('Deleting knowledge base', knowledgeBase.name);
          navigate(CONSOLE_ROUTES.knowledgeBases);
        }}
      />
    </Panel>
  );
}
