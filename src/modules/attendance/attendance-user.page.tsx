import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';

type UserMonthData = {
  slackUserId: string;
  name: string | null;
  email: string | null;
  month: string;
  days: Array<{ dateYmd: string; status: 'WFO' | 'WFH' | '-1' | '-0.5' | null; projects: string[] }>;
};

async function fetchUserMonth(slackUserId: string, month?: string): Promise<UserMonthData> {
  const response = await apiClient.get(`/api/admin/attendance/users/${encodeURIComponent(slackUserId)}/month`, {
    params: month ? { month } : undefined
  });
  return response.data?.data;
}

export function AttendanceUserPage() {
  const { slackUserId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const month = searchParams.get('month') || undefined;

  const query = useQuery({
    queryKey: ['attendance-user-month', slackUserId, month],
    queryFn: () => fetchUserMonth(slackUserId, month),
    enabled: Boolean(slackUserId)
  });

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>User Attendance</h2>
          <p className="muted">Monthly attendance timeline for individual user.</p>
        </div>
        <Link to="/attendance" className="ghost-btn as-link">
          Back to Attendance
        </Link>
      </div>

      <div className="card table-card">
        {query.isLoading ? <p>Loading user attendance...</p> : null}
        {query.isError ? <p>Could not load user attendance.</p> : null}

        {query.data ? (
          <>
            <p>
              <strong>{query.data.name || query.data.slackUserId}</strong> ({query.data.slackUserId})
            </p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Projects</th>
                </tr>
              </thead>
              <tbody>
                {query.data.days.map((day) => (
                  <tr key={day.dateYmd}>
                    <td>{day.dateYmd}</td>
                    <td>{day.status || 'Not marked'}</td>
                    <td>{day.projects.length ? day.projects.join(', ') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </div>
    </section>
  );
}
