import { EmptyState } from '@/components/console';

/** Signed in, but a member of no workspace — the state a brand-new staff account starts in. */
export function NoWorkspace() {
  return (
    <EmptyState icon="users" title="You have no knowledge-base access yet">
      Your account is not a member of any workspace. Ask an administrator to add you — they can do it in the
      Django admin under <strong>Workspace memberships</strong>, or with{' '}
      <code>manage.py grant_workspace_access</code>.
    </EmptyState>
  );
}
