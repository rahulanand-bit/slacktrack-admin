import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  return (
    <section>
      <div className="card">
        <h2>Access Restricted</h2>
        <p className="muted">You do not have permission to view this page.</p>
        <Link to="/dashboard" className="ghost-btn as-link">
          Go to Dashboard
        </Link>
      </div>
    </section>
  );
}
