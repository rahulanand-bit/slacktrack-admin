import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';

type StatusValue = 'WFO' | 'WFH' | '-1' | '-0.5' | null;

type UserAttendanceData = {
  slackUserId: string;
  name: string | null;
  email: string | null;
  days: Array<{ dateYmd: string; status: StatusValue; projects: string[] }>;
};

type UserMonthData = UserAttendanceData & {
  month: string;
  nonWorkingDates: string[];
  holidayDates?: string[];
  weekendDates?: string[];
};

type UserRangeData = UserAttendanceData & {
  period: { from: string; to: string };
  nonWorkingDates: string[];
  holidayDates?: string[];
  weekendDates?: string[];
};

type UserProjectAnalytics = {
  period: { from: string; to: string };
  slackUserId: string;
  rows: Array<{ projectName: string; daysWorked: number }>;
};

function weekdayLabel(dateYmd: string): string {
  const date = new Date(`${dateYmd}T00:00:00`);
  const labels = ['S', 'M', 'T', 'W', 'Th', 'F', 'S'];
  return labels[date.getDay()] || '';
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function weekRangeFor(dateYmd: string): { from: string; to: string } {
  const date = new Date(`${dateYmd}T00:00:00`);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const fromDate = new Date(date);
  fromDate.setDate(date.getDate() + diffToMonday);
  const toDate = new Date(fromDate);
  toDate.setDate(fromDate.getDate() + 6);
  return { from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10) };
}

function formatDayValue(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(1);
}

function compactProjects(projects: string[]): { primary: string; remaining: number; tooltip: string } | null {
  const cleaned = projects.map((value) => value.trim()).filter(Boolean);
  if (!cleaned.length) {
    return null;
  }
  return {
    primary: cleaned[0],
    remaining: Math.max(cleaned.length - 1, 0),
    tooltip: cleaned.join(', ')
  };
}

async function fetchUserMonth(slackUserId: string, month: string): Promise<UserMonthData> {
  const response = await apiClient.get(`/api/admin/attendance/users/${encodeURIComponent(slackUserId)}/month`, {
    params: { month }
  });
  return response.data?.data;
}

async function fetchUserRange(slackUserId: string, from: string, to: string): Promise<UserRangeData> {
  const response = await apiClient.get(`/api/admin/attendance/users/${encodeURIComponent(slackUserId)}/range`, {
    params: { from, to }
  });
  return response.data?.data;
}

async function fetchUserProjectAnalyticsByMonth(slackUserId: string, month: string): Promise<UserProjectAnalytics> {
  const response = await apiClient.get(`/api/admin/analytics/users/${encodeURIComponent(slackUserId)}/projects`, {
    params: { month }
  });
  return response.data?.data;
}

async function fetchUserProjectAnalyticsByRange(
  slackUserId: string,
  from: string,
  to: string
): Promise<UserProjectAnalytics> {
  const response = await apiClient.get(`/api/admin/analytics/users/${encodeURIComponent(slackUserId)}/projects`, {
    params: { from, to }
  });
  return response.data?.data;
}

