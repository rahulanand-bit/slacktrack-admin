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
};

type CreateUserInput = {
  name: string;
  slackId: string;
  email?: string | null;
  isMessageEnabled?: boolean;
};

async function fetchUsers(): Promise<UserRow[]> {
  const response = await apiClient.get('/api/admin/users');
  return response.data?.data || [];
}

async function createUser(input: CreateUserInput): Promise<void> {
  await apiClient.post('/api/admin/users', input);
}

async function createUsersBulk(users: CreateUserInput[]): Promise<void> {
  await apiClient.post('/api/admin/users/bulk', { users });
}

async function updateUser(slackUserId: string, input: { email?: string | null }): Promise<void> {
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

export function UsersPage() {
  const canWriteUsers = hasPermission('users:write');
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const users = useMemo(() => usersQuery.data || [], [usersQuery.data]);
  const [selectedUserIds, setSelectedUserIds] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(
    () => Object.entries(selectedUserIds).filter(([, selected]) => selected).map(([slackUserId]) => slackUserId),
    [selectedUserIds]
  );
  const allSelected = users.length > 0 && users.every((user) => Boolean(selectedUserIds[user.slackUserId]));

  const [notice, setNotice] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single');
  const [editingSlackUserId, setEditingSlackUserId] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState('');
  const [singleForm, setSingleForm] = useState<CreateUserInput>({
    name: '',
    slackId: '',
    email: '',
    isMessageEnabled: true
  });
  const [bulkRaw, setBulkRaw] = useState('');

  const singleCreateMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      setNotice('User added.');
      setSingleForm({ name: '', slackId: '', email: '', isMessageEnabled: true });
      setShowAddModal(false);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => setNotice('Failed to add user.')
  });

  const bulkCreateMutation = useMutation({
    mutationFn: createUsersBulk,
    onSuccess: async () => {
      setNotice('Bulk users added.');
      setBulkRaw('');
      setShowAddModal(false);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => setNotice('Failed to add bulk users. Check input format.')
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ slackUserId, email }: { slackUserId: string; email: string }) =>
      updateUser(slackUserId, { email: email || null }),
    onSuccess: async () => {
      setNotice('User email updated.');
      setEditingSlackUserId(null);
      setEditingEmail('');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => setNotice('Failed to update email.')
  });

  const bulkMessagingMutation = useMutation({
    mutationFn: async ({ slackUserIds, isMessageEnabled }: { slackUserIds: string[]; isMessageEnabled: boolean }) => {
      await Promise.all(slackUserIds.map((slackUserId) => setMessaging(slackUserId, isMessageEnabled)));
    },
    onSuccess: async (_data, variables) => {
      setNotice(`Messaging ${variables.isMessageEnabled ? 'enabled' : 'disabled'} for ${variables.slackUserIds.length} users.`);
      setSelectedUserIds({});
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => setNotice('Failed to update bulk messaging state.')
  });

  const onCreateSingle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    singleCreateMutation.mutate({
      ...singleForm,
      email: singleForm.email?.trim() || null
    });
  };

  const onCreateBulk = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const parsed = parseBulkUsers(bulkRaw);
      bulkCreateMutation.mutate(parsed);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Invalid bulk input');
    }
  };

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Users</h2>
          <p className="muted">Manage recipients, messaging state, and user email metadata.</p>
        </div>
        {canWriteUsers ? (
          <div className="action-row">
            <button
              type="button"
              className="ghost-btn"
              disabled={selectedIds.length === 0 || bulkMessagingMutation.isPending}
              onClick={() => bulkMessagingMutation.mutate({ slackUserIds: selectedIds, isMessageEnabled: true })}
            >
              Enable Selected ({selectedIds.length})
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={selectedIds.length === 0 || bulkMessagingMutation.isPending}
              onClick={() => bulkMessagingMutation.mutate({ slackUserIds: selectedIds, isMessageEnabled: false })}
            >
              Disable Selected ({selectedIds.length})
            </button>
            <button type="button" className="primary-btn" onClick={() => setShowAddModal(true)}>
              Add Users
            </button>
          </div>
        ) : null}
      </div>
      <DismissibleNotice message={notice} onClose={() => setNotice(null)} />

      <div className="card table-card">
        {usersQuery.isLoading ? <p>Loading users...</p> : null}
        {usersQuery.isError ? <p>Could not load users.</p> : null}

        {users.length ? (
          <table>
            <thead>
              <tr>
                {canWriteUsers ? (
                  <th>
                    <label className="toggle-wrap" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          if (!checked) {
                            setSelectedUserIds({});
                            return;
                          }

                          const nextSelection: Record<string, boolean> = {};
                          for (const row of users) {
                            nextSelection[row.slackUserId] = true;
                          }
                          setSelectedUserIds(nextSelection);
                        }}
                      />
                      <span>Select All</span>
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
              {users.map((user) => (
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
                  <td>
                    {editingSlackUserId === user.slackUserId ? (
                      <div className="action-row">
                        <input
                          type="email"
                          placeholder="email@example.com"
                          value={editingEmail}
                          onChange={(event) => setEditingEmail(event.target.value)}
                        />
                        <button
                          type="button"
                          className="chip-btn"
                          onClick={() =>
                            updateUserMutation.mutate({
                              slackUserId: user.slackUserId,
                              email: editingEmail
                            })
                          }
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="chip-btn"
                          onClick={() => {
                            setEditingSlackUserId(null);
                            setEditingEmail('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      user.email || '-'
                    )}
                  </td>
                  <td>
                    <span className={user.isMessageEnabled ? 'pill on' : 'pill off'}>
                      {user.isMessageEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  {canWriteUsers ? (
                    <td>
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={() => {
                          setEditingSlackUserId(user.slackUserId);
                          setEditingEmail(user.email || '');
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
        ) : null}
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
    </section>
  );
}
