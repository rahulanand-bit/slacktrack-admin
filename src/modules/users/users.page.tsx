import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { apiClient } from '../../shared/api/client';
import { hasPermission } from '../../shared/auth/session';
import { DismissibleNotice } from '../../shared/components/dismissible-notice';

type UserRow = {
  id: number;
  displayName: string | null;
  slackUserId: string;
  email: string | null;
  isMessageEnabled: boolean;
  active: boolean;
};

type CreateUserInput = {
  name: string;
  slackId: string;
  email?: string | null;
  isMessageEnabled?: boolean;
};

type MessagingFilter = 'all' | 'enabled' | 'disabled';

async function fetchUsers(): Promise<UserRow[]> {
  const response = await apiClient.get('/api/admin/users');
  return response.data?.data || [];
}

async function createUser(input: CreateUserInput): Promise<void> {
  await apiClient.post('/api/admin/users', input);
}

async function createUsersBulk(users: CreateUserInput[]): Promise<{
  created: UserRow[];
  errors: Array<{ slackId: string; reason: string }>;
}> {
  const response = await apiClient.post('/api/admin/users/bulk', { users });
  return response.data?.data;
}

async function updateUser(
  slackUserId: string,
  input: { name?: string; email?: string | null; isMessageEnabled?: boolean }
): Promise<void> {
  await apiClient.patch(`/api/admin/users/${encodeURIComponent(slackUserId)}`, input);
}

async function setMessaging(slackUserId: string, isMessageEnabled: boolean): Promise<void> {
  await apiClient.patch(`/api/admin/users/${encodeURIComponent(slackUserId)}/messaging`, { isMessageEnabled });
}

function parseBulkUsers(raw: string): CreateUserInput[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, slackId, email] = line.split(',').map((part) => part.trim());
      if (!name || !slackId) {
        throw new Error('Each line must contain at least: name,slackId[,email]');
      }

      return {
        name,
        slackId,
        email: email || null,
        isMessageEnabled: true
      };
    });
}

function matchesSearch(user: UserRow, query: string): boolean {
  if (!query.trim()) return true;
  const normalized = query.trim().toLowerCase();
  const haystack = [user.displayName || '', user.email || '', user.slackUserId].join(' ').toLowerCase();
  return haystack.includes(normalized);
}

