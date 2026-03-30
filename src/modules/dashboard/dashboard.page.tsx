import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';

type DashboardSummary = {
  activeUsers: number;
  messagingEnabled: number;
  pendingAttendance: number;
  overridesToday: number;
  activeTimers: number;
  dateYmd: string;
};

async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await apiClient.get('/api/admin/dashboard/summary');
  return response.data?.data;
}

export function DashboardPage() {
  const summaryQuery = useQuery({ queryKey: ['dashboard-summary'], queryFn: fetchDashboardSummary });
  const summary = summaryQuery.data;

  const stats = [
    { label: 'Active Users', value: String(summary?.activeUsers ?? '-'), tone: 'mint' },
    { label: 'Pending Attendance', value: String(summary?.pendingAttendance ?? '-'), tone: 'sun' },
    { label: 'Overrides Today', value: String(summary?.overridesToday ?? '-'), tone: 'sky' },
    { label: 'Messaging Enabled', value: String(summary?.messagingEnabled ?? '-'), tone: 'rose' },
    { label: 'Active Timers', value: String(summary?.activeTimers ?? '-'), tone: 'mint' }
  ];

  return (
    <section>
      <h2>Dashboard</h2>
      <p className="muted">Live summary metrics for today.</p>
      {summary?.dateYmd ? <p className="muted">Date: {summary.dateYmd}</p> : null}

      {summaryQuery.isLoading ? <p>Loading dashboard data...</p> : null}
      {summaryQuery.isError ? <p>Could not load dashboard metrics.</p> : null}

      <div className="grid-cards">
        {stats.map((stat) => (
          <article key={stat.label} className={`card stat-card ${stat.tone}`}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
