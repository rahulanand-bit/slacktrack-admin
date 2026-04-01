# SlackTrack Admin

React admin panel for HR/managers to manage users, attendance workflows, and sync operations.

## Run with Docker (one command)

From `slacktrack-admin/`:

```bash
docker compose up --build
```

Open: `http://localhost:5173`

## Run in Production Mode

From `slacktrack-admin/`:

```bash
VITE_API_BASE_URL=https://your-api-domain docker compose -f docker-compose.prod.yml up -d --build
```

Open: `http://<server-ip>`

## Environment

Copy `.env.example` to `.env` if you need to override API URL.

- `VITE_API_BASE_URL` defaults to `/api` (recommended behind reverse proxy)

## Current Pages

- Login / Logout
- Dashboard
- Users (live data from `/api/admin/users`)
- Projects (view/add/remove)
- Attendance (day + monthly + user drill-down + overrides + non-working day highlighting)
- Analytics (billing detail + employee/project active-day summaries + project drill-down users, with half-day support)
- Settings
- Timers (inside Settings flow)

## Backend Requirements

Run `slacktrack-server` API on `http://localhost:8080`.
Use admin login endpoint:

- `POST /api/admin/auth/login`
