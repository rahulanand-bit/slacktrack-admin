import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiClient } from '../../shared/api/client';

type ProjectAnalyticsRow = {
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  projectName: string;
  daysWorked: number;
};

type ProjectAnalyticsResponse = {
  month: string;
  rows: ProjectAnalyticsRow[];
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

async function fetchProjectAnalytics(month: string): Promise<ProjectAnalyticsResponse> {
  const response = await apiClient.get('/api/admin/analytics/projects', { params: { month } });
  return response.data?.data;
}

export function AnalyticsPage() {
  const [month, setMonth] = useState(currentMonth);

  const query = useQuery({
    queryKey: ['analytics-projects', month],
    queryFn: () => fetchProjectAnalytics(month)
  });

  const rows = useMemo(() => query.data?.rows || [], [query.data?.rows]);

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Analytics</h2>
          <p className="muted">Per project monthly days worked by employee (WFO/WFH only).</p>
        </div>
        <label className="inline-field">
          Month
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </div>

      <div className="card table-card">
        {query.isLoading ? <p>Loading analytics...</p> : null}
        {query.isError ? <p>Could not load analytics data.</p> : null}

        {rows.length ? (
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Employee</th>
                <th>Email</th>
                <th>Slack ID</th>
                <th>Days Worked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.projectName}:${row.slackUserId}`}>
                  <td>{row.projectName}</td>
                  <td>{row.displayName || row.slackUserId}</td>
                  <td>{row.email || '-'}</td>
                  <td>{row.slackUserId}</td>
                  <td>{row.daysWorked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !query.isLoading && <p>No analytics data found for this month.</p>
        )}
      </div>
    </section>
  );
}
