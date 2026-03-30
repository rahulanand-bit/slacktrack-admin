import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';

async function triggerSync(): Promise<void> {
  await apiClient.post('/api/admin/sync/reconcile');
}

export function SettingsPage() {
  const navigate = useNavigate();
  const syncMutation = useMutation({ mutationFn: triggerSync });

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
      </div>
    </section>
  );
}