export function UsersPage() {
  const canWriteUsers = hasPermission('users:write');
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const users = useMemo(() => (usersQuery.data || []).filter((user) => user.active), [usersQuery.data]);

  const [selectedUserIds, setSelectedUserIds] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [messagingFilter, setMessagingFilter] = useState<MessagingFilter>('all');

  const [notice, setNotice] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single');
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [editingMessaging, setEditingMessaging] = useState(true);
  const [singleForm, setSingleForm] = useState<CreateUserInput>({
    name: '',
    slackId: '',
    email: '',
    isMessageEnabled: true
  });
  const [bulkRaw, setBulkRaw] = useState('');

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (!matchesSearch(user, search)) return false;
      if (messagingFilter === 'enabled' && !user.isMessageEnabled) return false;
      if (messagingFilter === 'disabled' && user.isMessageEnabled) return false;
      return true;
    });
  }, [users, search, messagingFilter]);

  const selectedIds = useMemo(
    () => Object.entries(selectedUserIds).filter(([, selected]) => selected).map(([slackUserId]) => slackUserId),
    [selectedUserIds]
  );
  const allVisibleSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => Boolean(selectedUserIds[user.slackUserId]));
  const selectedRows = useMemo(
    () => users.filter((user) => Boolean(selectedUserIds[user.slackUserId])),
    [users, selectedUserIds]
  );
  const selectedEnabledCount = selectedRows.filter((row) => row.isMessageEnabled).length;
  const selectedDisabledCount = selectedRows.length - selectedEnabledCount;

  const singleCreateMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      setNotice('User added.');
      setSingleForm({ name: '', slackId: '', email: '', isMessageEnabled: true });
      setShowAddModal(false);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => setNotice('Failed to add user. Duplicate Slack ID may exist.')
  });

  const bulkCreateMutation = useMutation({
    mutationFn: createUsersBulk,
    onSuccess: async (result) => {
      const message = result.errors.length
        ? `Added ${result.created.length} users. ${result.errors.length} duplicates skipped.`
        : `Added ${result.created.length} users.`;
      setNotice(message);
      setBulkRaw('');
      setShowAddModal(false);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => setNotice('Failed to add bulk users. Check input format.')
  });

  const updateUserMutation = useMutation({
    mutationFn: ({
      slackUserId,
      name,
      email,
      isMessageEnabled
    }: {
      slackUserId: string;
      name: string;
      email: string;
      isMessageEnabled: boolean;
    }) =>
      updateUser(slackUserId, {
        name: name.trim() || undefined,
        email: email.trim() || null,
        isMessageEnabled
      }),
    onSuccess: async () => {
      setNotice('User updated.');
      setEditTarget(null);
      setEditingName('');
      setEditingEmail('');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => setNotice('Failed to update user.')
  });

  const bulkMessagingMutation = useMutation({
    mutationFn: async ({ slackUserIds, isMessageEnabled }: { slackUserIds: string[]; isMessageEnabled: boolean }) => {
      await Promise.all(slackUserIds.map((slackUserId) => setMessaging(slackUserId, isMessageEnabled)));
    },
    onSuccess: async (_data, variables) => {
      setNotice(
        `Messaging ${variables.isMessageEnabled ? 'enabled' : 'disabled'} for ${variables.slackUserIds.length} users.`
      );
      setSelectedUserIds({});
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => setNotice('Failed to update bulk messaging state.')
  });

  const onCreateSingle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      ...singleForm,
      email: singleForm.email?.trim() || null
    };
    setPendingAction({
      title: 'Confirm Add User',
      description: `Add user "${payload.name}" (${payload.slackId})?`,
      onConfirm: () => singleCreateMutation.mutate(payload)
    });
  };

  const onCreateBulk = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const parsed = parseBulkUsers(bulkRaw);
      setPendingAction({
        title: 'Confirm Bulk Add',
        description: `Add ${parsed.length} users from bulk input?`,
        onConfirm: () => bulkCreateMutation.mutate(parsed)
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Invalid bulk input');
    }
  };

  const triggerBulkMessaging = (isMessageEnabled: boolean) => {
    const targetIds = [...selectedIds];
    if (!targetIds.length) return;
    setPendingAction({
      title: isMessageEnabled ? 'Enable Messaging' : 'Disable Messaging',
      description: `${isMessageEnabled ? 'Enable' : 'Disable'} messaging for ${targetIds.length} selected users?`,
      onConfirm: () => bulkMessagingMutation.mutate({ slackUserIds: targetIds, isMessageEnabled })
    });
  };

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Users</h2>
          <p className="muted">Manage users and messaging preferences.</p>
        </div>
        {canWriteUsers ? (
          <button type="button" className="primary-btn" onClick={() => setShowAddModal(true)}>
            Add Users
          </button>
        ) : null}
      </div>

      <div className="card users-filter-card" style={{ marginTop: 14 }}>
        <div className="action-row">
          <label className="inline-field" style={{ minWidth: 260 }}>
            Search
            <input
              type="text"
              placeholder="Name, email, Slack ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="users-chip-row">
            <button
              type="button"
              className={messagingFilter === 'all' ? 'primary-btn' : 'ghost-btn'}
              onClick={() => setMessagingFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={messagingFilter === 'enabled' ? 'primary-btn' : 'ghost-btn'}
              onClick={() => setMessagingFilter('enabled')}
            >
              Messaging ON
            </button>
            <button
              type="button"
              className={messagingFilter === 'disabled' ? 'primary-btn' : 'ghost-btn'}
              onClick={() => setMessagingFilter('disabled')}
            >
              Messaging OFF
            </button>
          </div>
        </div>
      </div>

      {canWriteUsers && selectedIds.length ? (
        <div className="card users-bulk-bar" style={{ marginTop: 12 }}>
          <div className="users-bulk-summary">
            <strong>Selected: {selectedIds.length}</strong>
            <span className="muted">
              ON {selectedEnabledCount} / OFF {selectedDisabledCount}
            </span>
          </div>
          <div className="action-row">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => triggerBulkMessaging(true)}
              disabled={bulkMessagingMutation.isPending}
            >
              Enable Messaging ({selectedIds.length})
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => triggerBulkMessaging(false)}
              disabled={bulkMessagingMutation.isPending}
            >
              Disable Messaging ({selectedIds.length})
            </button>
            <button type="button" className="chip-btn" onClick={() => setSelectedUserIds({})}>
              Clear Selection
            </button>
          </div>
        </div>
      ) : null}

      <DismissibleNotice message={notice} onClose={() => setNotice(null)} />

      <div className="card table-card" style={{ marginTop: 12 }}>
        {usersQuery.isLoading ? <p>Loading users...</p> : null}
        {usersQuery.isError ? <p>Could not load users.</p> : null}

        {filteredUsers.length ? (
          <table>
            <thead>
              <tr>
                {canWriteUsers ? (
                  <th>
                    <label className="toggle-wrap" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedUserIds((prev) => {
                            const next = { ...prev };
                            for (const row of filteredUsers) {
                              next[row.slackUserId] = checked;
                            }
                            return next;
                          });
                        }}
                      />
                      <span>Select Visible</span>
                    </label>
                  </th>
                ) : null}
                <th>Name</th>
                <th>Slack ID</th>
                <th>Email</th>
                <th>Messaging</th>
                {canWriteUsers ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  {canWriteUsers ? (
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedUserIds[user.slackUserId])}
                        onChange={(event) =>
                          setSelectedUserIds((prev) => ({
                            ...prev,
                            [user.slackUserId]: event.target.checked
                          }))
                        }
                      />
                    </td>
                  ) : null}
                  <td>{user.displayName || '-'}</td>
                  <td>{user.slackUserId}</td>
                  <td>{user.email || '-'}</td>
                  <td>
                    <span className={user.isMessageEnabled ? 'pill on' : 'pill off'}>
                      {user.isMessageEnabled ? 'Messaging ON' : 'Messaging OFF'}
                    </span>
                  </td>
                  {canWriteUsers ? (
                    <td>
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={() => {
                          setEditTarget(user);
                          setEditingName(user.displayName || '');
                          setEditingEmail(user.email || '');
                          setEditingMessaging(user.isMessageEnabled);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !usersQuery.isLoading && <p>No users found for current filters.</p>
        )}
      </div>

      {showAddModal && canWriteUsers ? (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>Add Users</h3>
              <button type="button" className="chip-btn" onClick={() => setShowAddModal(false)}>
                Close
              </button>
            </div>

            <div className="action-row" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className={addMode === 'single' ? 'primary-btn' : 'ghost-btn'}
                onClick={() => setAddMode('single')}
              >
                Single
              </button>
              <button
                type="button"
                className={addMode === 'bulk' ? 'primary-btn' : 'ghost-btn'}
                onClick={() => setAddMode('bulk')}
              >
                Bulk
              </button>
            </div>

            {addMode === 'single' ? (
              <form onSubmit={onCreateSingle} className="stack-gap">
                <label className="inline-field">
                  Name
                  <input
                    type="text"
                    value={singleForm.name}
                    onChange={(event) => setSingleForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </label>
                <label className="inline-field">
                  Slack ID
                  <input
                    type="text"
                    value={singleForm.slackId}
                    onChange={(event) => setSingleForm((prev) => ({ ...prev, slackId: event.target.value }))}
                    required
                  />
                </label>
                <label className="inline-field">
                  Email
                  <input
                    type="email"
                    value={singleForm.email || ''}
                    onChange={(event) => setSingleForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </label>
                <button className="primary-btn" type="submit" disabled={singleCreateMutation.isPending}>
                  Add User
                </button>
              </form>
            ) : (
              <form onSubmit={onCreateBulk} className="stack-gap">
                <p className="muted">Paste one user per line in format: name,slackId,email</p>
                <textarea
                  rows={8}
                  value={bulkRaw}
                  onChange={(event) => setBulkRaw(event.target.value)}
                  placeholder={'Rahul,U0A5YQ63CMT,rahul@example.com\nAsha,U019ABCDEF1,asha@example.com'}
                />
                <button className="ghost-btn" type="submit" disabled={bulkCreateMutation.isPending}>
                  Add Users in Bulk
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {editTarget && canWriteUsers ? (
        <div className="modal-backdrop" onClick={() => setEditTarget(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>Edit User</h3>
              <button type="button" className="chip-btn" onClick={() => setEditTarget(null)}>
                Close
              </button>
            </div>
            <form
              className="stack-gap"
              onSubmit={(event) => {
                event.preventDefault();
                updateUserMutation.mutate({
                  slackUserId: editTarget.slackUserId,
                  name: editingName,
                  email: editingEmail,
                  isMessageEnabled: editingMessaging
                });
              }}
            >
              <label className="inline-field">
                Slack ID (Read-only)
                <input type="text" value={editTarget.slackUserId} disabled />
              </label>
              <label className="inline-field">
                Name
                <input type="text" value={editingName} onChange={(event) => setEditingName(event.target.value)} />
              </label>
              <label className="inline-field">
                Email
                <input type="email" value={editingEmail} onChange={(event) => setEditingEmail(event.target.value)} />
              </label>
              <label className="toggle-wrap" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={editingMessaging}
                  onChange={(event) => setEditingMessaging(event.target.checked)}
                />
                <span>Messaging Enabled</span>
              </label>
              <div className="action-row">
                <button type="button" className="ghost-btn" onClick={() => setEditTarget(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={updateUserMutation.isPending}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {pendingAction ? (
        <div className="modal-backdrop" onClick={() => setPendingAction(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>{pendingAction.title}</h3>
            <p className="muted">{pendingAction.description}</p>
            <div className="action-row">
              <button type="button" className="ghost-btn" onClick={() => setPendingAction(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  pendingAction.onConfirm();
                  setPendingAction(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
