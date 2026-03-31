import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';
import { hasPermission } from '../../shared/auth/session';
import { DismissibleNotice } from '../../shared/components/dismissible-notice';

type AttendanceStatus = 'WFO' | 'WFH' | '-1' | '-0.5';

type AttendanceRow = {
  slackUserId: string;
  name: string | null;
  email: string | null;
  isMessageEnabled: boolean;
  dateYmd: string;
  status: AttendanceStatus | null;
  projects: string[];
};

type MonthlyAttendanceResponse = {
  month: string;
  dates: string[];
  nonWorkingDates: string[];
  users: Array<{
    slackUserId: string;
    name: string | null;
    email: string | null;
    isMessageEnabled: boolean;
    days: Array<{ dateYmd: string; status: AttendanceStatus | null; projects: string[] }>;
  }>;
};

function weekdayLabel(dateYmd: string): string {
  const date = new Date(`${dateYmd}T00:00:00`);
  const labels = ['S', 'M', 'T', 'W', 'Th', 'F', 'S'];
  return labels[date.getDay()] || '';
}

function compactUserLabel(name: string | null, slackUserId: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return slackUserId;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 2) {
    return words.slice(0, 2).join(' ');
  }

  return trimmed;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthKeyFromDate(dateYmd: string): string {
  return dateYmd.slice(0, 7);
}

async function fetchAttendance(dateYmd: string): Promise<AttendanceRow[]> {
  const response = await apiClient.get('/api/admin/attendance', { params: { dateYmd } });
  return response.data?.data || [];
}

async function fetchMonthlyAttendance(month: string): Promise<MonthlyAttendanceResponse> {
  const response = await apiClient.get('/api/admin/attendance/month', { params: { month } });
  return response.data?.data;
}

async function overrideAttendance(input: {
  slackUserId: string;
  dateYmd: string;
  status: AttendanceStatus;
}): Promise<void> {
  await apiClient.post('/api/admin/overrides/attendance', input);
}

export function AttendancePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const [viewType, setViewType] = useState<'day' | 'month'>('day');
  const [menuForUserId, setMenuForUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const attendanceQuery = useQuery({
    queryKey: ['attendance', selectedDate],
    queryFn: () => fetchAttendance(selectedDate)
  });

  const monthlyQuery = useQuery({
    queryKey: ['attendance-month', monthKeyFromDate(selectedDate)],
    queryFn: () => fetchMonthlyAttendance(monthKeyFromDate(selectedDate))
  });

  const overrideMutation = useMutation({
    mutationFn: overrideAttendance,
    onSuccess: async () => {
      setMessage('Attendance updated.');
      setMenuForUserId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['attendance', selectedDate] }),
        queryClient.invalidateQueries({ queryKey: ['attendance-month', monthKeyFromDate(selectedDate)] })
      ]);
    },
    onError: () => setMessage('Failed to update attendance.')
  });

  const dayRows = useMemo(() => attendanceQuery.data || [], [attendanceQuery.data]);
  const monthData = monthlyQuery.data;
  const nonWorkingDateSet = useMemo(() => new Set(monthData?.nonWorkingDates || []), [monthData?.nonWorkingDates]);
  const canOverride = hasPermission('overrides:write');

  const triggerOverride = (slackUserId: string, status: AttendanceStatus) => {
    overrideMutation.mutate({ slackUserId, dateYmd: selectedDate, status });
  };

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Attendance</h2>
          <p className="muted">Switch between day-wise and monthly attendance views.</p>
        </div>

        <div className="action-row">
          <button
            type="button"
            className={viewType === 'day' ? 'primary-btn' : 'ghost-btn'}
            onClick={() => setViewType('day')}
          >
            Day Wise
          </button>
          <button
            type="button"
            className={viewType === 'month' ? 'primary-btn' : 'ghost-btn'}
            onClick={() => setViewType('month')}
          >
            Monthly
          </button>
          <label className="inline-field">
            Date
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </label>
        </div>
      </div>

      <DismissibleNotice message={message} onClose={() => setMessage(null)} />

      {viewType === 'day' ? (
        <div className="card table-card">
          {attendanceQuery.isLoading ? <p>Loading attendance...</p> : null}
          {attendanceQuery.isError ? <p>Could not load attendance rows.</p> : null}

          {dayRows.length ? (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slack ID</th>
                  <th>Status</th>
                  <th>Projects</th>
                  {canOverride ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {dayRows.map((row) => (
                  <tr key={row.slackUserId}>
                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        title={row.name || row.slackUserId}
                        onClick={() =>
                          navigate(
                            `/attendance/users/${encodeURIComponent(row.slackUserId)}?month=${monthKeyFromDate(selectedDate)}`
                          )
                        }
                      >
                        {compactUserLabel(row.name, row.slackUserId)}
                      </button>
                    </td>
                    <td>{row.slackUserId}</td>
                    <td>{row.status || 'Not marked'}</td>
                    <td>{row.projects.length ? row.projects.join(', ') : '-'}</td>
                    {canOverride ? (
                      <td>
                        <div className="menu-wrap">
                          <button
                            type="button"
                            className="chip-btn"
                            onClick={() =>
                              setMenuForUserId((prev) => (prev === row.slackUserId ? null : row.slackUserId))
                            }
                          >
                            ...
                          </button>
                          {menuForUserId === row.slackUserId ? (
                            <div className="menu-popover">
                              <strong>Override</strong>
                              <button type="button" onClick={() => triggerOverride(row.slackUserId, 'WFO')}>
                                Mark WFO
                              </button>
                              <button type="button" onClick={() => triggerOverride(row.slackUserId, 'WFH')}>
                                Mark WFH
                              </button>
                              <button type="button" onClick={() => triggerOverride(row.slackUserId, '-1')}>
                                Mark Leave
                              </button>
                              <button type="button" onClick={() => triggerOverride(row.slackUserId, '-0.5')}>
                                Mark Half Day
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !attendanceQuery.isLoading && <p>No users found for attendance view.</p>
          )}
        </div>
      ) : (
        <div className="card table-card">
          {monthlyQuery.isLoading ? <p>Loading monthly attendance...</p> : null}
          {monthlyQuery.isError ? <p>Could not load monthly attendance.</p> : null}

          {monthData?.users?.length ? (
            <table className="attendance-month-table">
              <thead>
                <tr>
                  <th>User</th>
                  {monthData.dates.map((dateYmd) => (
                    <th key={dateYmd} className={nonWorkingDateSet.has(dateYmd) ? 'attendance-nonworking' : undefined}>
                      <div>{weekdayLabel(dateYmd)}</div>
                      <div>{dateYmd.slice(8)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthData.users.map((user) => (
                  <tr key={user.slackUserId}>
                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        title={user.name || user.slackUserId}
                        onClick={() =>
                          navigate(`/attendance/users/${encodeURIComponent(user.slackUserId)}?month=${monthData.month}`)
                        }
                      >
                        {compactUserLabel(user.name, user.slackUserId)}
                      </button>
                    </td>
                    {user.days.map((day) => (
                      <td
                        key={day.dateYmd}
                        className={nonWorkingDateSet.has(day.dateYmd) ? 'attendance-nonworking' : undefined}
                      >
                        {day.status || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !monthlyQuery.isLoading && <p>No monthly attendance data found.</p>
          )}
        </div>
      )}
    </section>
  );
}
