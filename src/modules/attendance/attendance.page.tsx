import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';
import { hasPermission } from '../../shared/auth/session';

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
  users: Array<{
    slackUserId: string;
    name: string | null;
    email: string | null;
    isMessageEnabled: boolean;
    days: Array<{ dateYmd: string; status: AttendanceStatus | null; projects: string[] }>;
  }>;
};

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

      {message ? <div className="info-box">{message}</div> : null}

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
                        onClick={() =>
                          navigate(
                            `/attendance/users/${encodeURIComponent(row.slackUserId)}?month=${monthKeyFromDate(selectedDate)}`
                          )
                        }
                      >
                        {row.name || row.slackUserId}
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
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  {monthData.dates.map((dateYmd) => (
                    <th key={dateYmd}>{dateYmd.slice(8)}</th>
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
                        onClick={() =>
                          navigate(`/attendance/users/${encodeURIComponent(user.slackUserId)}?month=${monthData.month}`)
                        }
                      >
                        {user.name || user.slackUserId}
                      </button>
                    </td>
                    {user.days.map((day) => (
                      <td key={day.dateYmd}>{day.status || '-'}</td>
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
