import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearSessionToken, hasPermission } from '../auth/session';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', visible: true },
  { path: '/users', label: 'Users', visible: hasPermission('users:read') },
  { path: '/projects', label: 'Projects', visible: hasPermission('projects:read') },
  { path: '/attendance', label: 'Attendance', visible: hasPermission('attendance:read') },
  { path: '/analytics', label: 'Analytics', visible: hasPermission('analytics:read') },
  { path: '/settings', label: 'Settings', visible: hasPermission('timers:read') || hasPermission('sync:read') }
];

export function AppLayout() {
  const navigate = useNavigate();

  const onLogout = () => {
    clearSessionToken();
    navigate('/login', { replace: true });
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <h1 className="brand-title">
          <img src="/app-icon.png" alt="SlackTrack" className="brand-icon" />
          <span>SlackTrack Admin</span>
        </h1>
        <nav>
          {navItems.filter((item) => item.visible).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="ghost-btn" onClick={onLogout} type="button">
          Logout
        </button>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
