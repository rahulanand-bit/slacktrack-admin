import { Navigate, createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '../modules/auth/login.page';
import { ForbiddenPage } from '../modules/auth/forbidden.page';
import { AttendancePage } from '../modules/attendance/attendance.page';
import { AttendanceUserPage } from '../modules/attendance/attendance-user.page';
import { AnalyticsPage } from '../modules/analytics/analytics.page';
import { DashboardPage } from '../modules/dashboard/dashboard.page';
import { ProjectsPage } from '../modules/projects/projects.page';
import { SettingsPage } from '../modules/settings/settings.page';
import { TimersPage } from '../modules/timers/timers.page';
import { UsersPage } from '../modules/users/users.page';
import { AppLayout } from '../shared/components/layout';
import { getSessionToken, hasPermission } from '../shared/auth/session';

function RequireAuth({ children }: { children: JSX.Element }) {
  if (!getSessionToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RequirePermission({ permission, children }: { permission: string; children: JSX.Element }) {
  if (!hasPermission(permission)) {
    return <Navigate to="/forbidden" replace />;
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
      { path: '/forbidden', element: <ForbiddenPage /> },
      {
        path: '/users',
        element: (
          <RequirePermission permission="users:read">
            <UsersPage />
          </RequirePermission>
        )
      },
      {
        path: '/projects',
        element: (
          <RequirePermission permission="projects:read">
            <ProjectsPage />
          </RequirePermission>
        )
      },
      {
        path: '/attendance',
        element: (
          <RequirePermission permission="attendance:read">
            <AttendancePage />
          </RequirePermission>
        )
      },
      {
        path: '/attendance/users/:slackUserId',
        element: (
          <RequirePermission permission="attendance:read">
            <AttendanceUserPage />
          </RequirePermission>
        )
      },
      {
        path: '/analytics',
        element: (
          <RequirePermission permission="analytics:read">
            <AnalyticsPage />
          </RequirePermission>
        )
      },
      {
        path: '/settings',
        element: (
          <RequirePermission permission="sync:read">
            <SettingsPage />
          </RequirePermission>
        )
      },
      {
        path: '/settings/timers',
        element: (
          <RequirePermission permission="timers:read">
            <TimersPage />
          </RequirePermission>
        )
      }
    ]
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> }
]);
