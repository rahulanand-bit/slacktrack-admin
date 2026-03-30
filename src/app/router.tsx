import { Navigate, createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '../modules/auth/login.page';
import { AttendancePage } from '../modules/attendance/attendance.page';
import { DashboardPage } from '../modules/dashboard/dashboard.page';
import { SettingsPage } from '../modules/settings/settings.page';
import { UsersPage } from '../modules/users/users.page';
import { AppLayout } from '../shared/components/layout';
import { getSessionToken } from '../shared/auth/session';

function RequireAuth({ children }: { children: JSX.Element }) {
  if (!getSessionToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export const appRouter = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/users', element: <UsersPage /> },
      { path: '/attendance', element: <AttendancePage /> },
      { path: '/settings', element: <SettingsPage /> }
    ]
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> }
]);
