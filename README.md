# SlackTrack Admin

React admin panel for HR/managers to manage users, attendance workflows, and sync operations.

## Run with Docker (one command)

From `slacktrack-admin/`:

```bash
docker compose up --build
```

Open: `http://localhost:5173`

## Environment

Copy `.env.example` to `.env` if you need to override API URL.

- `VITE_API_BASE_URL` defaults to `http://localhost:8080`

## Current Pages

- Login / Logout
- Dashboard (basic cards)
- Users (live data from `/api/admin/users`)
- Attendance (placeholder)
- Settings (placeholder)

## Backend Requirements

Run `slacktrack-server` API on `http://localhost:8080`.
Use admin login endpoint:

- `POST /api/admin/auth/login`
