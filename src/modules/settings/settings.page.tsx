export function SettingsPage() {
  return (
    <section>
      <h2>Settings</h2>
      <p className="muted">Sheet link, sync controls, and admin preferences.</p>

      <div className="grid-cards">
        <article className="card">
          <h3>Sheet Link</h3>
          <p>Connect and open the configured Google Sheet for quick review.</p>
          <button type="button" className="primary-btn" disabled>
            Open Sheet (coming soon)
          </button>
        </article>

        <article className="card">
          <h3>Sync Control</h3>
          <p>Trigger a manual DB to sheet reconcile and review latest sync status.</p>
          <button type="button" className="ghost-btn" disabled>
            Trigger Sync (coming soon)
          </button>
        </article>
      </div>
    </section>
  );
}
