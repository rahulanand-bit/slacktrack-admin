import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { apiClient } from '../../shared/api/client';
import { hasPermission } from '../../shared/auth/session';

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

  const messagingMutation = useMutation({
    mutationFn: ({ slackUserId, isMessageEnabled }: { slackUserId: string; isMessageEnabled: boolean }) =>
      setMessaging(slackUserId, isMessageEnabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => setNotice('Failed to update messaging state.')
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
          <button type="button" className="primary-btn" onClick={() => setShowAddModal(true)}>
            Add Users
          </button>
        ) : null}
      </div>
      {notice ? <div className="info-box">{notice}</div> : null}

      <div className="card table-card">
        {usersQuery.isLoading ? <p>Loading users...</p> : null}
        {usersQuery.isError ? <p>Could not load users.</p> : null}

        {users.length ? (
          <table>
            <thead>
              <tr>
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
                    {canWriteUsers ? (
                      <label className="toggle-wrap">
                        <input
                          type="checkbox"
                          checked={user.isMessageEnabled}
                          onChange={(event) =>
                            messagingMutation.mutate({
                              slackUserId: user.slackUserId,
                              isMessageEnabled: event.target.checked
                            })
                          }
                        />
                        <span>{user.isMessageEnabled ? 'Enabled' : 'Disabled'}</span>
                      </label>
                    ) : (
                      <span className={user.isMessageEnabled ? 'pill on' : 'pill off'}>
                        {user.isMessageEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    )}
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
