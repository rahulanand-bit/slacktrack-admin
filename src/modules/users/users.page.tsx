import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';

type UserRow = {
  id: number;
  displayName: string | null;
  slackUserId: string;
  email: string | null;
  isMessageEnabled: boolean;
};

async function fetchUsers(): Promise<UserRow[]> {
  const response = await apiClient.get('/api/admin/users');
  return response.data?.data || [];
}

export function UsersPage() {
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

  return (
    <section>
      <h2>Users</h2>
      <p className="muted">Manage recipients and user profile metadata.</p>

      <div className="card table-card">
        {usersQuery.isLoading ? <p>Loading users...</p> : null}
        {usersQuery.isError ? <p>Could not load users.</p> : null}

        {usersQuery.data ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slack ID</th>
                <th>Email</th>
                <th>Messaging</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.data.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName || '-'}</td>
                  <td>{user.slackUserId}</td>
                  <td>{user.email || '-'}</td>
                  <td>
                    <span className={user.isMessageEnabled ? 'pill on' : 'pill off'}>
                      {user.isMessageEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </section>
  );
}
