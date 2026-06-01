# Fortsolar Admin

Fortsolar Admin is the internal operations dashboard for the Fortsolar platform. It provides authenticated, role-aware workflows for managing customers, installers, products, packages, orders, content, jobs, projects, transactions, and realtime notifications from a single Next.js application.

## Highlights

- Secure admin authentication with signed HTTP-only session cookies
- Role and permission based route access across dashboard modules
- API-backed management surfaces for users, orders, inventory, jobs, installations, transactions, blog, and site pages
- Realtime notification delivery through Socket.IO with optional OneSignal browser push
- Shared proxy layer for forwarding authenticated requests to the Fortsolar backend API

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI primitives
- Socket.IO client
- Jest + ESLint

## Application Architecture

- `app/(dashboard_pages)` contains the authenticated admin routes.
- `app/api/auth/*` handles login, logout, refresh, and notification socket session bootstrap.
- `app/api/proxy/[...endpoint]` forwards authenticated requests to the backend API.
- `components/dashboard` contains the shell, navigation, tables, dialogs, and notification UX.
- `lib/auth` owns cookie signing, session hydration, access control, and auth refresh.
- `lib/admin-api.ts` and related API helpers centralize backend integration.

Most core admin surfaces are connected to backend endpoints. A smaller number of helper labels and draft records still come from local UI data in `lib/management-data.ts`.

## Functional Coverage

The dashboard currently exposes management flows for:

- overview and verification queue
- customers, installers, and admin users
- products, packages, and bundles
- orders and energy audit requests
- projects and installations
- jobs and applicant workflows
- transactions
- notifications and realtime alerts
- blog content and site pages
- workspace settings

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- Access to the Fortsolar backend API

## Local Development

1. Copy the sample environment file:

   ```bash
   cp .env.example .env.local
   ```

2. Set the required environment variables.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3326`.

The dev server binds to `0.0.0.0:3326`.

## Environment Variables

Set these in `.env.local` for local development and in your deployment platform for production.

| Variable | Required | Purpose |
| --- | --- | --- |
| `FORTSOLAR_API_BASE_URL` | Yes | Server-side base URL for the Fortsolar API. |
| `NEXT_PUBLIC_FORTSOLAR_API_BASE_URL` | Yes | Public API base URL used by browser-side admin flows. Keep it aligned with `FORTSOLAR_API_BASE_URL`. |
| `FORTSOLAR_SESSION_SECRET` | Yes | Secret used to sign admin session cookies. Use a long random value. |
| `FORTSOLAR_SOCKET_URL` | No | Explicit Socket.IO origin for realtime notifications. Falls back to the API base URL when omitted. |
| `FORTSOLAR_SOCKET_PATH` | No | Socket.IO path. Defaults to `/socket.io`. |
| `FORTSOLAR_NOTIFICATION_EVENTS` | No | Comma-separated event names for admin notifications. Defaults to `admin:notification,notification,notification:new`. |
| `ONESIGNAL_APP_ID` | No | OneSignal app ID used by the current local development flow. |
| `ONESIGNAL_SAFARI_WEB_ID` | No | Safari web push ID for local development. |
| `ONESIGNAL_NOTIFY_BUTTON` | No | Enables the OneSignal floating notify button in local development when set to `true`. |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | No | Browser-exposed OneSignal app ID used in production builds. |
| `NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID` | No | Browser-exposed Safari web push ID used in production builds. |
| `NEXT_PUBLIC_ONESIGNAL_NOTIFY_BUTTON` | No | Enables the OneSignal floating notify button in production when set to `true`. |

Compatibility note: the current codebase still supports some `NEXT_PUBLIC_*` fallbacks for server configuration, including a legacy session secret path. Do not expose session secrets through public environment variables in production.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server on port `3326`. |
| `npm run build` | Build the production bundle. |
| `npm run start` | Start the production server. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run Jest tests once. |
| `npm run test:watch` | Run Jest in watch mode. |

## Directory Overview

```text
app/
  (dashboard_pages)/   Authenticated admin routes
  api/                 Auth and backend proxy routes
components/
  auth/                Login and auth UI
  dashboard/           Shell, pages, dialogs, tables, notifications
lib/
  api/                 Request helpers and backend adapters
  auth/                Session, cookies, permissions, access control
  onesignal*           Browser push configuration
types/
  api.types.ts         Shared API contracts
docs/                  Internal status and implementation notes
```

## Quality Checks

Run these before shipping:

```bash
npm run lint
npm test
npm run build
```

## Deployment Notes

- Deploy as a standard Next.js server application.
- Configure both API base URL variables to the same backend origin unless you have a specific split between server and browser traffic.
- Keep the session secret server-only and rotate it through your deployment platform.
- If realtime notifications are enabled, make sure the socket origin, path, and browser notification domains are allowed by the backend and OneSignal configuration.
