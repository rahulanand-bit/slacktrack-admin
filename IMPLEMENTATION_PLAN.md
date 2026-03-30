# SlackTrack Admin - Implementation Plan

## Goal

Build a basic, colorful, modular admin panel for HR and managers to manage users and attendance operations without using raw admin API keys.

## Primary Users

- HR: full people operations (user management + attendance overrides)
- Manager: mostly view access with limited override capability

## Core Features (MVP)

1. Login and logout (email + password)
2. Users list with attendance visibility
3. Sheet link and sync visibility
4. Add user flow
5. Override/update attendance flow

## Recommended Additional Features

1. Dashboard summary cards (pending attendance, active users, recent overrides)
2. Audit log timeline (who changed what and when)
3. Filters (date, user, status) and quick search
4. Role-aware UI (hide/disable actions not permitted)
5. Toasts/loading/empty/error states for all pages

## Frontend Stack

- React + TypeScript + Vite
- React Router (protected routes)
- TanStack Query (API state)
- Component library/theme system (colorful but clean)

## Proposed Frontend Structure

```
slacktrack-admin/
  src/
    app/
      router.tsx
      providers.tsx
    modules/
      auth/
      dashboard/
      users/
      attendance/
      settings/
      audit/
    shared/
      api/
      components/
      hooks/
      theme/
      utils/
```

## Page Plan

1. `/login`
   - Email/password form
   - Validation and error states
2. `/dashboard`
   - KPI cards + quick links
3. `/users`
   - Users table: name, slackId, email, messaging status
   - Add user modal
4. `/attendance`
   - Date-wise attendance view
   - Override action (role-limited)
5. `/settings`
   - Sheet link display and quick open
   - Trigger manual sync action
6. `/audit`
   - Recent admin activity logs

## Backend Dependency (from `slacktrack-server`)

Admin panel requires these APIs:

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/me`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/overrides/attendance` (or equivalent override endpoint)
- `GET /api/admin/attendance` (for listing)
- `GET /api/admin/sheet/meta`
- `POST /api/admin/sync/reconcile`

## Role Model (Target)

- `hr`
  - users:read/write
  - attendance:read/write
  - overrides:write
  - sync:write
  - audit:read
- `manager`
  - users:read
  - attendance:read
  - overrides:write (limited scope, team-level)
  - sync:read

## Delivery Phases

### Phase 1
- App bootstrap, theme, routing, login/logout, protected layout

### Phase 2
- Users page (list + add user + messaging status)

### Phase 3
- Attendance page (list + override action)

### Phase 4
- Settings + sheet link + manual reconcile trigger

### Phase 5
- Audit log + UI polish + responsive pass

## Non-Goals (Initial)

- SSO/OAuth login
- Complex org hierarchy
- Advanced analytics/reports

## Definition of Done (MVP)

1. HR and manager can log in with email/password.
2. Role-based UI and backend checks are enforced.
3. Admin can add users and update attendance via UI.
4. Admin can access sheet link and trigger reconcile.
5. Critical actions are auditable.
