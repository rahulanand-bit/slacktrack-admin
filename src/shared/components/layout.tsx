import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearSessionToken } from '../auth/session';

const navItems = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/users', label: 'Users' },
  { path: '/attendance', label: 'Attendance' },
  { path: '/settings', label: 'Settings' }
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
        <h1>SlackTrack Admin</h1>
        <nav>
          {navItems.map((item) => (
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
