import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';
import { hasPermission } from '../../shared/auth/session';
import { DismissibleNotice } from '../../shared/components/dismissible-notice';

type HolidayRow = {
  dateYmd: string;
  holidayName: string;
};

async function triggerSync(): Promise<void> {
  await apiClient.post('/api/admin/sync/reconcile');
}

async function fetchHolidays(): Promise<HolidayRow[]> {
  const response = await apiClient.get('/api/admin/holidays');
  return response.data?.data || [];
}

async function replaceHolidays(holidays: HolidayRow[]): Promise<void> {
  await apiClient.put('/api/admin/holidays', { holidays });
}

function parseHolidayText(raw: string): HolidayRow[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [dateYmd, ...nameParts] = line.split(',').map((part) => part.trim());
      return {
        dateYmd,
        holidayName: nameParts.join(', ') || 'Holiday'
      };
    });
}

export function SettingsPage() {
  const navigate = useNavigate();
  const syncMutation = useMutation({ mutationFn: triggerSync });
  const canReadHolidays = hasPermission('holidays:read');
  const canWriteHolidays = hasPermission('holidays:write');
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayRaw, setHolidayRaw] = useState('');
  const [holidayNotice, setHolidayNotice] = useState<string | null>(null);

  const holidaysQuery = useQuery({
    queryKey: ['settings-holidays'],
    queryFn: fetchHolidays,
    enabled: showHolidayModal && canReadHolidays
  });

  const parsedHolidays = useMemo(() => {
    if (!holidaysQuery.data) return '';
    return holidaysQuery.data.map((holiday) => `${holiday.dateYmd}, ${holiday.holidayName}`).join('\n');
  }, [holidaysQuery.data]);

  const saveHolidaysMutation = useMutation({
    mutationFn: replaceHolidays,
    onSuccess: () => {
      setHolidayNotice('Holidays saved.');
    },
    onError: () => {
      setHolidayNotice('Failed to save holidays. Check YYYY-MM-DD format.');
    }
  });

  const openHolidayModal = () => {
    setShowHolidayModal(true);
    setHolidayNotice(null);
  };

  useEffect(() => {
    if (!showHolidayModal) return;
    if (!parsedHolidays) return;
    setHolidayRaw(parsedHolidays);
  }, [showHolidayModal, parsedHolidays]);

  return (
    <section>
      <h2>Settings</h2>
      <p className="muted">Operational controls and configuration shortcuts.</p>

      <div className="grid-cards">
        <article className="card">
          <h3>Timers and Reminders</h3>
          <p>Manage reminder timers, select users, and send manual attendance notifications.</p>
          <button type="button" className="primary-btn" onClick={() => navigate('/settings/timers')}>
            Open Timers Page
          </button>
        </article>

        <article className="card">
          <h3>Sheet Sync</h3>
          <p>Run manual DB to sheet reconcile.</p>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            Trigger Sync
          </button>
        </article>

        {canReadHolidays ? (
          <article className="card">
            <h3>Holidays</h3>
            <p>Review and edit holiday calendar used by reminder and chat date-range logic.</p>
            <button type="button" className="ghost-btn" onClick={openHolidayModal}>
              Manage Holidays
            </button>
          </article>
        ) : null}
      </div>

      {showHolidayModal && canReadHolidays ? (
        <div className="modal-backdrop" onClick={() => setShowHolidayModal(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>Manage Holidays</h3>
              <button type="button" className="chip-btn" onClick={() => setShowHolidayModal(false)}>
                Close
              </button>
            </div>
            <p className="muted">Use one row per holiday: YYYY-MM-DD, Holiday Name</p>
            <DismissibleNotice message={holidayNotice} onClose={() => setHolidayNotice(null)} />
            <textarea
              rows={12}
              value={holidayRaw}
              onChange={(event) => setHolidayRaw(event.target.value)}
              placeholder={'2026-01-01, New Year\n2026-01-26, Republic Day'}
            />
            <div className="action-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setHolidayRaw(parsedHolidays)}
                disabled={holidaysQuery.isLoading}
              >
                Reset
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={!canWriteHolidays || saveHolidaysMutation.isPending}
                onClick={() => saveHolidaysMutation.mutate(parseHolidayText(holidayRaw))}
              >
                Save Holidays
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