export function AttendanceUserPage() {
  const { slackUserId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const mode = searchParams.get('mode') === 'week' ? 'week' : 'month';
  const month = /^\d{4}-\d{2}$/.test(searchParams.get('month') || '') ? String(searchParams.get('month')) : currentMonth();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('date') || '') ? String(searchParams.get('date')) : todayYmd();
  const weekRange = useMemo(() => weekRangeFor(date), [date]);

  const monthQuery = useQuery({
    queryKey: ['attendance-user-month', slackUserId, month],
    queryFn: () => fetchUserMonth(slackUserId, month),
    enabled: Boolean(slackUserId) && mode === 'month'
  });

  const weekQuery = useQuery({
    queryKey: ['attendance-user-week', slackUserId, weekRange.from, weekRange.to],
    queryFn: () => fetchUserRange(slackUserId, weekRange.from, weekRange.to),
    enabled: Boolean(slackUserId) && mode === 'week'
  });

  const projectAnalyticsQuery = useQuery({
    queryKey: ['attendance-user-project-analytics', slackUserId, mode, month, weekRange.from, weekRange.to],
    queryFn: () =>
      mode === 'month'
        ? fetchUserProjectAnalyticsByMonth(slackUserId, month)
        : fetchUserProjectAnalyticsByRange(slackUserId, weekRange.from, weekRange.to),
    enabled: Boolean(slackUserId)
  });

  const data = mode === 'month' ? monthQuery.data : weekQuery.data;
  const loading = mode === 'month' ? monthQuery.isLoading : weekQuery.isLoading;
  const error = mode === 'month' ? monthQuery.isError : weekQuery.isError;
  const holidayDateSet = useMemo(() => new Set(data?.holidayDates || []), [data?.holidayDates]);
  const weekendDateSet = useMemo(() => new Set(data?.weekendDates || []), [data?.weekendDates]);

  const summary = useMemo(() => {
    const rows = data?.days || [];
    return {
      wfo: rows.filter((row) => row.status === 'WFO').length,
      wfh: rows.filter((row) => row.status === 'WFH').length,
      leave: rows.filter((row) => row.status === '-1').length,
      halfDay: rows.filter((row) => row.status === '-0.5').length
    };
  }, [data?.days]);

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>User Attendance Analysis</h2>
          <p className="muted">Weekly/monthly analysis with date-wise status and project selections.</p>
        </div>
        <div className="action-row">
          <button
            type="button"
            className={mode === 'month' ? 'primary-btn' : 'ghost-btn'}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set('mode', 'month');
              params.set('month', month);
              params.set('date', date);
              setSearchParams(params, { replace: true });
            }}
          >
            Monthly
          </button>
          <button
            type="button"
            className={mode === 'week' ? 'primary-btn' : 'ghost-btn'}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set('mode', 'week');
              params.set('month', month);
              params.set('date', date);
              setSearchParams(params, { replace: true });
            }}
          >
            Weekly
          </button>
          {mode === 'month' ? (
            <label className="inline-field">
              Month
              <input
                type="month"
                value={month}
                onChange={(event) => {
                  const params = new URLSearchParams(searchParams);
                  params.set('month', event.target.value);
                  setSearchParams(params, { replace: true });
                }}
              />
            </label>
          ) : (
            <label className="inline-field">
              Date
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  const params = new URLSearchParams(searchParams);
                  params.set('date', event.target.value);
                  setSearchParams(params, { replace: true });
                }}
              />
            </label>
          )}
          <Link to="/attendance" className="ghost-btn as-link">
            Back
          </Link>
        </div>
      </div>

      {loading ? <p>Loading user attendance...</p> : null}
      {error ? <p>Could not load user attendance.</p> : null}

      {data ? (
        <>
          <p>
            <strong>{data.name || data.slackUserId}</strong> ({data.slackUserId})
          </p>
          <div className="grid-cards" style={{ marginTop: 8 }}>
            <article className="card stat-card mint">
              <span>WFO</span>
              <strong>{summary.wfo}</strong>
            </article>
            <article className="card stat-card sky">
              <span>WFH</span>
              <strong>{summary.wfh}</strong>
            </article>
            <article className="card stat-card sun">
              <span>Leave</span>
              <strong>{summary.leave}</strong>
            </article>
            <article className="card stat-card rose">
              <span>Half Day</span>
              <strong>{summary.halfDay}</strong>
            </article>
          </div>
        </>
      ) : null}

      <div className="card table-card" style={{ marginTop: 14 }}>
        <h3>Project-wise Days</h3>
        {projectAnalyticsQuery.isLoading ? <p>Loading project analytics...</p> : null}
        {projectAnalyticsQuery.isError ? <p>Could not load project analytics.</p> : null}
        {projectAnalyticsQuery.data?.rows?.length ? (
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Days Worked</th>
              </tr>
            </thead>
            <tbody>
              {projectAnalyticsQuery.data.rows.map((row) => (
                <tr key={row.projectName}>
                  <td className="user-project-col" title={row.projectName}>
                    {row.projectName}
                  </td>
                  <td>{formatDayValue(row.daysWorked)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !projectAnalyticsQuery.isLoading && <p>No project analytics found for this period.</p>
        )}
      </div>

      <div className="card table-card" style={{ marginTop: 14 }}>
        <h3>{mode === 'month' ? `Monthly Detail (${month})` : `Weekly Detail (${weekRange.from} to ${weekRange.to})`}</h3>
        {data?.days?.length ? (
          <div className="attendance-month-wrap">
            <table className="attendance-month-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  {data.days.map((day) => (
                    <th
                      key={day.dateYmd}
                      className={
                        holidayDateSet.has(day.dateYmd)
                          ? 'attendance-holiday'
                          : weekendDateSet.has(day.dateYmd)
                            ? 'attendance-weekend'
                            : undefined
                      }
                    >
                      <div>{weekdayLabel(day.dateYmd)}</div>
                      <div>{day.dateYmd.slice(8)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Status</td>
                  {data.days.map((day) => (
                    <td
                      key={`status-${day.dateYmd}`}
                      className={
                        holidayDateSet.has(day.dateYmd)
                          ? 'attendance-holiday'
                          : weekendDateSet.has(day.dateYmd)
                            ? 'attendance-weekend'
                            : undefined
                      }
                    >
                      {day.status || '-'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Projects</td>
                  {data.days.map((day) => (
                    <td
                      key={`projects-${day.dateYmd}`}
                      className={
                        holidayDateSet.has(day.dateYmd)
                          ? 'attendance-holiday'
                          : weekendDateSet.has(day.dateYmd)
                            ? 'attendance-weekend'
                            : undefined
                      }
                    >
                      {(() => {
                        const projectInfo = compactProjects(day.projects);
                        if (!projectInfo) {
                          return '-';
                        }

                        return (
                          <span className="project-pill-wrap" title={projectInfo.tooltip}>
                            <span className="project-pill">{projectInfo.primary}</span>
                            {projectInfo.remaining > 0 ? (
                              <span className="project-pill extra">+{projectInfo.remaining}</span>
                            ) : null}
                          </span>
                        );
                      })()}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          !loading && <p>No attendance entries found for this period.</p>
        )}
      </div>
    </section>
  );
}
