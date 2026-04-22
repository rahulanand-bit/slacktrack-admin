import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';

type DashboardSummary = {
  activeUsers: number;
  messagingEnabled: number;
  pendingAttendance: number;
  overridesToday: number;
  activeTimers: number;
  dateYmd: string;
};

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchDashboardSummary(dateYmd: string): Promise<DashboardSummary> {
  const response = await apiClient.get('/api/admin/dashboard/summary', { params: { dateYmd } });
  return response.data?.data;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(() => {
    const raw = (searchParams.get('date') || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayYmd();
  });

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('date', selectedDate);
    setSearchParams(params, { replace: true });
  }, [selectedDate, setSearchParams]);

  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary', selectedDate],
    queryFn: () => fetchDashboardSummary(selectedDate)
  });
  const summary = summaryQuery.data;

  const stats = [
    {
      label: 'Active Users',
      value: String(summary?.activeUsers ?? '-'),
      tone: 'mint',
      onClick: () => navigate('/users')
    },
    {
      label: 'Pending Attendance',
      value: String(summary?.pendingAttendance ?? '-'),
      tone: 'sun',
      onClick: () => navigate('/attendance?view=day&status=not_marked')
    },
    { label: 'Overrides Today', value: String(summary?.overridesToday ?? '-'), tone: 'sky' },
    { label: 'Messaging Enabled', value: String(summary?.messagingEnabled ?? '-'), tone: 'rose' },
    {
      label: 'Active Timers',
      value: String(summary?.activeTimers ?? '-'),
      tone: 'mint',
      onClick: () => navigate('/settings/timers')
    }
  ];

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">Daily dashboard summary metrics.</p>
        </div>
        <label className="inline-field">
          Date
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
      </div>

      {summaryQuery.isLoading ? <p>Loading dashboard data...</p> : null}
      {summaryQuery.isError ? <p>Could not load dashboard metrics.</p> : null}

      <div className="grid-cards">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className={`card stat-card ${stat.tone}`}
            onClick={stat.onClick}
            role={stat.onClick ? 'button' : undefined}
            tabIndex={stat.onClick ? 0 : undefined}
            onKeyDown={(event) => {
              if (!stat.onClick) {
                return;
              }
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                stat.onClick();
              }
            }}
            style={stat.onClick ? { cursor: 'pointer' } : undefined}
          >
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
