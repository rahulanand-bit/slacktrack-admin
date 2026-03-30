const stats = [
  { label: 'Active Users', value: '18', tone: 'mint' },
  { label: 'Pending Attendance', value: '4', tone: 'sun' },
  { label: 'Overrides Today', value: '2', tone: 'sky' },
  { label: 'Messaging Enabled', value: '15', tone: 'rose' }
];

export function DashboardPage() {
  return (
    <section>
      <h2>Dashboard</h2>
      <p className="muted">Quick operations view for HR and managers.</p>

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
