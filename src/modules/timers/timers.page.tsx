import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { apiClient } from '../../shared/api/client';

type TimerRow = {
  id: number;
  name: string;
  timerType: 'morning' | 'evening' | 'custom';
  cronExpression: string;
  timezone: string;
  active: boolean;
};

type AttendanceRow = {
  slackUserId: string;
  name: string | null;
  status: 'WFO' | 'WFH' | '-1' | '-0.5' | null;
};

type CreateTimerInput = {
  name: string;
  timerType: 'morning' | 'evening' | 'custom';
  time: string;
  timezone: string;
  active: boolean;
};

function cronToTime(cronExpression: string): string {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return cronExpression;
  const minutes = Number(parts[0]);
  const hours = Number(parts[1]);
  if (!Number.isFinite(minutes) || !Number.isFinite(hours)) return cronExpression;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}`;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchTimers(): Promise<TimerRow[]> {
  const response = await apiClient.get('/api/admin/timers');
  return response.data?.data || [];
}

async function fetchTodayAttendance(): Promise<AttendanceRow[]> {
  const response = await apiClient.get('/api/admin/attendance', { params: { dateYmd: todayYmd() } });
  return response.data?.data || [];
}

async function createTimer(input: CreateTimerInput): Promise<void> {
  await apiClient.post('/api/admin/timers', input);
}

async function toggleTimer(input: { id: number; active: boolean }): Promise<void> {
  await apiClient.patch(`/api/admin/timers/${input.id}`, { active: input.active });
}

async function deleteTimer(id: number): Promise<void> {
  await apiClient.delete(`/api/admin/timers/${id}`);
}

async function triggerAttendanceReminder(slackUserIds?: string[]): Promise<void> {
  await apiClient.post('/api/admin/timers/trigger-attendance',
    slackUserIds && slackUserIds.length > 0 ? { slackUserIds } : {}
  );
}

export function TimersPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Record<string, boolean>>({});
  const [timerForm, setTimerForm] = useState<CreateTimerInput>({
    name: '',
    timerType: 'custom',
    time: '09:00',
    timezone: 'Asia/Kolkata',
    active: true
  });

  const timersQuery = useQuery({ queryKey: ['timers'], queryFn: fetchTimers });
  const attendanceQuery = useQuery({ queryKey: ['attendance-today'], queryFn: fetchTodayAttendance });
  const timers = useMemo(() => timersQuery.data || [], [timersQuery.data]);
  const attendanceRows = useMemo(() => attendanceQuery.data || [], [attendanceQuery.data]);

  const selectedIds = useMemo(
    () => Object.entries(selectedUserIds).filter(([, selected]) => selected).map(([slackUserId]) => slackUserId),
    [selectedUserIds]
  );

  const createTimerMutation = useMutation({
    mutationFn: createTimer,
    onSuccess: async () => {
      setNotice('Timer created.');
      setTimerForm({ name: '', timerType: 'custom', time: '09:00', timezone: 'Asia/Kolkata', active: true });
      await queryClient.invalidateQueries({ queryKey: ['timers'] });
    },
    onError: () => setNotice('Failed to create timer.')
  });

  const toggleTimerMutation = useMutation({
    mutationFn: toggleTimer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['timers'] });
    }
  });

  const deleteTimerMutation = useMutation({
    mutationFn: deleteTimer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['timers'] });
      setNotice('Timer deleted.');
    }
  });

  const manualReminderMutation = useMutation({
    mutationFn: triggerAttendanceReminder,
    onSuccess: () => {
      setNotice('Manual attendance reminder sent.');
      setSelectedUserIds({});
    }
  });

  const onCreateTimer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createTimerMutation.mutate(timerForm);
  };

  return (
    <section>
      <h2>Timers</h2>
      <p className="muted">Create timers with simple time input and send manual attendance reminders.</p>
      {notice ? <div className="info-box">{notice}</div> : null}

      <div className="grid-cards">
        <article className="card">
          <h3>Create Timer</h3>
          <form onSubmit={onCreateTimer} className="stack-gap">
            <label className="inline-field">
              Name
              <input
                type="text"
                value={timerForm.name}
                onChange={(event) => setTimerForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>
            <label className="inline-field">
              Type
              <select
                value={timerForm.timerType}
                onChange={(event) =>
                  setTimerForm((prev) => ({ ...prev, timerType: event.target.value as CreateTimerInput['timerType'] }))
                }
              >
                <option value="morning">morning</option>
                <option value="evening">evening</option>
                <option value="custom">custom</option>
              </select>
            </label>
            <label className="inline-field">
              Time
              <input
                type="time"
                value={timerForm.time}
                onChange={(event) => setTimerForm((prev) => ({ ...prev, time: event.target.value }))}
                required
              />
            </label>
            <label className="inline-field">
              Timezone
              <input
                type="text"
                value={timerForm.timezone}
                onChange={(event) => setTimerForm((prev) => ({ ...prev, timezone: event.target.value }))}
                required
              />
            </label>
            <button className="primary-btn" type="submit" disabled={createTimerMutation.isPending}>
              Add Timer
            </button>
          </form>
        </article>

        <article className="card table-card">
          <h3>Send Manual Notifications</h3>
          <p className="muted">Select users manually or send to all pending-attendance users for today.</p>
          <div className="action-row" style={{ marginBottom: 10 }}>
            <button
              type="button"
              className="primary-btn"
              disabled={manualReminderMutation.isPending || selectedIds.length === 0}
              onClick={() => manualReminderMutation.mutate(selectedIds)}
            >
              Send Selected ({selectedIds.length})
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={manualReminderMutation.isPending}
              onClick={() => manualReminderMutation.mutate(undefined)}
            >
              Send All Pending
            </button>
          </div>

          {attendanceQuery.isLoading ? <p>Loading users...</p> : null}
          {attendanceRows.length ? (
            <table>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Name</th>
                  <th>Slack ID</th>
                  <th>Today Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map((row) => (
                  <tr key={row.slackUserId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedUserIds[row.slackUserId])}
                        onChange={(event) =>
                          setSelectedUserIds((prev) => ({
                            ...prev,
                            [row.slackUserId]: event.target.checked
                          }))
                        }
                      />
                    </td>
                    <td>{row.name || '-'}</td>
                    <td>{row.slackUserId}</td>
                    <td>{row.status || 'Not marked'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !attendanceQuery.isLoading && <p>No users available.</p>
          )}
        </article>
      </div>

      <div className="card table-card">
        <h3>Timer List</h3>
        {timersQuery.isLoading ? <p>Loading timers...</p> : null}
        {timers.length ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Time</th>
                <th>Timezone</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {timers.map((timer) => (
                <tr key={timer.id}>
                  <td>{timer.name}</td>
                  <td>{timer.timerType}</td>
                  <td>{cronToTime(timer.cronExpression)}</td>
                  <td>{timer.timezone}</td>
                  <td>{timer.active ? 'Yes' : 'No'}</td>
                  <td>
                    <div className="action-row">
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={() => toggleTimerMutation.mutate({ id: timer.id, active: !timer.active })}
                      >
                        {timer.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="chip-btn danger"
                        onClick={() => deleteTimerMutation.mutate(timer.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !timersQuery.isLoading && <p>No timers found.</p>
        )}
      </div>
    </section>
  );
}
